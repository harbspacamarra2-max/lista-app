import { today, monthKey, startOfWeek, shiftMonth, addDays } from './format';

export const DB_NAME = 'lista.db';

const DEFAULT_CATEGORIES = [
  ['Food', '🍜', 'peach', 'expense'],
  ['Transport', '🚌', 'sky', 'expense'],
  ['School', '📚', 'lilac', 'expense'],
  ['Load & Data', '📱', 'teal', 'expense'],
  ['Bills', '💡', 'butter', 'expense'],
  ['Shopping', '🛍️', 'rose', 'expense'],
  ['Fun', '🎮', 'lilac', 'expense'],
  ['Health', '💊', 'mint', 'expense'],
  ['Others', '✨', 'stone', 'expense'],
  ['Allowance', '💸', 'mint', 'income'],
  ['Salary', '💼', 'sky', 'income'],
  ['Side hustle', '🚀', 'lilac', 'income'],
  ['Gift', '🎁', 'rose', 'income'],
  ['Others', '✨', 'stone', 'income'],
];

export const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', emoji: '💵' },
  { key: 'gcash', label: 'GCash', emoji: '🔵' },
  { key: 'maya', label: 'Maya', emoji: '🟢' },
  { key: 'card', label: 'Card', emoji: '💳' },
  { key: 'bank', label: 'Bank', emoji: '🏦' },
];

export function methodLabel(key) {
  return PAYMENT_METHODS.find((m) => m.key === key)?.label ?? 'Cash';
}

export async function migrate(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '✨',
      color TEXT NOT NULL DEFAULT 'stone',
      kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
      is_default INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
      amount INTEGER NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🙂',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('owe','owed')),
      amount INTEGER NOT NULL,
      reason TEXT,
      date TEXT NOT NULL,
      due_date TEXT,
      reminder_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_debts_person ON debts(person_id);
    CREATE INDEX IF NOT EXISTS idx_pay_debt ON debt_payments(debt_id);
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🐷',
      color TEXT NOT NULL DEFAULT 'rose',
      target INTEGER NOT NULL,
      deadline TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS goal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🧾',
      amount INTEGER NOT NULL,
      category_id INTEGER,
      method TEXT NOT NULL DEFAULT 'cash',
      freq TEXT NOT NULL DEFAULT 'monthly',
      next_due TEXT NOT NULL,
      remind INTEGER NOT NULL DEFAULT 1,
      reminder_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS no_spend_days (date TEXT PRIMARY KEY NOT NULL);
  `);
  const addCol = async (table, col, ddl) => {
    const info = await db.getAllAsync(`PRAGMA table_info(${table})`);
    if (!info.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  await addCol('transactions', 'photo', 'photo TEXT');
  await addCol('transactions', 'bill_id', 'bill_id INTEGER');
  await addCol('debt_payments', 'photo', 'photo TEXT');
  await addCol('debts', 'principal', 'principal INTEGER');
  await addCol('debts', 'interest', 'interest REAL NOT NULL DEFAULT 0');
  await addCol('debts', 'plan_count', 'plan_count INTEGER NOT NULL DEFAULT 0');
  await addCol('debts', 'plan_freq', "plan_freq TEXT NOT NULL DEFAULT 'monthly'");
  await addCol('debts', 'method', 'method TEXT');
  await addCol('debt_payments', 'method', 'method TEXT');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS wallets (key TEXT PRIMARY KEY NOT NULL, start INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_method TEXT NOT NULL,
      to_method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      fee INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '👯',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, person_id)
    );
  `);
  await addCol('goal_entries', 'method', 'method TEXT');
  const cols = await db.getAllAsync('PRAGMA table_info(categories)');
  if (!cols.some((c) => c.name === 'budget')) {
    await db.execAsync('ALTER TABLE categories ADD COLUMN budget INTEGER NOT NULL DEFAULT 0');
  }

  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories');
  if (!row || row.n === 0) {
    await db.withTransactionAsync(async () => {
      for (const [name, emoji, color, kind] of DEFAULT_CATEGORIES) {
        await db.runAsync(
          'INSERT INTO categories (name, emoji, color, kind, is_default) VALUES (?, ?, ?, ?, 1)',
          name, emoji, color, kind
        );
      }
    });
  }
}

export async function getSettings(db) {
  const rows = await db.getAllAsync('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value == null ? null : String(value)
  );
}

export function listCategories(db, kind) {
  if (kind) {
    return db.getAllAsync(
      'SELECT * FROM categories WHERE kind = ? AND archived = 0 ORDER BY is_default DESC, id',
      kind
    );
  }
  return db.getAllAsync('SELECT * FROM categories WHERE archived = 0 ORDER BY kind, is_default DESC, id');
}

export async function addCategory(db, { name, emoji, color, kind }) {
  const r = await db.runAsync(
    'INSERT INTO categories (name, emoji, color, kind) VALUES (?, ?, ?, ?)',
    name.trim(), emoji || '✨', color || 'stone', kind
  );
  return r.lastInsertRowId;
}

