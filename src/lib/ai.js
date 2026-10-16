import Constants from 'expo-constants';
import { today } from './format';

const KEY = String(process.env.EXPO_PUBLIC_GEMINI_KEY || Constants.expoConfig?.extra?.geminiKey || '').trim();
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
let preferred = 0;

export function hasAiKey() {
  return !!KEY;
}

export function aiReady(settings) {
  return !!KEY && settings?.ai_on === '1';
}

class AiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function call(model, body, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiError(json?.error?.message || `HTTP ${res.status}`, res.status);
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
    if (!text) throw new AiError('Empty answer', 'empty');
    return text;
  } catch (e) {
    if (e.name === 'AbortError') throw new AiError('Took too long', 'timeout');
    if (e instanceof AiError) throw e;
    throw new AiError('No internet', 'network');
  } finally {
    clearTimeout(timer);
  }
}

export async function generate({ system, contents, json = true, temperature = 0.2, timeout = 25000 }) {
  if (!KEY) throw new AiError('AI is not set up in this build', 'nokey');
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  let last;
  for (let i = 0; i < MODELS.length; i++) {
    const idx = (preferred + i) % MODELS.length;
    try {
      const text = await call(MODELS[idx], body, timeout);
      preferred = idx;
      return json ? parseJson(text) : text;
    } catch (e) {
      last = e;
      if (e.code === 'network' || e.code === 400 || e.code === 401 || e.code === 403) break;
    }
  }
  throw last;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new AiError('Could not read the answer', 'parse');
  }
}

export function friendlyAiError(e) {
  switch (e?.code) {
    case 'network':
      return 'No internet right now. Try again later 📶';
    case 'timeout':
      return 'The AI took too long. Try again? ⏳';
    case 429:
      return 'Free AI limit reached for now. Try again in a bit 🙏';
    case 'nokey':
      return 'AI isn’t set up in this version.';
    case 400:
    case 401:
    case 403:
      return 'The AI key was rejected. Update the app or check the key.';
    default:
      return 'The AI got confused. Try again or type it differently 😅';
  }
}

const ACTION_RULES = `Return actions as JSON objects. Amounts are in Philippine pesos as numbers (no symbols). Dates are YYYY-MM-DD.
Action types:
- {"type":"expense","amount":120,"category":"<one of the expense categories>","method":"cash|gcash|maya|card|bank","date":"YYYY-MM-DD","note":"short label"}
- {"type":"income","amount":5000,"category":"<one of the income categories>","method":"cash|gcash|maya|card|bank","date":"YYYY-MM-DD","note":"short label"}
- {"type":"debt","direction":"owed|owe","person":"Name","amount":350,"reason":"short reason or empty","method":"cash|gcash|maya|card|bank","date":"YYYY-MM-DD","dueDate":"YYYY-MM-DD or null"}
  "owed" = the other person borrowed from the user (they owe the user). "owe" = the user borrowed (the user owes them).
- {"type":"payment","direction":"owed|owe","person":"Name","amount":200 or null for full,"method":"cash|gcash|maya|card|bank or null if not said"}
  "owed" = the person paid the user back. "owe" = the user paid the person back.
- {"type":"split","total":900,"people":["Ana","Ben"],"includeMe":true,"reason":"Samgyup","category":"Food","method":"cash|gcash|maya|card|bank","dueDate":null}
  A bill split equally; the listed people each owe the user their share. includeMe false if the user is not part of the split.
- {"type":"transfer","from":"cash|gcash|maya|card|bank","to":"cash|gcash|maya|card|bank","amount":500,"fee":15 or 0,"note":"short"}
  Moving the user's own money between wallets: "cash in GCash 500" = cash to gcash, "cash out 1000 sa GCash" = gcash to cash, "withdraw sa ATM" = bank to cash. Not an expense.
Notes may include #tags if the user wrote them (keep them as written).
Filipino/Taglish hints: "umutang si X"/"X umutang"/"nangutang si X"/"pinautang ko si X" = debt owed. "utang ko kay X"/"umutang ako kay X"/"humiram ako kay X" = debt owe. "nagbayad si X"/"binayaran ako ni X" = payment owed. "binayaran ko si X"/"nagbayad ako kay X" = payment owe. "hati"/"hati-hati"/"split"/"KKB" = split. "bukas" = tomorrow, "kahapon" = yesterday, "sa Friday"/"bayad sa Friday" = due on the coming Friday, "katapusan" = end of month, "sahod"/"sweldo" = salary, "baon"/"allowance" = allowance, "1.2k" = 1200.
Use names exactly as written; match to a known person when it's clearly the same person. Never invent amounts. Pick the closest existing category.`;

function contextLine({ categories = [], people = [] }) {
  const exp = categories.filter((c) => c.kind === 'expense').map((c) => c.name).join(', ');
  const inc = categories.filter((c) => c.kind === 'income').map((c) => c.name).join(', ');
  const ppl = people.map((p) => p.name).slice(0, 80).join(', ') || 'none yet';
  const d = new Date(`${today()}T00:00:00`);
  const dow = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `Today is ${today()} (${dow}). Expense categories: ${exp}. Income categories: ${inc}. Known people: ${ppl}.`;
}

