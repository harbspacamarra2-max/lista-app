import { addDays, today } from './format';
import { parseQuickLog } from './quicklog';

const WEEKDAYS = {
  sunday: 0, sun: 0, linggo: 0,
  monday: 1, mon: 1, lunes: 1,
  tuesday: 2, tue: 2, tues: 2, martes: 2,
  wednesday: 3, wed: 3, miyerkules: 3, miyerkoles: 3,
  thursday: 4, thu: 4, thurs: 4, huwebes: 4,
  friday: 5, fri: 5, biyernes: 5, byernes: 5,
  saturday: 6, sat: 6, sabado: 6,
};

const TITLES = ['tita', 'tito', 'ate', 'kuya', 'lola', 'lolo', 'sir', 'maam', "ma'am", 'mam', 'kumare', 'kumpare', 'pare', 'mare', 'insan', 'tropa', 'bes', 'beh'];

const STOP = new Set([
  'umutang', 'nangutang', 'mangungutang', 'uutang', 'utang', 'inutang', 'nanghiram', 'humiram', 'hiniram', 'hiram', 'pinahiram', 'pinautang', 'nagpautang',
  'borrowed', 'borrow', 'borrows', 'lent', 'lend', 'loan', 'loaned', 'owe', 'owes', 'owed',
  'nagbayad', 'magbabayad', 'bayad', 'binayaran', 'bayaran', 'nabayaran', 'paid', 'pay', 'pays', 'payed', 'nagbalik', 'ibinalik', 'binalik', 'returned', 'repaid', 'settled', 'back',
  'hati', 'hati-hati', 'hatian', 'hinati', 'split', 'kkb', 'share', 'kami', 'tayo', 'sila', 'namin', 'natin',
  'ako', 'ko', 'akin', 'sakin', "sa'kin", 'saken', 'me', 'my', 'i', 'mine', 'you', 'him', 'her',
  'sa', 'si', 'ni', 'kay', 'kina', 'nina', 'sina', 'ng', 'na', 'ay', 'yung', 'ung', 'ang', 'mga', 'pa', 'lang', 'din', 'rin', 'naman', 'po', 'nga', 'daw', 'raw',
  'para', 'pang', 'for', 'the', 'a', 'an', 'to', 'from', 'with', 'and', 'at', 'of', 'on', 'by', 'in', 'pesos', 'peso', 'php', 'worth',
  'due', 'until', 'hanggang', 'bukas', 'tomorrow', 'makalawa', 'next', 'week', 'today', 'ngayon', 'kahapon', 'yesterday', 'kanina', 'katapusan', 'end', 'month',
  'cash', 'gcash', 'maya', 'card', 'bank',
]);