export async function archiveCategory(db, id) {
  await db.runAsync('UPDATE categories SET archived = 1 WHERE id = ?', id);
}

const TX_SELECT = `
  SELECT t.*, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
  FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;

export function listTransactions(db, { month, kind, search, limit } = {}) {
  const where = [];
  const params = [];
  if (month) { where.push('substr(t.date, 1, 7) = ?'); params.push(month); }
  if (kind) { where.push('t.kind = ?'); params.push(kind); }
  if (search) {
    where.push('(t.note LIKE ? OR c.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  let sql = TX_SELECT;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY t.date DESC, t.id DESC';
  if (limit) sql += ` LIMIT ${Number(limit)}`;
  return db.getAllAsync(sql, ...params);
}

export function getTransaction(db, id) {
  return db.getFirstAsync(`${TX_SELECT} WHERE t.id = ?`, id);
}

export async function saveTransaction(db, tx) {
  const { id, kind, amount, category_id, method, date, note, photo, bill_id } = tx;
  if (id) {
    await db.runAsync(
      'UPDATE transactions SET kind=?, amount=?, category_id=?, method=?, date=?, note=?, photo=? WHERE id=?',
      kind, amount, category_id ?? null, method || 'cash', date, note || null, photo || null, id
    );
    return id;
  }
  const r = await db.runAsync(
    'INSERT INTO transactions (kind, amount, category_id, method, date, note, photo, bill_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    kind, amount, category_id ?? null, method || 'cash', date, note || null, photo || null, bill_id ?? null
  );
  return r.lastInsertRowId;
}

export async function deleteTransaction(db, id) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

async function sumBetween(db, kind, from, to) {
  const r = await db.getFirstAsync(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE kind = ? AND date >= ? AND date <= ?',
    kind, from, to
  );
  return r?.total ?? 0;
}

export async function getOverview(db) {
  const t = today();
  const m = monthKey(t);
  const monthStart = `${m}-01`;
  const monthEnd = `${m}-31`;
  const [spentToday, spentWeek, spentMonth, incomeMonth, out] = await Promise.all([
    sumBetween(db, 'expense', t, t),
    sumBetween(db, 'expense', startOfWeek(t), t),
    sumBetween(db, 'expense', monthStart, monthEnd),
    sumBetween(db, 'income', monthStart, monthEnd),
    moneyOut(db, monthStart, monthEnd),
  ]);
  return { spentToday, spentWeek, spentMonth, incomeMonth, ...out, usedMonth: spentMonth + out.outMonth };
}

export async function moneyOut(db, from, to) {
  const one = (sql) => db.getFirstAsync(sql, from, to).then((r) => r?.total ?? 0);
  const [lent, paidBack, saved, fees] = await Promise.all([
    one("SELECT COALESCE(SUM(COALESCE(principal, amount)), 0) AS total FROM debts WHERE direction = 'owed' AND method IS NOT NULL AND date >= ? AND date <= ?"),
    one("SELECT COALESCE(SUM(p.amount), 0) AS total FROM debt_payments p JOIN debts d ON d.id = p.debt_id WHERE d.direction = 'owed' AND p.method IS NOT NULL AND p.date >= ? AND p.date <= ?"),
    one('SELECT COALESCE(SUM(amount), 0) AS total FROM goal_entries WHERE method IS NOT NULL AND date >= ? AND date <= ?'),
    one('SELECT COALESCE(SUM(fee), 0) AS total FROM transfers WHERE date >= ? AND date <= ?'),
  ]);
  const lentMonth = Math.max(0, lent - paidBack);
  const savedMonth = Math.max(0, saved);
  return { lentMonth, savedMonth, feesMonth: fees, outMonth: lentMonth + savedMonth + fees };
}

export async function getMonthReport(db, month) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const prev = shiftMonth(month, -1);
  const [byCategory, daily, spent, income, prevSpent] = await Promise.all([
    db.getAllAsync(
      `SELECT c.id, COALESCE(c.name, 'Uncategorized') AS name, COALESCE(c.emoji, '✨') AS emoji,
              COALESCE(c.color, 'stone') AS color, SUM(t.amount) AS total, COUNT(*) AS count
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.kind = 'expense' AND t.date >= ? AND t.date <= ?
       GROUP BY c.id ORDER BY total DESC`,
      from, to
    ),
    db.getAllAsync(
      `SELECT date, SUM(amount) AS total FROM transactions
       WHERE kind = 'expense' AND date >= ? AND date <= ? GROUP BY date`,
      from, to
    ),
    sumBetween(db, 'expense', from, to),
    sumBetween(db, 'income', from, to),
    sumBetween(db, 'expense', `${prev}-01`, `${prev}-31`),
  ]);
  return { byCategory, daily, spent, income, prevSpent };
}

const PERSON_EMOJIS = ['🙂', '😎', '🤓', '🥳', '😺', '🐶', '🦊', '🐼', '🐸', '🌻', '🍓', '⭐'];

export async function findOrCreatePerson(db, name) {
  const clean = name.trim();
  const existing = await db.getFirstAsync('SELECT * FROM people WHERE lower(name) = lower(?)', clean);
  if (existing) return existing.id;
  const emoji = PERSON_EMOJIS[Math.floor(Math.random() * PERSON_EMOJIS.length)];
  const r = await db.runAsync('INSERT INTO people (name, emoji) VALUES (?, ?)', clean, emoji);
  return r.lastInsertRowId;
}

export function listPeople(db) {
  return db.getAllAsync('SELECT * FROM people ORDER BY name COLLATE NOCASE');
}

export function getPerson(db, id) {
  return db.getFirstAsync('SELECT * FROM people WHERE id = ?', id);
}

export async function renamePerson(db, id, name) {
  await db.runAsync('UPDATE people SET name = ? WHERE id = ?', name.trim(), id);
}

export async function deletePerson(db, id) {
  await db.runAsync('DELETE FROM debt_payments WHERE debt_id IN (SELECT id FROM debts WHERE person_id = ?)', id);
  await db.runAsync('DELETE FROM debts WHERE person_id = ?', id);
  await db.runAsync('DELETE FROM people WHERE id = ?', id);
}

const FREQ_DAYS = { weekly: 7, biweekly: 14, monthly: 0 };

export function stepDate(iso, freq, n) {
  if (freq === 'monthly') {
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(y, m - 1 + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d, last));
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${target.getFullYear()}-${mm}-${dd}`;
  }
  return addDays(iso, (FREQ_DAYS[freq] || 30) * n);
}

