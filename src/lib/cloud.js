import { Platform } from 'react-native';
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from './firebase';
import { buildBackup, restoreBackup } from './backup';
import { setSetting } from './db';

const CHUNK = 400000;

function userDoc(uid) {
  return doc(firestore, 'users', uid);
}

export async function getCloudMeta(uid) {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? snap.data() : null;
}

export async function pushToCloud(db, uid) {
  const backup = await buildBackup(db);
  const json = JSON.stringify(backup);
  const parts = [];
  for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
  if (!parts.length) parts.push('');

  const old = await getCloudMeta(uid);
  const updatedAt = Date.now();
  const batch = writeBatch(firestore);
  parts.forEach((d, i) => batch.set(doc(firestore, 'users', uid, 'chunks', String(i)), { d }));
  for (let i = parts.length; i < (old?.chunks || 0); i += 1) {
    batch.delete(doc(firestore, 'users', uid, 'chunks', String(i)));
  }
  batch.set(userDoc(uid), {
    updatedAt,
    chunks: parts.length,
    size: json.length,
    device: Platform.OS,
    format: 1,
  });
  await batch.commit();
  await setSetting(db, 'cloud_synced_at', String(updatedAt));
  return updatedAt;
}

export async function pullFromCloud(db, uid, meta) {
  const m = meta || (await getCloudMeta(uid));
  if (!m) return false;
  const snaps = await getDocs(collection(firestore, 'users', uid, 'chunks'));
  const byId = {};
  snaps.forEach((s) => {
    byId[s.id] = s.data().d || '';
  });
  let json = '';
  for (let i = 0; i < m.chunks; i += 1) json += byId[String(i)] || '';
  const backup = JSON.parse(json);
  await restoreBackup(db, backup);
  await setSetting(db, 'cloud_synced_at', String(m.updatedAt));
  await setSetting(db, 'local_changed_at', String(m.updatedAt));
  return true;
}

export async function hasLocalData(db) {
  const r = await db.getFirstAsync(
    'SELECT (SELECT COUNT(*) FROM transactions) + (SELECT COUNT(*) FROM debts) + (SELECT COUNT(*) FROM goals) AS n'
  );
  return (r?.n || 0) > 0;
}

export function decide({ meta, lastSync, localChanged, hasLocal }) {
  if (!meta) return hasLocal || localChanged ? 'push' : 'none';
  const cloudNewer = meta.updatedAt > lastSync;
  const localNewer = localChanged > lastSync;
  if (cloudNewer && !localNewer) return 'pull';
  if (cloudNewer && localNewer) {
    if (!lastSync && !hasLocal) return 'pull';
    return 'conflict';
  }
  if (localNewer) return 'push';
  return 'none';
}
