import { Platform } from 'react-native';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { currentVersion } from './updates';

export const DEV_EMAIL = 'harbs.pacamarra2@gmail.com';

export const FEEDBACK_KINDS = [
  { key: 'bug', emoji: '🐞', label: 'Something’s broken' },
  { key: 'idea', emoji: '💡', label: 'I have an idea' },
  { key: 'confusing', emoji: '😕', label: 'It’s confusing' },
  { key: 'love', emoji: '💚', label: 'I love it' },
];

export const RATINGS = [
  { value: 1, emoji: '😫', label: 'Hate it' },
  { value: 2, emoji: '🙁', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😍', label: 'Love it' },
];

export function isDeveloper(user) {
  return !!user && String(user.email || '').toLowerCase() === DEV_EMAIL;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function sendFeedback({ rating, kind, message, contact, user }) {
  const entry = {
    rating: rating || 0,
    kind: kind || 'idea',
    message: String(message || '').trim().slice(0, 2000),
    contact: String(contact || '').trim().slice(0, 120),
    version: currentVersion,
    platform: Platform.OS,
    uid: user?.uid || '',
    createdAt: serverTimestamp(),
  };
  await withTimeout(addDoc(collection(firestore, 'feedback'), entry), 15000);
}

export async function listFeedback() {
  const snap = await getDocs(query(collection(firestore, 'feedback'), orderBy('createdAt', 'desc'), limit(200)));
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, at: data.createdAt?.toMillis ? data.createdAt.toMillis() : null };
  });
}

export function setFeedbackDone(id, done) {
  return updateDoc(doc(firestore, 'feedback', id), { status: done ? 'done' : '' });
}

export function removeFeedback(id) {
  return deleteDoc(doc(firestore, 'feedback', id));
}