function decorateDebt(d) {
  const remaining = Math.max(0, d.amount - (d.paid || 0));
  let status = 'unpaid';
  if (remaining === 0) status = 'paid';
  else if ((d.paid || 0) > 0) status = 'partial';
  let plan = null;
  if (d.plan_count > 1) {
    const each = Math.ceil(d.amount / d.plan_count);
    const done = Math.min(d.plan_count, Math.floor((d.paid || 0) / each + 0.001));
    const first = d.due_date || stepDate(d.date, d.plan_freq, 1);
    plan = {
      each,
      count: d.plan_count,
      done,
      freq: d.plan_freq,
      nextDue: remaining > 0 ? stepDate(first, d.plan_freq, done) : null,
      nextAmount: Math.min(each, remaining),
    };
  }
  return { ...d, remaining, status, plan };
}

const DEBT_SELECT = `
  SELECT d.*, p.name AS person_name, p.emoji AS person_emoji,
         COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0) AS paid
  FROM debts d JOIN people p ON p.id = d.person_id`;

export async function listDebts(db, { personId } = {}) {
  const rows = personId
    ? await db.getAllAsync(`${DEBT_SELECT} WHERE d.person_id = ? ORDER BY d.date DESC, d.id DESC`, personId)
    : await db.getAllAsync(`${DEBT_SELECT} ORDER BY d.date DESC, d.id DESC`);
  return rows.map(decorateDebt);
}

export async function getDebt(db, id) {
  const row = await db.getFirstAsync(`${DEBT_SELECT} WHERE d.id = ?`, id);
  return row ? decorateDebt(row) : null;
}

export function listPayments(db, debtId) {
  return db.getAllAsync('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC', debtId);
}

export function listPaymentsForPerson(db, personId) {
  return db.getAllAsync(
    `SELECT dp.* FROM debt_payments dp JOIN debts d ON d.id = dp.debt_id
     WHERE d.person_id = ? ORDER BY dp.date DESC, dp.id DESC`,
    personId
  );
}

export async function getUtangSummary(db) {
  const debts = await listDebts(db);
  const people = await listPeople(db);
  const map = new Map(people.map((p) => [p.id, { ...p, owe: 0, owed: 0, open: 0, nextDue: null, debts: 0 }]));
  let totalOwe = 0;
  let totalOwed = 0;
  const dueSoon = [];
  for (const d of debts) {
    const p = map.get(d.person_id);
    if (!p) continue;
    p.debts += 1;
    if (d.remaining > 0) {
      p.open += 1;
      if (d.direction === 'owe') { p.owe += d.remaining; totalOwe += d.remaining; }
      else { p.owed += d.remaining; totalOwed += d.remaining; }
      const due = d.plan?.nextDue || d.due_date;
      if (due) {
        if (!p.nextDue || due < p.nextDue) p.nextDue = due;
        if (due <= addDays(today(), 7)) dueSoon.push({ ...d, due_date: due });
      }
    }
  }
  dueSoon.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  return { totalOwe, totalOwed, people: [...map.values()], dueSoon };
}

export function withInterest(principal, rate) {
  return Math.round(principal * (1 + (Number(rate) || 0) / 100));
}

