import { monthName, peso, prettyDate, shiftMonth } from './format';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERSONAS = {
  food: { emoji: '🍜', title: 'Certified Lamon Lord', jokes: ['Busog ka, pero ang wallet mo? Gutom na gutom.', 'Diet starts Monday. Which Monday? Walang nakakaalam. 🍗', 'Kain is life. Ipon is… later na lang. 🍜'] },
  transport: { emoji: '🚌', title: 'Professional Commuter', jokes: ['Ikaw na ang may loyalty card sa jeep. Sana all may points.', 'Ang dami mong biyahe, pwede ka nang mag-apply na konduktor. 🚌', '“Para po!” is your love language. 🛑'] },
  school: { emoji: '📚', title: 'Iskolar ng Gastos', jokes: ['Education is an investment daw. Kailan kaya ang ROI? 🎓', 'Photocopy, project, contribution… school is a subscription. 📚', 'Ang dami mong binayaran, dapat may diploma ka na sa gastos. 🎓'] },
  'load & data': { emoji: '📱', title: 'Chronically Online', jokes: ['Ang data mo, mas mahal pa sa ulam mo. 📶', 'Offline ka? Imposible. Hindi ’yan sa’yo nangyayari. 📱', 'Scroll now, iyak later. 🫠'] },
  bills: { emoji: '💡', title: 'Responsible Adult™', jokes: ['Bills, bills, bills. Adulting hits different. 🥲', 'Meralco knows you better than your crush. 💡', 'Bayad ka nang bayad, pero sino ang nagbabayad sa’yo? 😭'] },
  shopping: { emoji: '🛍️', title: 'Add to Cart Royalty', jokes: ['Checkout button: pagod na. Ang courier: kilala ka na. 🛒', '“Libre shipping naman.” — famous last words. 📦', 'Hindi ka nag-shopping. Nag-invest ka sa happiness. Sige. 🛍️'] },
  fun: { emoji: '🎮', title: 'Main Character Energy', jokes: ['Life is short, sabi mo. Ang budget mo, mas short. 🎉', 'YOLO ka nga, pero ang wallet mo, YOLO-ng-YOLO na. 🎢', 'Happiness is priceless. Pero may resibo pa rin. 🎮'] },
  health: { emoji: '💊', title: 'Wellness Era', jokes: ['Health is wealth. Literal, kasi doon napunta ang wealth mo. 💪', 'Healthy ka na, pero ang wallet mo, nasa ICU. 🏥', 'Vitamins: check. Ipon: kailangan din ng vitamins. 💊'] },
};
const MYSTERY = { emoji: '✨', title: 'Mystery Spender', jokes: ['“Others” ang top category mo. Ano ’yon? Secret? 🤫', 'Saan napunta? Hindi namin alam. Ikaw lang at ang Diyos. 🙏'] };

const pick = (list, seed) => list[Math.abs(seed) % list.length];

export function personaFor(top) {
  if (!top) return MYSTERY;
  return PERSONAS[String(top.name || '').toLowerCase()] || MYSTERY;
}

export function hasWrapped(d) {
  return !!d && (d.spent > 0 || d.income > 0 || d.lent > 0 || d.collected > 0 || d.saved > 0);
}

