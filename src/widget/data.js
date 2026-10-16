import { Platform } from 'react-native';

const KEY = 'sinop_widget_data';

function storage() {
  return require('@react-native-async-storage/async-storage').default;
}

export async function loadWidgetData() {
  try {
    const raw = await storage().getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function freshen(data) {
  if (!data) return data;
  const t = todayIso();
  const out = { ...data };
  if (out.date !== t) out.spentToday = 0;
  if (out.month !== t.slice(0, 7)) { out.spentMonth = 0; out.usedMonth = 0; }
  return out;
}

export async function updateWidget(summary) {
  if (Platform.OS !== 'android') return;
  try {
    await storage().setItem(KEY, JSON.stringify(summary));
    const { requestWidgetUpdate } = require('react-native-android-widget');
    const React = require('react');
    const { SinopWidget } = require('./SinopWidget');
    await requestWidgetUpdate({
      widgetName: 'Sinop',
      renderWidget: () => React.createElement(SinopWidget, { data: freshen(summary) }),
    });
  } catch {
  }
}
