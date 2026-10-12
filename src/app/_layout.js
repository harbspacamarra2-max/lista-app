import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
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
import { setupNotifications } from '../lib/notify';

SplashScreen.preventAutoHideAsync().catch(() => {});
setupNotifications();

function AppShell() {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState(null);
  const [locked, setLocked] = useState(null);
  const awayAt = useRef(0);
  const [toastState, setToastState] = useState({ message: null, stamp: 0 });
  const toast = useCallback((message) => setToastState({ message, stamp: Date.now() }), []);

  const refreshSettings = useCallback(async () => {
    setSettings(await getSettings(db));
  }, [db]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (settings && locked === null) setLocked(!!settings.pin);
  }, [settings, locked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') awayAt.current = Date.now();
      if (state === 'active' && awayAt.current && Date.now() - awayAt.current > 30000) {
        getSettings(db).then((s) => {
          if (s.pin) setLocked(true);
        });
      }
    });
    return () => sub.remove();
  }, [db]);

  const forgotPin = () => {
    Alert.alert(
      'Forgot your PIN?',
      'For your privacy, the only way in is to reset Lista. This deletes ALL your data and can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Lista',
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
      bump: () => setVersion((v) => v + 1),
      settings: settings || {},
      refreshSettings,
      toast,
    }),
    [version, settings, refreshSettings, toast]
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
          <Stack.Screen name="goal/[id]" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="settings" />
        </Stack>
        <Toast message={toastState.message} stamp={toastState.stamp} />
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
