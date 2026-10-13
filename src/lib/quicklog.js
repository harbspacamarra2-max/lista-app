import { addDays, today } from './format';

const METHOD_WORDS = {
  gcash: 'gcash', gc: 'gcash',
  maya: 'maya', paymaya: 'maya',
  card: 'card', credit: 'card', debit: 'card',
  bank: 'bank', bpi: 'bank', bdo: 'bank', metrobank: 'bank', unionbank: 'bank', gotyme: 'bank', seabank: 'bank',
  cash: 'cash', kash: 'cash',
};

const CATEGORY_WORDS = {
  Food: ['food', 'kain', 'kumain', 'lunch', 'dinner', 'breakfast', 'merienda', 'snack', 'snacks', 'ulam', 'rice', 'jollibee', 'jabee', 'mcdo', 'mcdonalds', 'kfc', 'chowking', 'mang inasal', 'inasal', 'samgyup', 'pizza', 'burger', 'milktea', 'milk tea', 'coffee', 'kape', 'starbucks', 'tea', 'boba', 'grocery', 'groceries', 'palengke', 'foodpanda', 'grabfood', 'shawarma', 'siomai', 'fishball', 'kwek', 'tusok', 'ice cream', 'dessert', 'bread', 'tinapay', 'water', 'tubig'],
  Transport: ['jeep', 'jeepney', 'trike', 'tricycle', 'grab', 'angkas', 'joyride', 'move it', 'moveit', 'mrt', 'lrt', 'bus', 'taxi', 'uv', 'fx', 'gas', 'gasolina', 'pamasahe', 'fare', 'toll', 'parking', 'commute', 'p2p', 'beep'],
  School: ['school', 'tuition', 'book', 'books', 'libro', 'print', 'printing', 'xerox', 'photocopy', 'project', 'notebook', 'pen', 'supplies', 'uniform', 'org', 'fee', 'fees'],
  'Load & Data': ['load', 'data', 'gosurf', 'gigaa', 'giga', 'globe', 'smart', 'tnt', 'dito', 'tm', 'promo', 'unli'],
  Bills: ['bill', 'bills', 'meralco', 'kuryente', 'electric', 'electricity', 'maynilad', 'manila water', 'internet', 'wifi', 'pldt', 'converge', 'sky', 'rent', 'upa', 'dorm', 'boarding'],
  Shopping: ['shopee', 'lazada', 'tiktok shop', 'shirt', 'shoes', 'clothes', 'damit', 'sapatos', 'bag', 'makeup', 'skincare', 'uniqlo', 'shein', 'order'],
  Fun: ['netflix', 'spotify', 'youtube', 'disney', 'movie', 'movies', 'sine', 'cinema', 'game', 'games', 'steam', 'valorant', 'ml', 'diamonds', 'concert', 'ticket', 'karaoke', 'gala', 'inom', 'bar', 'date'],
  Health: ['medicine', 'gamot', 'doctor', 'checkup', 'check-up', 'vitamins', 'dentist', 'clinic', 'hospital', 'pharmacy', 'mercury', 'watsons', 'gym'],
};

const INCOME_WORDS = ['sahod', 'salary', 'sweldo', 'allowance', 'baon', 'income', 'received', 'natanggap', 'bonus', 'commission', 'sideline', 'raket', 'padala', 'tip', 'tips', 'refund', 'cashback'];

const DATE_WORDS = {
  today: 0, ngayon: 0, kanina: 0,
  yesterday: -1, kahapon: -1,
};

function parseAmount(token) {
  let t = token.toLowerCase().replace(/^[₱p]/, '').replace(/php$/, '').replace(/,/g, '');
  let mult = 1;
  if (/k$/.test(t)) {
    mult = 1000;
    t = t.slice(0, -1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t) && !/^\d*\.\d+$/.test(t)) return null;
  const v = parseFloat(t) * mult;
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseQuickLog(text, categories = []) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/);
  let amount = null;
  let method = null;
  let dateOffset = null;
  const words = [];

  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (amount == null) {
      const a = parseAmount(tok);
      if (a != null) {
        amount = a;
        continue;
      }
    }
    if (!method && METHOD_WORDS[low]) {
      method = METHOD_WORDS[low];
      continue;
    }
    if (dateOffset == null && low in DATE_WORDS) {
      dateOffset = DATE_WORDS[low];
      continue;
    }
    if (['sa', 'for', 'via', 'using', 'thru', 'through', 'ng', 'ang'].includes(low)) continue;
    words.push(tok);
  }

  const noteText = words.join(' ').trim();
  const lowNote = ` ${noteText.toLowerCase()} `;
  const kind = INCOME_WORDS.some((w) => lowNote.includes(` ${w} `)) ? 'income' : 'expense';

  let category = null;
  const pool = categories.filter((c) => c.kind === kind);
  category = pool.find((c) => lowNote.includes(` ${c.name.toLowerCase()} `)) || null;
  if (!category && kind === 'expense') {
    for (const [name, list] of Object.entries(CATEGORY_WORDS)) {
      if (list.some((w) => lowNote.includes(` ${w} `) || lowNote.includes(` ${w}s `))) {
        category = pool.find((c) => c.name === name) || null;
        if (category) break;
      }
    }
  }
  if (!category && kind === 'income') {
    const map = { allowance: 'Allowance', baon: 'Allowance', sahod: 'Salary', salary: 'Salary', sweldo: 'Salary', sideline: 'Side hustle', raket: 'Side hustle', commission: 'Side hustle' };
    const hit = Object.keys(map).find((w) => lowNote.includes(` ${w} `));
    if (hit) category = pool.find((c) => c.name === map[hit]) || null;
  }
  if (!category) category = pool.find((c) => c.name === 'Others') || pool[0] || null;

  return {
    kind,
    amount,
    method: method || 'cash',
    date: dateOffset ? addDays(today(), dateOffset) : today(),
    note: noteText ? titleCase(noteText) : category?.name || '',
    category,
  };
}
