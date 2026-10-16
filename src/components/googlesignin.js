import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '../lib/db';
import { useData } from '../lib/store';
import { Alert } from '../lib/alert';
import { Button, Sheet, Txt, tap } from './ui';
import { PinPad, hashPin } from './lock';

export const NEED_PIN_KEY = 'sinop_need_pin';

function flag(key, value) {
  if (Platform.OS !== 'web') return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
  }
}

export function PinSetupSheet({ visible, onClose, title = 'One more step: create your PIN 🔒', note }) {
  const db = useSQLiteContext();
  const { refreshSettings, toast } = useData();
  const [step, setStep] = useState({ first: null, error: 0 });

  const close = () => {
    setStep({ first: null, error: 0 });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <View style={{ alignItems: 'center' }}>
        <Txt size={13.5} color="sub" center style={{ marginBottom: 6 }}>
          {note || 'You’re signed in! Now pick a 4-digit PIN. Sinop will ask for it every time you open the app, so only you can see your money.'}
        </Txt>
        <Txt w={700} size={15} color={step.error ? 'red' : 'text'} style={{ marginBottom: 18 }}>
          {step.error ? 'PINs didn’t match, try again 🙈' : step.first ? 'Type it again to confirm' : 'Choose your PIN'}
        </Txt>
        <PinPad
          error={step.error}
          onComplete={async (pin) => {
            if (!step.first) {
              setStep((s) => ({ ...s, first: pin }));
              return;
            }
            if (pin !== step.first) {
              setStep((s) => ({ ...s, first: null, error: s.error + 1 }));
              return;
            }
            tap('success');
            await setSetting(db, 'pin', hashPin(pin));
            await refreshSettings();
            close();
            toast('PIN saved 🔒 Safe na ang Sinop mo!');
          }}
        />
        <Txt size={12} color="faint" center style={{ marginTop: 16 }}>You can change or remove it anytime in Settings.</Txt>
      </View>
    </Sheet>
  );
}

export function GoogleSignInButton({ title = 'Sign in with Google', style, variant = 'dark', size = 'md', render }) {
  const { cloud, settings } = useData();
  const [pinSheet, setPinSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      if (!settings.pin) flag(NEED_PIN_KEY, '1');
      const user = await cloud.signIn();
      if (user) {
        flag(NEED_PIN_KEY, null);
        if (!settings.pin) setPinSheet(true);
      }
    } catch (e) {
      flag(NEED_PIN_KEY, null);
      Alert.alert('Sign-in failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {render ? (
        render({ onPress: start, busy })
      ) : (
        <Button title={busy ? 'Signing in…' : title} icon="logo-google" variant={variant} size={size} style={style} disabled={busy} onPress={start} />
      )}
      <PinSetupSheet visible={pinSheet} onClose={() => setPinSheet(false)} />
    </>
  );
}
