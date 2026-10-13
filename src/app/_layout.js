import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, useColorScheme, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { DB_NAME, getSettings, migrate, resetAll, setSetting } from '../lib/db';
import { LockScreen } from '../components/lock';
import { Toast } from '../components/toast';
import { Alert } from '../lib/alert';
import { buildTheme, ThemeContext } from '../lib/theme';
import { DataContext } from '../lib/store';
import { cancelReminder, onNotificationAction, scheduleBillReminder, setupNotifications } from '../lib/notify';
import { getBill, getStreak, markNoSpend, payBill, setBillReminder, todaySummary } from '../lib/db';
import { updateWidget } from '../widget/data';
import { watchUser, signInWithGoogle, signOutEverywhere } from '../lib/firebase';
import { decide, getCloudMeta, hasLocalData, pullFromCloud, pushToCloud } from '../lib/cloud';

SplashScreen.preventAutoHideAsync().catch(() => {});
setupNotifications();

function AppShell() {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState(null);
  const [locked, setLocked] = useState(null);
  const awayAt = useRef(0);
  const [toastState, setToastState] = useState({ message: null, stamp: 0, action: null });
  const toast = useCallback((message, action = null) => setToastState({ message, action, stamp: Date.now() }), []);
  const refreshSettings = useCallback(async () => {
    setSettings(await getSettings(db));
  }, [db]);
  const [user, setUser] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const syncing = useRef(false);
  const pushTimer = useRef(null);
  const userRef = useRef(null);

  useEffect(() => watchUser(async (u) => {
    userRef.current = u;
    setUser(u);
    if (u && Platform.OS === 'web') {
      let pending = null;
      try {
        pending = window.localStorage.getItem('sinop_pending_pin');
        window.localStorage.removeItem('sinop_pending_pin');
      } catch {
      }
      if (pending) {
        await setSetting(db, 'pin', pending);
        refreshSettings();
      }
    }
  }), [db, refreshSettings]);

  const runSync = useCallback(async ({ silent = true } = {}) => {
    const u = userRef.current;
    if (!u || syncing.current) return;
    syncing.current = true;
    setSyncState('syncing');
    try {
      const s = await getSettings(db);
      const meta = await getCloudMeta(u.uid);
      const action = decide({
        meta,
        lastSync: Number(s.cloud_synced_at || 0),
        localChanged: Number(s.local_changed_at || 0),
        hasLocal: await hasLocalData(db),
      });
      if (action === 'push') await pushToCloud(db, u.uid);
      if (action === 'pull') {
        await pullFromCloud(db, u.uid, meta);
        await refreshSettings();
        setVersion((v) => v + 1);
        if (!silent) toast('Synced from the cloud ☁️');
      }
      if (action === 'conflict') {
        await new Promise((resolve) => {
          Alert.alert(
            'Which data should we keep? ☁️',
            `Your cloud backup (from ${new Date(meta.updatedAt).toLocaleString()}) and this device both have changes.`,
            [
              {
                text: 'Keep this device',
                onPress: async () => {
                  await pushToCloud(db, u.uid);
                  resolve();
                },
              },
              {
                text: 'Use cloud data',
                style: 'destructive',
                onPress: async () => {
                  await pullFromCloud(db, u.uid, meta);
                  await refreshSettings();
                  setVersion((v) => v + 1);
                  resolve();
                },
              },
            ]
          );
        });
      }
      if (action === 'push' && !silent) toast('Backed up to the cloud ☁️');
      if (action === 'none' && !silent) toast('All synced ✨');
      await refreshSettings();
      setSyncState('idle');
    } catch (e) {
      setSyncState('error');
      if (!silent) Alert.alert('Sync failed', 'Check your internet and try again.');
    } finally {
      syncing.current = false;
    }
  }, [db, refreshSettings, toast]);

  useEffect(() => {
    if (user && settings) runSync();
  }, [user?.uid, !!settings]);

  const markChanged = useCallback(() => {
    setSetting(db, 'local_changed_at', String(Date.now())).catch(() => {});
    if (!userRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => runSync(), 4000);
  }, [db, runSync]);

  const ready = !!settings;
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    (async () => {
      try {
        const [sum, streak] = await Promise.all([todaySummary(db), getStreak(db)]);
        updateWidget({ ...sum, streak });
      } catch {
      }
    })();
  }, [ready, version]);
  useEffect(() => {
    if (!ready) return undefined;
    return onNotificationAction(async ({ action, isDefault, data }) => {
      try {
        if (data.kind === 'lista-daily-nudge') {
          if (action === 'nospend') {
            await markNoSpend(db);
            setVersion((v) => v + 1);
            markChanged();
            toast('No-spend day logged 😇 Streak saved! 🔥');
          } else {
            setTimeout(() => router.push('/add'), 300);
          }
        } else if (data.kind === 'bill') {
          const bill = data.billId ? await getBill(db, data.billId) : null;
          if (action === 'paid' && bill) {
            const next = await payBill(db, bill);
            await cancelReminder(bill.reminder_id);
            const rid = bill.remind ? await scheduleBillReminder({ date: next, name: bill.name, amount: bill.amount, billId: bill.id }) : null;
            await setBillReminder(db, bill.id, rid);
            setVersion((v) => v + 1);
            markChanged();
            toast(`${bill.emoji} ${bill.name} paid ✅`);
          } else {
            setTimeout(() => router.push('/bills'), 300);
          }
        } else if (data.kind === 'utang' && isDefault) {
          setTimeout(() => router.navigate('/utang'), 300);
        }
      } catch {
      }
    });
  }, [ready]);

  const cloud = useMemo(
    () => ({
      user,
      state: syncState,
      signIn: async () => {
        const u = await signInWithGoogle();
        if (u) toast(`Hi ${u.displayName?.split(' ')[0] || 'there'}! Syncing your data… ☁️`);
        return u;
      },
      signOut: async () => {
        await signOutEverywhere();
        toast('Signed out. Your data stays on this device 👋');
      },
      syncNow: () => runSync({ silent: false }),
    }),
    [user, syncState, runSync, toast]
  );


  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (settings && locked === null) setLocked(!!settings.pin);
  }, [settings, locked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') awayAt.current = Date.now();
      if (state === 'active' && userRef.current) runSync();
      if (state === 'active' && awayAt.current && Date.now() - awayAt.current > 30000) {
        getSettings(db).then((s) => {
          if (s.pin) setLocked(true);
        });
      }
    });
    return () => sub.remove();
  }, [db, runSync]);

  const forgotPin = () => {
    Alert.alert(
      'Forgot your PIN?',
      'For your privacy, the only way in is to reset Sinop. This deletes ALL your data and can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Sinop',
          style: 'destructive',
          onPress: async () => {
            await resetAll(db);
            await setSetting(db, 'pin', null);
            await refreshSettings();
            setLocked(false);
            setVersion((v) => v + 1);
          },
        },
      ]
    );
  };

  const pref = settings?.theme || 'system';
  const accent = settings?.accent || 'matcha';
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const theme = useMemo(() => buildTheme(mode, accent), [mode, accent]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {});
  }, [theme.bg]);

  useEffect(() => {
    if (settings) SplashScreen.hideAsync().catch(() => {});
  }, [settings]);

  const themeValue = useMemo(
    () => ({
      theme,
      pref,
      setPref: async (p) => {
        await setSetting(db, 'theme', p);
        refreshSettings();
      },
      accent,
      setAccent: async (a) => {
        await setSetting(db, 'accent', a);
        refreshSettings();
      },
    }),
    [theme, pref, accent, db, refreshSettings]
  );

  const dataValue = useMemo(
    () => ({
      version,
      bump: () => {
        setVersion((v) => v + 1);
        markChanged();
      },
      settings: settings || {},
      refreshSettings,
      toast,
      cloud,
    }),
    [version, settings, refreshSettings, toast, cloud, markChanged]
  );

  if (!settings) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  return (
    <ThemeContext.Provider value={themeValue}>
      <DataContext.Provider value={dataValue}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="split" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="goals" />
          <Stack.Screen name="bills" />
          <Stack.Screen name="goal/[id]" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="ask" />
          <Stack.Screen name="wallets" />
          <Stack.Screen name="groups" />
          <Stack.Screen name="group/[id]" />
        </Stack>
        <Toast message={toastState.message} stamp={toastState.stamp} action={toastState.action} />
        {locked && settings.pin ? (
          <LockScreen pinHash={settings.pin} useBio={settings.lock_bio === '1'} onUnlock={() => setLocked(false)} onForgot={forgotPin} />
        ) : null}
      </DataContext.Provider>
    </ThemeContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <AppShell />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
