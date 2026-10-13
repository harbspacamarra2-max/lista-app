import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { today } from './format';

const TABLES = ['categories', 'people', 'transactions', 'debts', 'debt_payments', 'goals', 'goal_entries'];
const SKIP_SETTINGS = ['pin', 'lock_bio', 'cloud_synced_at', 'local_changed_at', 'last_backup'];

export async function buildBackup(db) {
  const data = {};
  for (const t of TABLES) data[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  const settings = await db.getAllAsync('SELECT key, value FROM settings');
  data.settings = settings.filter((s) => !SKIP_SETTINGS.includes(s.key));
  return { app: 'sinop', format: 1, exportedAt: new Date().toISOString(), data };
}

export async function exportBackup(db) {
  const backup = await buildBackup(db);
  const json = JSON.stringify(backup);
  const name = `sinop-backup-${today()}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Sinop backup' });
  }
  return true;
}

async function readPicked(asset) {
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    const res = await fetch(asset.uri);
    return res.text();
  }
  const { File } = require('expo-file-system');
  return new File(asset.uri).text();
}

export async function pickBackup() {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const text = await readPicked(res.assets[0]);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Sinop backup.');
  }
  if (!parsed || !['sinop', 'lista'].includes(parsed.app) || !parsed.data) throw new Error('That file isn’t a Sinop backup.');
  return parsed;
}

export function backupSummary(backup) {
  const d = backup.data || {};
  return {
    date: (backup.exportedAt || '').slice(0, 10),
    transactions: (d.transactions || []).length,
    debts: (d.debts || []).length,
    goals: (d.goals || []).length,
  };
}

async function insertRows(db, table, rows) {
  for (const row of rows || []) {
    const cols = Object.keys(row);
    if (!cols.length) continue;
    const marks = cols.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${marks})`,
      ...cols.map((c) => row[c])
    );
  }
}

export async function restoreBackup(db, backup) {
  const d = backup.data;
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM goal_entries; DELETE FROM goals;
      DELETE FROM debt_payments; DELETE FROM debts; DELETE FROM people;
      DELETE FROM transactions; DELETE FROM categories;
    `);
    for (const t of TABLES) await insertRows(db, t, d[t]);
    for (const s of d.settings || []) {
      if (SKIP_SETTINGS.includes(s.key)) continue;
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        s.key, s.value
      );
    }
  });
}