export function buildSlides(d, name) {
  const M = monthName(d.month);
  const prevM = monthName(shiftMonth(d.month, -1));
  const seed = d.spent + d.txCount * 7 + d.days;
  const who = name ? name.split(' ')[0] : 'bestie';
  const slides = [];

  slides.push({
    key: 'intro',
    palette: ['#FF3CAC', '#784BA0', '#2B86C5'],
    stickers: ['🎁', '💸', '✨'],
    kicker: 'SINOP WRAPPED',
    title: `Your ${M}`,
    titleItalic: 'in pesos.',
    body: pick([
      `Hi ${who}! Sinop saw everything. Lahat. 👀`,
      `Ready ka na ba, ${who}? Kasi ang wallet mo, hindi. 😭`,
      `${who}, upo ka muna. May pag-uusapan tayo. 🫣`,
    ], seed),
    hint: 'Tap to continue →',
  });

  let change;
  if (d.prevSpent > 0) {
    const pct = Math.round(((d.spent - d.prevSpent) / d.prevSpent) * 100);
    if (pct > 10) change = `Up ${pct}% from ${prevM}. Inflation ba ’yan, o ikaw? 😭`;
    else if (pct < -10) change = `Down ${-pct}% from ${prevM}. Sino ka, at nasaan ang dating ikaw? 🥹`;
    else change = `Halos same lang sa ${prevM}. Consistent ka, at least. 🫡`;
  } else {
    change = 'First Wrapped mo ’to! Your wallet will remember this. 🫠';
  }
  slides.push({
    key: 'spent',
    palette: ['#FF5F6D', '#FFC371'],
    stickers: ['💸', '🧾', '😵‍💫'],
    kicker: 'THIS MONTH, YOU SPENT',
    amount: d.spent,
    body: `That’s ${peso(d.perDay)} a day, across ${d.txCount} ${d.txCount === 1 ? 'gastos' : 'gastos'}.`,
    joke: change,
  });

  if (d.spent >= 5000) {
    const n = (price) => Math.floor(d.spent / price);
    const items = [
      ['🧋', 'milk teas', 12000],
      ['🚌', 'jeep rides', 1300],
      ['🍗', 'Chickenjoy meals', 9900],
      ['🍚', 'cups of rice', 2000],
      ['🍦', 'McFloats', 3900],
    ].filter(([, , price]) => n(price) >= 1);
    slides.push({
      key: 'convert',
      palette: ['#F7FF00', '#DB36A4'],
      dark: true,
      stickers: ['🧋', '🍗', '🚌'],
      kicker: 'IN OTHER WORDS, THAT’S…',
      rows2: items.slice(0, 4).map(([e, label, price]) => [e, n(price).toLocaleString('en-PH'), label]),
      joke: pick([
        'Isipin mo na lang: ang dami mong napasaya na tindero. 🥹',
        'Hindi namin sinasabing mali ka. Sinasabi lang ng math. 🧮',
        'Or one very tired wallet. Pick your fighter. 💀',
      ], seed),
    });
  }

  if (d.top) {
    const p = personaFor(d.top);
    slides.push({
      key: 'persona',
      palette: ['#8E2DE2', '#4A00E0'],
      stickers: [p.emoji, '🏆', '⭐'],
      kicker: 'YOUR SPENDING PERSONALITY',
      bigEmoji: p.emoji,
      title: p.title,
      body: `${peso(d.top.total)} on ${d.top.name}, ${d.top.count} ${d.top.count === 1 ? 'time' : 'times'}.`,
      joke: pick(p.jokes, seed),
      bars: d.categories,
    });
  }

  if (d.suki) {
    const c = d.suki.count;
    slides.push({
      key: 'suki',
      palette: ['#00C9A7', '#0081CF'],
      stickers: ['🫶', '🔁', '🏪'],
      kicker: 'YOUR #1 SUKI',
      quote: d.suki.note,
      body: `${c} times · ${peso(d.suki.total)} total`,
      joke: c >= 8
        ? 'At this point, mag-apply ka na lang doon. May employee discount pa. 😭'
        : c >= 4
          ? `${c} times? Kabisado na nila order mo. Loyal ka talaga. 🫶`
          : 'Small loyalty era. Cute. 🥹',
    });
  }

  if (d.biggest) {
    slides.push({
      key: 'biggest',
      palette: ['#F83600', '#F9D423'],
      dark: true,
      stickers: [d.biggest.emoji, '💀', '💳'],
      kicker: 'YOUR MOST ICONIC PURCHASE',
      bigEmoji: d.biggest.emoji,
      quote: d.biggest.note || d.biggest.category,
      amountSmall: d.biggest.amount,
      body: prettyDate(d.biggest.date) === 'Today' ? 'today mismo. Ang tapang. 😳' : `on ${prettyDate(d.biggest.date)}`,
      joke: pick(['Worth it? Huwag mo nang sagutin. 💅', 'Sana masaya ka. Sana. 🙏', 'Ang wallet mo, nag-flatline sa araw na ’yan. 💀'], seed),
    });
  }

  if (d.peak) {
    const wdJoke = {
      0: 'Sunday family day = Sunday gastos day. 🍗',
      1: 'Monday blues? More like Monday dues. 😩',
      5: 'Friday energy, kahit hindi payday. 🍻',
      6: 'Weekend ka lang, pero ang gastos mo, pang-buong linggo. 🛍️',
    }[d.weekday] || 'Mid-week pa lang, pero ang wallet mo, weekend na. 😵';
    slides.push({
      key: 'peak',
      palette: ['#FC466B', '#3F5EFB'],
      stickers: ['🌪️', '📆', '🔥'],
      kicker: 'YOUR MOST CHAOTIC DAY',
      title: prettyDate(d.peak.date),
      amountSmall: d.peak.total,
      body: d.weekday != null ? `${WEEKDAYS[d.weekday]}s are your weakness.` : '',
      joke: wdJoke,
    });
  }

  const ratio = d.days ? d.zeroDays / d.days : 0;
  slides.push({
    key: 'zero',
    palette: ['#0F2027', '#203A43', '#2C5364'],
    stickers: ['😇', '🧘', '🪙'],
    kicker: 'DAYS YOU SPENT EXACTLY ₱0',
    count: d.zeroDays,
    body: `out of ${d.days} days`,
    joke: d.zeroDays === 0
      ? 'Zero. Wala. Nada. Hindi mo talaga kayang hindi gumastos, ’no? 😭'
      : ratio >= 0.4
        ? 'Ipon royalty! 👑 Nakahinga nang maluwag ang wallet mo.'
        : ratio >= 0.15
          ? 'Not bad! May rest days din pala ang wallet mo. 😌'
          : 'Ilang araw lang? Pagod na ang wallet mo, bestie. 😮‍💨',
  });

  if (d.lent || d.collected || d.paidOut) {
    slides.push({
      key: 'utang',
      palette: ['#11998E', '#38EF7D'],
      dark: true,
      stickers: ['🤝', '🧾', '😤'],
      kicker: 'UTANG REPORT',
      rows: [
        ['🤑 Lent out', d.lent],
        ['💰 Collected', d.collected],
        ['🫣 You paid back', d.paidOut],
      ],
      body: d.splits ? `${d.splits} hati-hati ${d.splits === 1 ? 'session' : 'sessions'}. KKB is a lifestyle. 🍕` : '',
      joke: d.utangero
        ? `Top utangero: ${d.utangero.emoji} ${d.utangero.name}. Singilin mo na. Sabihin mo galing sa Sinop. 😤`
        : 'Walang utangero this month. Rare. Protect this peace. 🕊️',
    });
  }

  if (d.saved > 0) {
    slides.push({
      key: 'ipon',
      palette: ['#F7971E', '#FFD200'],
      dark: true,
      stickers: ['🐷', '🪙', '🌱'],
      kicker: 'YOU PUT INTO IPON',
      amount: d.saved,
      joke: pick(['Future you says: salamat, idol. 🫶', 'Ang alkansya mo, proud sa’yo. 🐷', 'Slowly but surely. Yayaman din tayo. 🌱'], seed),
    });
  }

  slides.push({ key: 'summary', palette: ['#141414', '#262626'], summary: true });
  return slides;
}

export function summaryLines(d) {
  const p = personaFor(d.top);
  return {
    persona: p,
    rows: [
      ['Spent', peso(d.spent)],
      ['Top category', d.top ? `${d.top.emoji} ${d.top.name}` : '—'],
      ['#1 suki', d.suki ? `${d.suki.note} (${d.suki.count}x)` : '—'],
      ['₱0 days', `${d.zeroDays} of ${d.days}`],
      ['Biggest gastos', d.biggest ? peso(d.biggest.amount) : '—'],
      ['Ipon', d.saved ? peso(d.saved) : '—'],
    ],
  };
}

export function shareText(d) {
  const s = summaryLines(d);
  return [
    `My ${monthName(d.month)} Sinop Wrapped 🎁`,
    `${s.persona.emoji} ${s.persona.title}`,
    ...s.rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Track your gastos with Sinop 💚',
  ].join('\n');
}
