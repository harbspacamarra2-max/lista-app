
const last = {};

export function pick(pool, key) {
  const list = Array.isArray(pool) ? pool : QUIPS[pool];
  if (!list || !list.length) return '';
  const k = key || (Array.isArray(pool) ? list[0] : pool);
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[k]) i = (i + 1) % list.length;
  last[k] = i;
  return list[i];
}

export function fill(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

export const QUIPS = {
  borrowButton: [
    'Sino na naman mangungutang? 😭',
    'Oh ano, utang na naman? 🙄',
    'Jusko, utang na naman 😩',
    'Sige na nga, magkano? 😮‍💨',
    'Bangko ba ako? 🏦',
    'Ayan na naman sila 💀',
    'Hulaan ko… utang? 😑',
    'Pautang season na naman 🍂',
    'ATM ba ako? Charot 🏧',
  ],
  oweButton: [
    'Nangutang ka na naman? 🫣',
    'Hiram muna, bayad later 🙏',
    'Utang is life 😭',
    'Sige, isusulat ko na 🫣',
    'Promise babayaran ko 🤞',
  ],
  savedOwed: [
    'Na-lista na! Wag kalimutang maningil 😤',
    'Noted! Babalik din ’yan… sana 🙏',
    'Okay, nakasulat na. Wala nang lusot 📝',
    'Sinulat ko na, para may resibo 🧾',
    'Saved! Pray tayo na magbayad si {name} 🙏',
    'Na-save na. {name}, kita kita sa due date 👀',
  ],
  savedOwe: [
    'Na-lista na. Bayaran mo si {name} ha 😤',
    'Saved! Utang ay utang, bes 🫶',
    'Noted. {name} is watching 👀',
    'Okay! Wag mong takbuhan si {name} 🏃',
  ],
  savedIncome: [
    'Yaman! 💸',
    'Sahod szn 🤑',
    'Sana all may pera 😌',
    'Ka-ching! 💰',
    'Ipon mo ’yan, wag puro milk tea 🧋',
  ],
  bigExpense: [
    'Ay, ang laki! 😳 Sure ka diyan?',
    'Wallet: 💀',
    'RIP pera ko 🪦',
    'Okay lang, deserve mo ’yan… siguro 💅',
  ],
  expenseFood: ['Busog ka na ba? 🍜', 'Kain is life 🍔', 'Diet starts tomorrow 😌', 'Masarap ba? Sana all 🤤'],
  expenseTransport: ['Pamasahe is real 🚌', 'Commute warrior 💪', 'Ingat sa biyahe! 🛺'],
  expenseSchool: ['Para sa future! 📚', 'Investment ’yan, bes 🎓', 'Laban sa acads! ✏️'],
  'expenseLoad & Data': ['Para sa scroll 📱', 'Load muna bago lahat 📶', 'Online ka na ulit 😌'],
  expenseBills: ['Adulting 101 💡', 'Bills, bills, bills 😮‍💨', 'Responsible era ✅'],
  expenseShopping: ['Add to cart ang peg 🛍️', 'Need or want? Joke lang 😆', 'Shopee girlie era 📦'],
  expenseFun: ['Deserve mo ’yan 💅', 'Self-care is important ✨', 'YOLO pero may lista 😌'],
  expenseHealth: ['Health is wealth 💊', 'Pagaling ka! 🫶'],
  expenseOther: ['Okay, noted ✍️', 'Na-lista na! ✅', 'Done! Isa pa? 😆', 'Saved, bestie ✨'],
  paidMe: [
    'Himala! 🙏 Nagbayad si {name}',
    'Si {name}, marunong magbayad! 🫶',
    'Bayad na si {name}! Friends pa rin 🤝',
    'Wow, {name} paid! Sana all 😭',
  ],
  paidThem: [
    'Debt-free ka na kay {name}! 💅',
    'Bayad na! Malinis na konsensya mo 😇',
    'Wala ka nang utang kay {name} 🫶',
  ],
  homeTip: [
    'Ipon muna bago milk tea 🧋',
    'Hindi lahat ng sale ay kailangan 🛍️',
    'Libre mo ako? Joke 😆',
    'Pera mo, rules mo 💅',
    'Small ipon, big dreams ✨',
    'Wag kalimutang maningil today 😤',
    'Budget is a mindset 🧠',
    'Sana all may sweldo 😌',
  ],
  remindIntro: [
    'Hi {name}! 👋 Friendly reminder lang po about your utang:',
    'Hello {name}! 😊 Sorry sa abala, pero paalala lang po sa utang:',
    'Psst, {name}! 👀 Baka nakalimutan mo lang po:',
    'Hi {name}! 🙏 Gentle reminder lang po (wag magalit hehe):',
  ],
  remindOutro: [
    'No pressure, pero sana soon! Salamat 💚',
    'Salamat in advance! 🫶',
    'GCash is okay! Hehe salamat 💙',
    'Kahit hulugan, okay lang! Thank you 🙏',
  ],
};