function toCentavos(n) {
  const v = Number(String(n ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeActions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const date = ISO.test(a.date || '') ? a.date : today();
      const dueDate = ISO.test(a.dueDate || '') ? a.dueDate : null;
      const method = ['cash', 'gcash', 'maya', 'card', 'bank'].includes(String(a.method || '').toLowerCase()) ? String(a.method).toLowerCase() : 'cash';
      switch (a.type) {
        case 'expense':
        case 'income':
          return { type: a.type, amount: toCentavos(a.amount), category: a.category || null, method, date, note: String(a.note || '').slice(0, 60) };
        case 'debt':
          return { type: 'debt', direction: a.direction === 'owe' ? 'owe' : 'owed', person: String(a.person || '').trim(), amount: toCentavos(a.amount), reason: String(a.reason || '').slice(0, 80), method, date, dueDate };
        case 'payment':
          return { type: 'payment', direction: a.direction === 'owe' ? 'owe' : 'owed', person: String(a.person || '').trim(), amount: toCentavos(a.amount), method: ['cash', 'gcash', 'maya', 'card', 'bank'].includes(String(a.method || '').toLowerCase()) ? String(a.method).toLowerCase() : undefined, date };
        case 'transfer':
          return {
            type: 'transfer',
            from: ['cash', 'gcash', 'maya', 'card', 'bank'].includes(a.from) ? a.from : 'cash',
            to: ['cash', 'gcash', 'maya', 'card', 'bank'].includes(a.to) ? a.to : 'gcash',
            amount: toCentavos(a.amount),
            fee: toCentavos(a.fee) || 0,
            date,
            note: String(a.note || '').slice(0, 40),
          };
        case 'split':
          return {
            type: 'split',
            total: toCentavos(a.total),
            people: (Array.isArray(a.people) ? a.people : []).map((p) => String(p).trim()).filter(Boolean),
            includeMe: a.includeMe !== false,
            reason: String(a.reason || '').slice(0, 60),
            category: a.category || 'Food',
            method,
            date,
            dueDate,
          };
        default:
          return null;
      }
    })
    .filter(Boolean);
}

export async function aiUnderstand(text, ctx) {
  const out = await generate({
    system: `You are Sinop, a friendly Filipino expense and utang (debt) tracker. Turn what the user typed into actions to save.
${ACTION_RULES}
${contextLine(ctx)}
Respond with JSON only: {"actions":[...],"reply":"one short friendly Taglish line"}. If nothing can be logged, return {"actions":[],"reply":"short question asking what they meant"}.`,
    contents: [{ role: 'user', parts: [{ text }] }],
  });
  return { actions: normalizeActions(out?.actions), reply: String(out?.reply || '') };
}

export async function aiScan(base64, ctx) {
  const out = await generate({
    system: `You are Sinop, a Filipino expense tracker. Read the image (a receipt, GCash/Maya screenshot, bank transfer, or bill) and return what should be logged.
${ACTION_RULES}
${contextLine(ctx)}
Rules for images: a store receipt = one expense with the TOTAL amount and the store as the note. A GCash/Maya "sent money" screenshot = an expense with method gcash/maya, unless the recipient is clearly a known person the user owes, then a payment with direction "owe". "Received money" = income, or a payment with direction "owed" if the sender is a known person who owes the user. Use the date on the image if visible.
Respond with JSON only: {"actions":[...],"reply":"one short friendly Taglish line about what you found"}.`,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: 'Log this please.' }] }],
    timeout: 40000,
  });
  return { actions: normalizeActions(out?.actions), reply: String(out?.reply || '') };
}

export async function aiChat(history, snapshot, ctx, persona) {
  const out = await generate({
    system: `${persona || 'You are Sinop, a warm, funny, Gen Z Filipino money buddy inside an expense and utang tracker app. Answer in the same language the user uses (English, Filipino, or Taglish). Keep answers short (under 120 words), use ₱ amounts, and be honest and practical. Light humor is welcome; never shame the user.'}
You can see the user's data below. Only use these numbers; if something isn't in the data, say you can't see it.
If the user asks you to log, add, record, or save something, include it in "actions" (they confirm it before saving).
${ACTION_RULES}
${contextLine(ctx)}

USER DATA:
${snapshot}

Respond with JSON only: {"reply":"your answer","actions":[]}.`,
    contents: history.map((m) => ({ role: m.role === 'me' ? 'user' : 'model', parts: [{ text: m.text }] })),
    temperature: persona ? 0.8 : 0.6,
  });
  return { reply: String(out?.reply || '').trim(), actions: normalizeActions(out?.actions) };
}

export async function aiTips(snapshot, monthLabel) {
  const out = await generate({
    system: `You are Sinop, a friendly Filipino money buddy. Look at the user's spending for ${monthLabel} and give exactly 3 short, specific, practical tips (each under 25 words, Taglish ok, one emoji at the start). Point out real patterns from the numbers. No shaming. Respond with JSON only: {"tips":["...","...","..."]}.`,
    contents: [{ role: 'user', parts: [{ text: snapshot }] }],
    temperature: 0.7,
  });
  return (Array.isArray(out?.tips) ? out.tips : []).map(String).filter(Boolean).slice(0, 3);
}
