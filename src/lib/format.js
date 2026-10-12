
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function withCommas(intString) {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function peso(centavos, { sign = false, decimals } = {}) {
  const value = Math.round(Number(centavos) || 0);
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const showCents = decimals === true || (decimals !== false && cents !== 0);
  let out = '₱' + withCommas(String(whole));
  if (showCents) out += '.' + String(cents).padStart(2, '0');
  if (negative) return '−' + out;
  if (sign && value > 0) return '+' + out;
  return out;
}

export function pesoShort(centavos) {
  const pesos = Math.abs(Number(centavos) || 0) / 100;
  if (pesos >= 1000000) return '₱' + (pesos / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (pesos >= 1000) return '₱' + (pesos / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₱' + Math.round(pesos);
}

export function toCentavos(text) {
  const clean = String(text ?? '').replace(/[^0-9.]/g, '');
  if (!clean) return 0;
  const [whole, frac = ''] = clean.split('.');
  const w = parseInt(whole || '0', 10);
  const f = parseInt((frac + '00').slice(0, 2), 10);
  return w * 100 + f;
}

export function centavosToInput(centavos) {
  if (!centavos) return '';
  const whole = Math.floor(centavos / 100);
  const cents = centavos % 100;
  if (!cents) return String(whole);
  return `${whole}.${String(cents).padStart(2, '0')}`.replace(/0$/, '');
}

export function cleanAmountInput(text) {
  let t = String(text).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = t.indexOf('.');
  if (firstDot !== -1) {
    t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  }
  if (t.startsWith('.')) t = '0' + t;
  t = t.replace(/^0+(\d)/, '$1');
  return t.slice(0, 12);
}

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function today() {
  return toISODate(new Date());
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function monthKey(iso = today()) {
  return String(iso).slice(0, 7);
}

export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(key, long = true) {
  const [y, m] = key.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function monthName(key) {
  const [, m] = key.split('-').map(Number);
  return MONTHS_LONG[m - 1];
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function startOfWeek(iso = today()) {
  const d = parseISODate(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISODate(b) - parseISODate(a)) / 86400000);
}

export function prettyDate(iso, { withYear = false } = {}) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  const d = parseISODate(iso);
  const base = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${base}, ${d.getFullYear()}` : base;
}

export function shortDate(iso) {
  const d = parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function dueLabel(dueIso) {
  if (!dueIso) return null;
  const n = daysBetween(today(), dueIso);
  if (n === 0) return { text: 'Due today', tone: 'warn' };
  if (n === 1) return { text: 'Due tomorrow', tone: 'warn' };
  if (n > 1 && n <= 7) return { text: `Due in ${n} days`, tone: 'warn' };
  if (n > 7) return { text: `Due ${shortDate(dueIso)}`, tone: 'calm' };
  if (n === -1) return { text: '1 day late', tone: 'late' };
  return { text: `${-n} days late`, tone: 'late' };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export { MONTHS, MONTHS_LONG, DAYS };