function amountOf(tok) {
  let t = tok.toLowerCase().replace(/^[₱p]/, '').replace(/(php|pesos?)$/, '').replace(/,/g, '');
  let mult = 1;
  if (/k$/.test(t)) {
    mult = 1000;
    t = t.slice(0, -1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t) && !/^\d*\.\d+$/.test(t)) return null;
  const v = parseFloat(t) * mult;
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

function nextWeekday(day) {
  const d = new Date(`${today()}T00:00:00`);
  let diff = (day - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(today(), diff);
}

function endOfMonth() {
  const d = new Date(`${today()}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return addDays(today(), Math.round((last - d) / 86400000));
}

function readDue(low) {
  if (/\b(bukas|tomorrow|tmrw|tom)\b/.test(low)) return addDays(today(), 1);
  if (/\bmakalawa\b/.test(low)) return addDays(today(), 2);
  if (/\bnext week\b|\bsusunod na linggo\b/.test(low)) return addDays(today(), 7);
  if (/\bkatapusan\b|\bend of (the )?month\b/.test(low)) return endOfMonth();
  const m = low.match(/\b(?:sa|on|by|due|until|hanggang|bayad sa|babayaran sa|this|next)\s+(sunday|sun|linggo|monday|mon|lunes|tuesday|tues|tue|martes|wednesday|wed|miyerkules|miyerkoles|thursday|thurs|thu|huwebes|friday|fri|biyernes|byernes|saturday|sat|sabado)\b/);
  if (m) return nextWeekday(WEEKDAYS[m[1]]);
  const n = low.match(/\bin (\d{1,2}) days?\b|\bsa loob ng (\d{1,2}) araw\b/);
  if (n) return addDays(today(), Number(n[1] || n[2]));
  return null;
}

function stripDue(text) {
  return text
    .replace(/\b(bayad|babayaran|due|until|hanggang|by|on|sa)\s+(sa\s+)?(sunday|sun|linggo|monday|mon|lunes|tuesday|tues|tue|martes|wednesday|wed|miyerkules|miyerkoles|thursday|thurs|thu|huwebes|friday|fri|biyernes|byernes|saturday|sat|sabado|bukas|tomorrow|makalawa|katapusan|next week)\b/gi, ' ')
    .replace(/\b(bukas|tomorrow|tmrw|makalawa|next week|end of (the )?month|katapusan)\b/gi, ' ')
    .replace(/\bin \d{1,2} days?\b/gi, ' ');
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nameAt(tokens, i) {
  const t = tokens[i];
  if (!t) return null;
  const low = t.toLowerCase().replace(/[.,!?]/g, '');
  if (!low || STOP.has(low) || amountOf(t) != null) return null;
  if (TITLES.includes(low) && tokens[i + 1] && !STOP.has(tokens[i + 1].toLowerCase()) && amountOf(tokens[i + 1]) == null) {
    return { name: `${cap(low)} ${cap(tokens[i + 1].replace(/[.,!?]/g, ''))}`, used: [i, i + 1] };
  }
  return { name: cap(t.replace(/[.,!?]/g, '')), used: [i] };
}

function nameAfter(tokens, markers) {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (markers.includes(tokens[i].toLowerCase())) {
      const n = nameAt(tokens, i + 1);
      if (n) return n;
    }
  }
  return null;
}

function firstName(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const n = nameAt(tokens, i);
    if (n) return n;
  }
  return null;
}

function leftover(tokens, used) {
  const skip = new Set(used);
  return tokens
    .filter((t, i) => !skip.has(i) && amountOf(t) == null && !STOP.has(t.toLowerCase().replace(/[.,!?]/g, '')))
    .join(' ')
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickAmount(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const a = amountOf(tokens[i]);
    if (a != null) return { amount: a, index: i };
  }
  return { amount: null, index: -1 };
}

function dateWord(low) {
  if (/\b(kahapon|yesterday)\b/.test(low)) return addDays(today(), -1);
  return today();
}

function parseSplit(raw, low, tokens, categories) {
  const { amount } = pickAmount(tokens);
  if (!amount) return null;
  const names = [];
  const used = [];
  let start = tokens.findIndex((t) => ['ni', 'nina', 'with', 'kina', 'sina', 'between'].includes(t.toLowerCase()));
  if (start >= 0) {
    for (let i = start + 1; i < tokens.length; i++) {
      const low2 = tokens[i].toLowerCase().replace(/[,]/g, '');
      if (['at', 'and', '&', ','].includes(low2)) continue;
      if (amountOf(tokens[i]) != null || ['sa', 'for', 'para', 'pang'].includes(low2)) break;
      const n = nameAt(tokens, i);
      if (!n) break;
      names.push(n.name);
      used.push(...n.used);
      i = n.used[n.used.length - 1];
    }
  } else {
    tokens.forEach((t, i) => {
      if (/^[A-Z]/.test(t) && !STOP.has(t.toLowerCase()) && amountOf(t) == null && i > 0) {
        names.push(cap(t.replace(/[.,!?]/g, '')));
        used.push(i);
      }
    });
  }
  if (!names.length) return null;
  const reason = leftover(tokens, used);
  const guess = reason ? parseQuickLog(`${reason} 1`, categories) : null;
  return {
    type: 'split',
    total: amount,
    people: names,
    includeMe: !/\b(sila lang|without me|hindi ako kasama|di ako kasama)\b/.test(low),
    reason: reason ? cap(reason) : '',
    category: guess?.category?.name || 'Food',
    date: dateWord(low),
    dueDate: readDue(low),
  };
}

function parsePayment(raw, low, tokens) {
  const { amount } = pickAmount(tokens);
  let direction = 'owed';
  let who = null;
  if (/\bkay\b/.test(low) || /^(i|ako)\b/.test(low) || /\bi (paid|returned|repaid|settled)\b/.test(low) || /^(paid|binayaran ko|nagbayad ako|bayad ko)\b/.test(low) || /\b(binayaran|nabayaran|binalik|ibinalik) ko\b/.test(low) || /\bnagbayad (na )?ako\b/.test(low)) {
    direction = 'owe';
  }
  if (/\b(binayaran|binalik|ibinalik) (na )?ako ni\b/.test(low) || /\bpaid me\b/.test(low)) direction = 'owed';
  who = nameAfter(tokens, ['kay', 'si', 'ni', 'to', 'paid']) || firstName(tokens);
  if (!who) return null;
  return { type: 'payment', direction, person: who.name, amount: amount || null, date: dateWord(low) };
}

function parseDebt(raw, low, tokens) {
  const { amount } = pickAmount(tokens);
  if (!amount) return null;
  let direction = 'owed';
  if (
    /\b(utang ko|umutang ako|nangutang ako|humiram ako|nanghiram ako|mangungutang ako|uutang ako)\b/.test(low) ||
    /\bi (owe|borrowed|loaned)\b/.test(low) ||
    /\b(lent|pinahiram|pinautang) (ako|me)\b/.test(low) ||
    /\bako (ay )?(umutang|nangutang|humiram|nanghiram)\b/.test(low) ||
    /\bborrowed\b.*\bfrom\b/.test(low) ||
    /\bkay\b/.test(low) ||
    /^owe\b/.test(low)
  ) {
    direction = 'owe';
  }
  if (/\bowes me\b|\bi lent\b|\bpinautang ko\b|\bpinahiram ko\b|\b(umutang|nangutang|humiram|nanghiram) (si|sa akin|sakin|saken)\b/.test(low)) direction = 'owed';
  const who = nameAfter(tokens, ['kay', 'si', 'ni', 'from', 'owe', 'lent', 'kina']) || firstName(tokens);
  if (!who) return null;
  const used = [...who.used];
  const reason = leftover(tokens, used);
  return {
    type: 'debt',
    direction,
    person: who.name,
    amount,
    reason: reason ? cap(reason) : '',
    date: dateWord(raw.toLowerCase()),
    dueDate: readDue(raw.toLowerCase()),
  };
}

export function think(text, categories = []) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const low = raw.toLowerCase();
  const cleaned = stripDue(raw).replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter(Boolean);
  const lc = cleaned.toLowerCase();

  const wallet = (re) => {
    const m = low.match(re);
    return m ? { gc: 'gcash', gcash: 'gcash', maya: 'maya', paymaya: 'maya', bank: 'bank', bpi: 'bank', bdo: 'bank', atm: 'bank', card: 'card', cash: 'cash' }[m[1]] : null;
  };
  const amt = pickAmount(tokens).amount;
  if (amt && /\b(cash ?in|cash-in|nag-?cash ?in|load(ed)? (ko )?(sa )?(gcash|maya))\b/.test(low)) {
    return [{ type: 'transfer', from: 'cash', to: wallet(/\b(gcash|gc|maya|paymaya|bank)\b/) || 'gcash', amount: amt, fee: 0, date: dateWord(low), note: 'Cash in' }];
  }
  if (amt && /\b(cash ?out|cash-out|nag-?cash ?out|withdraw|nag-?withdraw|winithdraw)\b/.test(low)) {
    return [{ type: 'transfer', from: wallet(/\b(gcash|gc|maya|paymaya|bank|bpi|bdo|atm)\b/) || 'gcash', to: 'cash', amount: amt, fee: 0, date: dateWord(low), note: 'Cash out' }];
  }
  const tr = low.match(/\b(?:transfer|move|lipat)\b.*\bfrom (gcash|maya|bank|cash|card)\b.*\bto (gcash|maya|bank|cash|card)\b/);
  if (amt && tr && tr[1] !== tr[2]) {
    return [{ type: 'transfer', from: tr[1], to: tr[2], amount: amt, fee: 0, date: dateWord(low), note: '' }];
  }

  if (/\b(hati|hati-hati|hatian|hinati|split|kkb)\b/.test(low)) {
    const s = parseSplit(raw, low, tokens, categories);
    if (s) return [s];
  }

  const looksPaid =
    /\b(nagbayad|binayaran|nabayaran|paid|repaid|nagbalik|ibinalik|binalik|returned|settled)\b/.test(lc) ||
    (/\bbayad\b/.test(lc) && !/\b(umutang|nangutang|utang|borrow|lent|owe)\b/.test(lc));
  if (looksPaid && !/\b(umutang|nangutang|borrowed|lent)\b/.test(lc)) {
    const p = parsePayment(raw, lc, tokens);
    if (p) return [p];
  }

  if (/\b(umutang|nangutang|mangungutang|uutang|utang|inutang|nanghiram|humiram|hiniram|pinahiram|pinautang|nagpautang|borrowed|borrow|borrows|lent|lend|loan|loaned|owe|owes)\b/.test(lc)) {
    const d = parseDebt(raw, lc, tokens);
    if (d) return [d];
  }

  const q = parseQuickLog(raw, categories);
  if (q && q.amount) {
    return [{
      type: q.kind,
      amount: q.amount,
      category: q.category?.name || null,
      method: q.method,
      date: q.date,
      note: q.note,
    }];
  }
  return [];
}
