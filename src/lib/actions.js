import { PAYMENT_METHODS, addPayment, addTransfer, listDebts, listPeople, saveDebt, saveSplit, saveTransaction, setDebtReminder } from './db';
import { peso, prettyDate, today } from './format';
import { scheduleDueReminder } from './notify';

export function findCategory(categories, name, kind = 'expense') {
  const pool = categories.filter((c) => c.kind === kind);
  if (!name) return pool.find((c) => c.name === 'Others') || pool[0] || null;
  const n = String(name).toLowerCase().trim();
  return (
    pool.find((c) => c.name.toLowerCase() === n) ||
    pool.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase())) ||
    pool.find((c) => c.name === 'Others') ||
    pool[0] ||
    null
  );
}

export function matchPerson(people, name) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  return (
    people.find((p) => p.name.toLowerCase() === n) ||
    people.find((p) => p.name.toLowerCase().startsWith(n) || n.startsWith(p.name.toLowerCase())) ||
    people.find((p) => p.name.toLowerCase().includes(n)) ||
    null
  );
}

function cap(s) {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function describeAction(a, categories = []) {
  switch (a.type) {
    case 'expense':
    case 'income': {
      const c = findCategory(categories, a.category, a.type);
      const sign = a.type === 'income' ? '💰 +' : `${c?.emoji || '💸'} `;
      return {
        title: `${sign}${peso(a.amount)} · ${a.note || c?.name || ''}`,
        sub: [c?.name, (a.method || 'cash').toUpperCase() === 'GCASH' ? 'GCash' : cap(a.method || 'cash'), a.date && a.date !== today() ? prettyDate(a.date) : 'Today']
          .filter(Boolean)
          .join(' · '),
      };
    }
    case 'debt':
      return {
        title: a.direction === 'owe' ? `🫣 You owe ${cap(a.person)} ${peso(a.amount)}` : `🤑 ${cap(a.person)} owes you ${peso(a.amount)}`,
        sub: [a.reason, a.dueDate ? `Due ${prettyDate(a.dueDate)}` : null].filter(Boolean).join(' · ') || 'Utang',
      };
    case 'payment':
      return {
        title:
          a.direction === 'owe'
            ? `✅ You paid ${cap(a.person)} ${a.amount ? peso(a.amount) : '(full)'}`
            : `✅ ${cap(a.person)} paid you ${a.amount ? peso(a.amount) : '(full)'}`,
        sub: 'Payment on utang',
      };
    case 'transfer': {
      const f = PAYMENT_METHODS.find((m) => m.key === a.from) || PAYMENT_METHODS[0];
      const t = PAYMENT_METHODS.find((m) => m.key === a.to) || PAYMENT_METHODS[0];
      return {
        title: `${f.emoji} → ${t.emoji} Move ${peso(a.amount)}`,
        sub: `${f.label} to ${t.label}${a.fee ? ` · fee ${peso(a.fee)}` : ''}`,
      };
    }
    case 'split': {
      const heads = (a.people || []).length + (a.includeMe === false ? 0 : 1);
      return {
        title: `🍕 Hati-hati ${peso(a.total)} · ${heads} people`,
        sub: `${(a.people || []).map(cap).join(', ')}${a.includeMe === false ? '' : ' + you'}${a.reason ? ` · ${a.reason}` : ''}`,
      };
    }
    default:
      return { title: 'Unknown', sub: '' };
  }
}

export function isValidAction(a) {
  if (!a || !a.type) return false;
  if (a.type === 'expense' || a.type === 'income') return a.amount > 0;
  if (a.type === 'debt') return a.amount > 0 && !!a.person;
  if (a.type === 'payment') return !!a.person;
  if (a.type === 'split') return a.total > 0 && (a.people || []).length > 0;
  if (a.type === 'transfer') return a.amount > 0 && !!a.from && !!a.to && a.from !== a.to;
  return false;
}

export async function executeAction(db, a, categories, extra = {}) {
  if (a.type === 'expense' || a.type === 'income') {
    const c = findCategory(categories, a.category, a.type);
    await saveTransaction(db, {
      kind: a.type,
      amount: a.amount,
      category_id: c?.id,
      method: a.method || 'cash',
      date: a.date || today(),
      note: a.note || c?.name || '',
      photo: extra.photo || null,
    });
    return `${a.type === 'income' ? '💰' : c?.emoji || '✅'} ${a.note || c?.name} · ${peso(a.amount)} saved`;
  }

  if (a.type === 'debt') {
    const people = await listPeople(db);
    const existing = matchPerson(people, a.person);
    const name = existing?.name || cap(a.person);
    const { id } = await saveDebt(db, {
      personId: existing?.id,
      personName: name,
      direction: a.direction === 'owe' ? 'owe' : 'owed',
      amount: a.amount,
      reason: a.reason || '',
      date: a.date || today(),
      due_date: a.dueDate || null,
      method: a.method || 'cash',
    });
    if (a.dueDate) {
      const rid = await scheduleDueReminder({ dueDate: a.dueDate, personName: name, direction: a.direction, amount: a.amount });
      if (rid) await setDebtReminder(db, id, rid);
    }
    return a.direction === 'owe' ? `🫣 Utang to ${name} saved` : `🤑 ${name}’s utang saved`;
  }

  if (a.type === 'payment') {
    const people = await listPeople(db);
    const person = matchPerson(people, a.person);
    if (!person) throw new Error(`I couldn’t find “${a.person}” in your utang list.`);
    const dir = a.direction === 'owe' ? 'owe' : 'owed';
    const open = (await listDebts(db, { personId: person.id }))
      .filter((d) => d.direction === dir && d.remaining > 0)
      .sort((x, y) => (x.date < y.date ? -1 : 1));
    if (!open.length) throw new Error(`No open utang with ${person.name} in that direction.`);
    let left = a.amount || open.reduce((s, d) => s + d.remaining, 0);
    let applied = 0;
    for (const d of open) {
      if (left <= 0) break;
      const pay = Math.min(left, d.remaining);
      await addPayment(db, { debtId: d.id, amount: pay, date: a.date || today(), photo: extra.photo || null, method: a.method });
      left -= pay;
      applied += pay;
    }
    return dir === 'owe' ? `✅ Paid ${person.name} ${peso(applied)}` : `✅ ${person.name} paid ${peso(applied)}`;
  }

  if (a.type === 'split') {
    const heads = a.people.length + (a.includeMe === false ? 0 : 1);
    const each = Math.floor(a.total / heads);
    const extraCents = a.total - each * heads;
    const c = findCategory(categories, a.category || 'Food', 'expense');
    const created = await saveSplit(db, {
      reason: a.reason || '',
      date: a.date || today(),
      dueDate: a.dueDate || null,
      shares: a.people.map((n, i) => ({ name: cap(n), amount: each + (a.includeMe === false && i === 0 ? extraCents : 0) })),
      myShare: a.includeMe === false ? null : { amount: each + extraCents, categoryId: c?.id, method: a.method || 'cash' },
      paidWith: a.method || 'cash',
    });
    return `🍕 Split done · ${created.length} utang added`;
  }

  if (a.type === 'transfer') {
    await addTransfer(db, { from: a.from, to: a.to, amount: a.amount, fee: a.fee || 0, date: a.date || today(), note: a.note || '' });
    return `💸 Moved ${peso(a.amount)}`;
  }

  throw new Error('Unknown action');
}