export async function saveDebt(db, { id, personId, personName, direction, amount, reason, date, due_date, interest = 0, plan_count = 0, plan_freq = 'monthly', method = null }) {
  const pid = personId || (await findOrCreatePerson(db, personName));
  const rate = Number(interest) || 0;
  const total = withInterest(amount, rate);
  if (id) {
    await db.runAsync(
      'UPDATE debts SET person_id=?, direction=?, amount=?, principal=?, interest=?, plan_count=?, plan_freq=?, reason=?, date=?, due_date=?, method=? WHERE id=?',
      pid, direction, total, amount, rate, plan_count || 0, plan_freq || 'monthly', reason || null, date, due_date || null, method || null, id
    );
    return { id, personId: pid };
  }
  const r = await db.runAsync(
    'INSERT INTO debts (person_id, direction, amount, principal, interest, plan_count, plan_freq, reason, date, due_date, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    pid, direction, total, amount, rate, plan_count || 0, plan_freq || 'monthly', reason || null, date, due_date || null, method || null
  );
  return { id: r.lastInsertRowId, personId: pid };
}

export async function setDebtReminder(db, id, reminderId) {
  await db.runAsync('UPDATE debts SET reminder_id = ? WHERE id = ?', reminderId || null, id);
}

export async function deleteDebt(db, id) {
  await db.runAsync('DELETE FROM debt_payments WHERE debt_id = ?', id);
  await db.runAsync('DELETE FROM debts WHERE id = ?', id);
}

export async function addPayment(db, { debtId, amount, date, note, photo, method }) {
  let m = method;
  if (m === undefined) {
    const d = await db.getFirstAsync('SELECT method FROM debts WHERE id = ?', debtId);
    m = d?.method || null;
  }
  await db.runAsync(
    'INSERT INTO debt_payments (debt_id, amount, date, note, photo, method) VALUES (?, ?, ?, ?, ?, ?)',
    debtId, amount, date || today(), note || null, photo || null, m || null
  );
}

