import { Platform } from 'react-native';
import Constants from 'expo-constants';

const REPO = 'harbspacamarra2-max/lista-app';

function parse(v) {
  return String(v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

function newer(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return false;
}

export const currentVersion = Constants.expoConfig?.version || '0.0.0';

export async function checkForUpdate() {
  if (Platform.OS !== 'android') return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const rel = await res.json();
    if (!newer(rel.tag_name, currentVersion)) return null;
    const apk = (rel.assets || []).find((a) => a.name.endsWith('.apk'));
    return {
      version: rel.tag_name.replace(/^v/, ''),
      url: apk?.browser_download_url || rel.html_url,
    };
  } catch {
    return null;
  }
}