export async function deletePayment(db, id) {
  await db.runAsync('DELETE FROM debt_payments WHERE id = ?', id);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCSV(db) {
  const txs = await listTransactions(db);
  const debts = await listDebts(db);
  const lines = ['TRANSACTIONS', 'date,type,category,amount,method,note'];
  for (const t of txs) {
    lines.push([t.date, t.kind, t.category_name, (t.amount / 100).toFixed(2), t.method, t.note].map(csvCell).join(','));
  }
  lines.push('', 'UTANG', 'date,person,direction,amount,paid,remaining,due_date,reason');
  for (const d of debts) {
    lines.push([
      d.date, d.person_name, d.direction === 'owe' ? 'I owe' : 'Owed to me',
      (d.amount / 100).toFixed(2), (d.paid / 100).toFixed(2), (d.remaining / 100).toFixed(2),
      d.due_date, d.reason,
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export async function resetAll(db) {
  await db.execAsync(`
    DELETE FROM bills; DELETE FROM no_spend_days;
    DELETE FROM goal_entries; DELETE FROM goals;
    DELETE FROM transfers; DELETE FROM wallets;
    DELETE FROM group_members; DELETE FROM groups;
    UPDATE categories SET budget = 0;
    DELETE FROM debt_payments; DELETE FROM debts; DELETE FROM people;
    DELETE FROM transactions; DELETE FROM categories WHERE is_default = 0;
    UPDATE categories SET archived = 0;
  `);
}

export async function getStreak(db) {
  const rows = await db.getAllAsync(
    `SELECT DISTINCT date FROM (
       SELECT date FROM transactions UNION SELECT date FROM debts UNION SELECT date FROM no_spend_days
     ) ORDER BY date DESC LIMIT 400`
  );
  const dates = new Set(rows.map((r) => r.date));
  let day = today();
  if (!dates.has(day)) day = addDays(day, -1);
  let n = 0;
  while (dates.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function frequentEntries(db, kind) {
  return db.getAllAsync(
    `SELECT t.category_id, t.amount, t.note, t.method, COUNT(*) AS n, MAX(t.id) AS last_id,
            c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.kind = ? AND t.date >= ?
     GROUP BY t.category_id, t.amount, COALESCE(t.note, ''), t.method
     ORDER BY n DESC, last_id DESC LIMIT 8`,
    kind, addDays(today(), -90)
  );
}

export async function setCategoryBudget(db, id, amount) {
  await db.runAsync('UPDATE categories SET budget = ? WHERE id = ?', Math.max(0, amount || 0), id);
}

export async function getBudgetStatus(db, month = monthKey()) {
  const rows = await db.getAllAsync(
    `SELECT c.id, c.name, c.emoji, c.color, c.budget,
            COALESCE((SELECT SUM(t.amount) FROM transactions t
                      WHERE t.category_id = c.id AND t.kind = 'expense'
                        AND t.date >= ? AND t.date <= ?), 0) AS spent
     FROM categories c WHERE c.kind = 'expense' AND c.archived = 0 AND c.budget > 0
     ORDER BY (CAST(spent AS REAL) / c.budget) DESC`,
    `${month}-01`, `${month}-31`
  );
  return rows.map((r) => ({ ...r, pct: r.budget ? r.spent / r.budget : 0 }));
}

export function spendingByMethod(db, month) {
  return db.getAllAsync(
    `SELECT method, SUM(amount) AS total, COUNT(*) AS count FROM transactions
     WHERE kind = 'expense' AND date >= ? AND date <= ? GROUP BY method ORDER BY total DESC`,
    `${month}-01`, `${month}-31`
  );
}

const GOAL_SELECT = `
  SELECT g.*, COALESCE((SELECT SUM(amount) FROM goal_entries WHERE goal_id = g.id), 0) AS saved
  FROM goals g`;

export function listGoals(db) {
  return db.getAllAsync(`${GOAL_SELECT} ORDER BY (saved >= target), g.id DESC`);
}

export function getGoal(db, id) {
  return db.getFirstAsync(`${GOAL_SELECT} WHERE g.id = ?`, id);
}

export async function saveGoal(db, { id, name, emoji, color, target, deadline }) {
  if (id) {
    await db.runAsync(
      'UPDATE goals SET name=?, emoji=?, color=?, target=?, deadline=? WHERE id=?',
      name.trim(), emoji, color, target, deadline || null, id
    );
    return id;
  }
  const r = await db.runAsync(
    'INSERT INTO goals (name, emoji, color, target, deadline) VALUES (?, ?, ?, ?, ?)',
    name.trim(), emoji, color, target, deadline || null
  );
  return r.lastInsertRowId;
}

export async function deleteGoal(db, id) {
  await db.runAsync('DELETE FROM goal_entries WHERE goal_id = ?', id);
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}

export function listGoalEntries(db, goalId) {
  return db.getAllAsync('SELECT * FROM goal_entries WHERE goal_id = ? ORDER BY date DESC, id DESC', goalId);
}

export async function addGoalEntry(db, { goalId, amount, note, method = null }) {
  await db.runAsync(
    'INSERT INTO goal_entries (goal_id, amount, date, note, method) VALUES (?, ?, ?, ?, ?)',
    goalId, amount, today(), note || null, method || null
  );
}

export async function deleteGoalEntry(db, id) {
  await db.runAsync('DELETE FROM goal_entries WHERE id = ?', id);
}

export async function saveSplit(db, { reason, date, dueDate, shares, myShare, paidWith = null }) {
  const created = [];
  await db.withTransactionAsync(async () => {
    for (const s of shares) {
      if (!s.amount) continue;
      const res = await saveDebt(db, {
        personName: s.name,
        direction: 'owed',
        amount: s.amount,
        reason: reason ? `${reason} (hati-hati)` : 'Hati-hati',
        date,
        due_date: dueDate,
        method: paidWith,
      });
      created.push({ ...res, name: s.name, amount: s.amount });
    }
    if (myShare && myShare.amount > 0) {
      await saveTransaction(db, {
        kind: 'expense',
        amount: myShare.amount,
        category_id: myShare.categoryId,
        method: myShare.method || paidWith || 'cash',
        date,
        note: reason ? `${reason} (my share)` : 'My share',
      });
    }
  });
  return created;
}

export async function markNoSpend(db, date = today()) {
  await db.runAsync('INSERT OR IGNORE INTO no_spend_days (date) VALUES (?)', date);
}

export async function todaySummary(db) {
  const t = today();
  const m = monthKey(t);
  const [spentToday, spentMonth, settings, out] = await Promise.all([
    sumBetween(db, 'expense', t, t),
    sumBetween(db, 'expense', `${m}-01`, `${m}-31`),
    getSettings(db),
    moneyOut(db, `${m}-01`, `${m}-31`),
  ]);
  const budget = Number(settings.budget || 0);
  return { date: t, month: m, spentToday, spentMonth, usedMonth: spentMonth + out.outMonth, budget, name: settings.name || '' };
}

function addMonths(iso, n, anchorDay) {
  const [y, mo] = iso.split('-').map(Number);
  const target = new Date(y, mo - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(anchorDay, last);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function nextDueAfter(bill) {
  const anchor = Number((bill.anchor_day || bill.next_due.slice(8)) || 1);
  if (bill.freq === 'weekly') return addDays(bill.next_due, 7);
  if (bill.freq === 'yearly') return addMonths(bill.next_due, 12, anchor);
  return addMonths(bill.next_due, 1, anchor);
}

const BILL_SELECT = `
  SELECT b.*, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
  FROM bills b LEFT JOIN categories c ON c.id = b.category_id`;

export function listBills(db) {
  return db.getAllAsync(`${BILL_SELECT} WHERE b.active = 1 ORDER BY b.next_due, b.id`);
}

export function getBill(db, id) {
  return db.getFirstAsync(`${BILL_SELECT} WHERE b.id = ?`, id);
}

export async function saveBill(db, b) {
  if (b.id) {
    await db.runAsync(
      'UPDATE bills SET name=?, emoji=?, amount=?, category_id=?, method=?, freq=?, next_due=?, remind=? WHERE id=?',
      b.name.trim(), b.emoji, b.amount, b.category_id ?? null, b.method || 'cash', b.freq, b.next_due, b.remind ? 1 : 0, b.id
    );
    return b.id;
  }
  const r = await db.runAsync(
    'INSERT INTO bills (name, emoji, amount, category_id, method, freq, next_due, remind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    b.name.trim(), b.emoji, b.amount, b.category_id ?? null, b.method || 'cash', b.freq, b.next_due, b.remind ? 1 : 0
  );
  return r.lastInsertRowId;
}

export async function setBillReminder(db, id, reminderId) {
  await db.runAsync('UPDATE bills SET reminder_id = ? WHERE id = ?', reminderId || null, id);
}

export async function deleteBill(db, id) {
  await db.runAsync('UPDATE bills SET active = 0, reminder_id = NULL WHERE id = ?', id);
}

export async function payBill(db, bill, { date = today(), amount } = {}) {
  await saveTransaction(db, {
    kind: 'expense',
    amount: amount ?? bill.amount,
    category_id: bill.category_id,
    method: bill.method,
    date,
    note: bill.name,
    bill_id: bill.id,
  });
  const next = nextDueAfter(bill);
  await db.runAsync('UPDATE bills SET next_due = ? WHERE id = ?', next, bill.id);
  return next;
}

export async function skipBill(db, bill) {
  const next = nextDueAfter(bill);
  await db.runAsync('UPDATE bills SET next_due = ? WHERE id = ?', next, bill.id);
  return next;
}

export async function captureForUndo(db, what, id) {
  if (what === 'tx') {
    return { transactions: [await db.getFirstAsync('SELECT * FROM transactions WHERE id = ?', id)].filter(Boolean) };
  }
  if (what === 'payment') {
    return { debt_payments: [await db.getFirstAsync('SELECT * FROM debt_payments WHERE id = ?', id)].filter(Boolean) };
  }
  if (what === 'debt') {
    return {
      debts: [await db.getFirstAsync('SELECT * FROM debts WHERE id = ?', id)].filter(Boolean),
      debt_payments: await db.getAllAsync('SELECT * FROM debt_payments WHERE debt_id = ?', id),
    };
  }
  if (what === 'person') {
    return {
      people: [await db.getFirstAsync('SELECT * FROM people WHERE id = ?', id)].filter(Boolean),
      debts: await db.getAllAsync('SELECT * FROM debts WHERE person_id = ?', id),
      debt_payments: await db.getAllAsync('SELECT dp.* FROM debt_payments dp JOIN debts d ON d.id = dp.debt_id WHERE d.person_id = ?', id),
    };
  }
  return {};
}

export async function restoreSnapshot(db, snap) {
  await db.withTransactionAsync(async () => {
    for (const table of ['people', 'debts', 'debt_payments', 'transactions']) {
      for (const row of snap[table] || []) {
        const cols = Object.keys(row);
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => row[c])
        );
      }
    }
  });
}

export function photosIn(snap) {
  return [...(snap.transactions || []), ...(snap.debt_payments || [])].map((r) => r.photo).filter(Boolean);
}

export async function getWallets(db) {
  const [starts, flows, outs, ins, debtFlows, payFlows, goalFlows] = await Promise.all([
    db.getAllAsync('SELECT * FROM wallets'),
    db.getAllAsync(`SELECT method, SUM(CASE WHEN kind = 'income' THEN amount ELSE -amount END) AS net, COUNT(*) AS n FROM transactions GROUP BY method`),
    db.getAllAsync('SELECT from_method AS method, SUM(amount + fee) AS total, COUNT(*) AS n FROM transfers GROUP BY from_method'),
    db.getAllAsync('SELECT to_method AS method, SUM(amount) AS total, COUNT(*) AS n FROM transfers GROUP BY to_method'),
    db.getAllAsync(`SELECT method, SUM(CASE WHEN direction = 'owed' THEN -COALESCE(principal, amount) ELSE COALESCE(principal, amount) END) AS net FROM debts WHERE method IS NOT NULL GROUP BY method`),
    db.getAllAsync(`SELECT p.method AS method, SUM(CASE WHEN d.direction = 'owed' THEN p.amount ELSE -p.amount END) AS net FROM debt_payments p JOIN debts d ON d.id = p.debt_id WHERE p.method IS NOT NULL GROUP BY p.method`),
    db.getAllAsync('SELECT method, SUM(-amount) AS net FROM goal_entries WHERE method IS NOT NULL GROUP BY method'),
  ]);
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.key ?? r.method, r]));
  const S = by(starts);
  const F = by(flows);
  const O = by(outs);
  const I = by(ins);
  const D = by(debtFlows);
  const P = by(payFlows);
  const G = by(goalFlows);
  return PAYMENT_METHODS.map((m) => {
    const start = S[m.key]?.start || 0;
    const balance = start + (F[m.key]?.net || 0) - (O[m.key]?.total || 0) + (I[m.key]?.total || 0) + (D[m.key]?.net || 0) + (P[m.key]?.net || 0) + (G[m.key]?.net || 0);
    const used = !!(S[m.key] || F[m.key] || O[m.key] || I[m.key] || D[m.key] || P[m.key] || G[m.key]);
    return { ...m, start, balance, used, hidden: !!S[m.key]?.hidden, setUp: !!S[m.key] };
  });
}

export async function setWalletStart(db, key, start) {
  await db.runAsync(
    'INSERT INTO wallets (key, start) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET start = excluded.start',
    key, start
  );
}

export async function setWalletBalance(db, key, balance) {
  const list = await getWallets(db);
  const w = list.find((x) => x.key === key);
  if (!w) return;
  await setWalletStart(db, key, w.start + (balance - w.balance));
}

export async function addTransfer(db, { from, to, amount, fee = 0, date, note }) {
  const r = await db.runAsync(
    'INSERT INTO transfers (from_method, to_method, amount, fee, date, note) VALUES (?, ?, ?, ?, ?, ?)',
    from, to, amount, fee || 0, date || today(), note || null
  );
  return r.lastInsertRowId;
}

export function listTransfers(db, limit = 30) {
  return db.getAllAsync(`SELECT * FROM transfers ORDER BY date DESC, id DESC LIMIT ${Number(limit)}`);
}

export async function deleteTransfer(db, id) {
  await db.runAsync('DELETE FROM transfers WHERE id = ?', id);
}

export async function listGroups(db) {
  const groups = await db.getAllAsync('SELECT * FROM groups ORDER BY id DESC');
  const members = await db.getAllAsync(
    'SELECT gm.group_id, p.* FROM group_members gm JOIN people p ON p.id = gm.person_id ORDER BY p.name COLLATE NOCASE'
  );
  return groups.map((g) => ({ ...g, members: members.filter((m) => m.group_id === g.id) }));
}

export async function getGroup(db, id) {
  const g = await db.getFirstAsync('SELECT * FROM groups WHERE id = ?', id);
  if (!g) return null;
  const members = await db.getAllAsync(
    'SELECT p.* FROM group_members gm JOIN people p ON p.id = gm.person_id WHERE gm.group_id = ? ORDER BY p.name COLLATE NOCASE',
    id
  );
  return { ...g, members };
}

export async function saveGroup(db, { id, name, emoji, memberNames = [] }) {
  let gid = id;
  await db.withTransactionAsync(async () => {
    if (gid) {
      await db.runAsync('UPDATE groups SET name = ?, emoji = ? WHERE id = ?', name.trim(), emoji || '👯', gid);
      await db.runAsync('DELETE FROM group_members WHERE group_id = ?', gid);
    } else {
      const r = await db.runAsync('INSERT INTO groups (name, emoji) VALUES (?, ?)', name.trim(), emoji || '👯');
      gid = r.lastInsertRowId;
    }
    for (const n of memberNames) {
      if (!n.trim()) continue;
      const pid = await findOrCreatePerson(db, n);
      await db.runAsync('INSERT OR IGNORE INTO group_members (group_id, person_id) VALUES (?, ?)', gid, pid);
    }
  });
  return gid;
}

export async function deleteGroup(db, id) {
  await db.runAsync('DELETE FROM group_members WHERE group_id = ?', id);
  await db.runAsync('DELETE FROM groups WHERE id = ?', id);
}

export async function settleNet(db, personId, date = today()) {
  const debts = (await listDebts(db, { personId })).filter((d) => d.remaining > 0);
  const owe = debts.filter((d) => d.direction === 'owe').sort((a, b) => (a.date < b.date ? -1 : 1));
  const owed = debts.filter((d) => d.direction === 'owed').sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalOwe = owe.reduce((s, d) => s + d.remaining, 0);
  const totalOwed = owed.reduce((s, d) => s + d.remaining, 0);
  let cancel = Math.min(totalOwe, totalOwed);
  if (!cancel) return { cancelled: 0, net: totalOwed - totalOwe };
  await db.withTransactionAsync(async () => {
    for (const list of [owe, owed]) {
      let left = cancel;
      for (const d of list) {
        if (left <= 0) break;
        const pay = Math.min(left, d.remaining);
        await db.runAsync('INSERT INTO debt_payments (debt_id, amount, date, note) VALUES (?, ?, ?, ?)', d.id, pay, date, 'Quits na (net)');
        left -= pay;
      }
    }
  });
  return { cancelled: cancel, net: totalOwed - totalOwe };
}

export async function getTagReport(db, month) {
  const rows = await db.getAllAsync(
    `SELECT note, amount, kind FROM transactions WHERE note LIKE '%#%' AND date >= ? AND date <= ?`,
    `${month}-01`, `${month}-31`
  );
  const map = new Map();
  for (const r of rows) {
    const tags = new Set((r.note.match(/#[A-Za-z0-9_\u00C0-\u024F-]+/g) || []).map((t) => t.toLowerCase()));
    for (const t of tags) {
      const cur = map.get(t) || { tag: t, spent: 0, earned: 0, count: 0 };
      if (r.kind === 'expense') cur.spent += r.amount;
      else cur.earned += r.amount;
      cur.count += 1;
      map.set(t, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}

export async function listTags(db) {
  const rows = await db.getAllAsync(`SELECT note FROM transactions WHERE note LIKE '%#%' ORDER BY date DESC LIMIT 300`);
  const seen = new Map();
  for (const r of rows) for (const t of r.note.match(/#[A-Za-z0-9_\u00C0-\u024F-]+/g) || []) seen.set(t.toLowerCase(), (seen.get(t.toLowerCase()) || 0) + 1);
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 12);
}

export async function getWrapped(db, month) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const prev = shiftMonth(month, -1);
  const t = today();
  const last = t.slice(0, 7) === month ? t : `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
  const days = Number(last.slice(8, 10));
  const q = (sql, ...a) => db.getAllAsync(sql, from, to, ...a);
  const one = (sql) => db.getFirstAsync(sql, from, to).then((r) => r?.total ?? 0);
  const [cats, txCount, biggest, notes, daily, utangPeople, lent, collected, paidOut, saved, splits, spent, income, prevSpent, noSpendMarked] = await Promise.all([
    q(`SELECT COALESCE(c.name, 'Others') AS name, COALESCE(c.emoji, '✨') AS emoji, SUM(t.amount) AS total, COUNT(*) AS count
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.kind = 'expense' AND t.date >= ? AND t.date <= ? GROUP BY c.id ORDER BY total DESC`),
    one("SELECT COUNT(*) AS total FROM transactions WHERE kind = 'expense' AND date >= ? AND date <= ?"),
    db.getFirstAsync(
      `SELECT t.amount, t.note, t.date, COALESCE(c.emoji, '✨') AS emoji, COALESCE(c.name, 'Others') AS category
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.kind = 'expense' AND t.date >= ? AND t.date <= ? ORDER BY t.amount DESC LIMIT 1`,
      from, to
    ),
    q(`SELECT lower(trim(note)) AS k, MIN(trim(note)) AS note, COUNT(*) AS count, SUM(amount) AS total
       FROM transactions WHERE kind = 'expense' AND date >= ? AND date <= ? AND note IS NOT NULL AND trim(note) <> ''
       GROUP BY k HAVING count >= 2 ORDER BY count DESC, total DESC LIMIT 1`),
    q("SELECT date, SUM(amount) AS total FROM transactions WHERE kind = 'expense' AND date >= ? AND date <= ? GROUP BY date"),
    q(`SELECT p.name, p.emoji, SUM(d.amount) AS total FROM debts d JOIN people p ON p.id = d.person_id
       WHERE d.direction = 'owed' AND d.date >= ? AND d.date <= ? GROUP BY p.id ORDER BY total DESC LIMIT 1`),
    one("SELECT COALESCE(SUM(COALESCE(principal, amount)), 0) AS total FROM debts WHERE direction = 'owed' AND date >= ? AND date <= ?"),
    one("SELECT COALESCE(SUM(p.amount), 0) AS total FROM debt_payments p JOIN debts d ON d.id = p.debt_id WHERE d.direction = 'owed' AND p.date >= ? AND p.date <= ? AND COALESCE(p.note, '') <> 'Quits na (net)'"),
    one("SELECT COALESCE(SUM(p.amount), 0) AS total FROM debt_payments p JOIN debts d ON d.id = p.debt_id WHERE d.direction = 'owe' AND p.date >= ? AND p.date <= ? AND COALESCE(p.note, '') <> 'Quits na (net)'"),
    one('SELECT COALESCE(SUM(amount), 0) AS total FROM goal_entries WHERE date >= ? AND date <= ?'),
    one("SELECT COUNT(DISTINCT date || reason) AS total FROM debts WHERE reason LIKE '%hati-hati%' AND date >= ? AND date <= ?"),
    sumBetween(db, 'expense', from, to),
    sumBetween(db, 'income', from, to),
    sumBetween(db, 'expense', `${prev}-01`, `${prev}-31`),
    one('SELECT COUNT(*) AS total FROM no_spend_days WHERE date >= ? AND date <= ?'),
  ]);
  const spentDays = new Set(daily.filter((d) => d.total > 0).map((d) => d.date));
  const zeroDays = Math.max(0, days - spentDays.size);
  const peak = daily.reduce((a, d) => (!a || d.total > a.total ? d : a), null);
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  daily.forEach((d) => { byWeekday[new Date(`${d.date}T00:00:00`).getDay()] += d.total; });
  const wd = byWeekday.indexOf(Math.max(...byWeekday));
  return {
    month,
    days,
    spent,
    income,
    prevSpent,
    txCount,
    perDay: days ? Math.round(spent / days / 100) * 100 : 0,
    categories: cats.slice(0, 3),
    top: cats[0] || null,
    biggest: biggest || null,
    suki: notes[0] || null,
    peak: peak && peak.total > 0 ? peak : null,
    weekday: spent > 0 ? wd : null,
    zeroDays,
    noSpendMarked,
    lent,
    collected,
    paidOut,
    utangero: utangPeople[0] || null,
    saved: Math.max(0, saved),
    splits,
  };
}
