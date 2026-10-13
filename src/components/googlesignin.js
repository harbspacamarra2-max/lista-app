import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '../lib/db';
import { useData } from '../lib/store';
import { Alert } from '../lib/alert';
import { Button, Sheet, Txt, tap } from './ui';
import { PinPad, hashPin } from './lock';

export function GoogleSignInButton({ title = 'Sign in with Google', style, variant = 'dark', size = 'md', render }) {
  const db = useSQLiteContext();
  const { cloud, settings, refreshSettings } = useData();
  const [sheet, setSheet] = useState(false);
  const [step, setStep] = useState({ first: null, error: 0 });
  const [busy, setBusy] = useState(false);

  const goGoogle = async (pinHash) => {
    setBusy(true);
    try {
      if (pinHash && Platform.OS === 'web') {
        try {
          window.localStorage.setItem('sinop_pending_pin', pinHash);
        } catch {
        }
      }
      const user = await cloud.signIn();
      if (Platform.OS === 'web') {
        try {
          window.localStorage.removeItem('sinop_pending_pin');
        } catch {
        }
      }
      if (pinHash && user) {
        await setSetting(db, 'pin', pinHash);
        await refreshSettings();
      }
      if (pinHash && !user) {
        Alert.alert('Sign-in cancelled', 'Your PIN wasn’t saved. Try again anytime.');
      }
    } catch (e) {
      Alert.alert('Sign-in failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (settings.pin) {
      goGoogle(null);
      return;
    }
    setStep({ first: null, error: 0, ready: null });
    setSheet(true);
  };

  return (
    <>
      {render ? (
        render({ onPress: start, busy })
      ) : (
        <Button title={busy ? 'Signing in…' : title} icon="logo-google" variant={variant} size={size} style={style} disabled={busy} onPress={start} />
      )}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Secure your account 🔒">
        <View style={{ alignItems: 'center' }}>
          {step.ready ? (
            <View style={{ alignItems: 'center', width: '100%' }}>
              <Txt size={40}>✅</Txt>
              <Txt w={800} size={16} style={{ marginTop: 8 }}>PIN created!</Txt>
              <Txt size={13.5} color="sub" center style={{ marginTop: 4 }}>Step 2 of 2: choose your Google account.</Txt>
              <Button
                title="Continue with Google"
                icon="logo-google"
                variant="dark"
                style={{ marginTop: 18, alignSelf: 'stretch' }}
                onPress={() => {
                  const h = step.ready;
                  setSheet(false);
                  goGoogle(h);
                }}
              />
            </View>
          ) : (
          <>
          <Txt size={13.5} color="sub" center style={{ marginBottom: 6 }}>
            Step 1 of 2: create a 4-digit PIN. Sinop will ask for it every time you open the app.
          </Txt>
          <Txt w={700} size={15} color={step.error ? 'red' : 'text'} style={{ marginBottom: 18 }}>
            {step.error ? 'PINs didn’t match, try again 🙈' : step.first ? 'Type it again to confirm' : 'Choose your PIN'}
          </Txt>
          <PinPad
            error={step.error}
            onComplete={(pin) => {
              if (!step.first) {
                setStep((s) => ({ ...s, first: pin }));
                return;
              }
              if (pin !== step.first) {
                setStep((s) => ({ ...s, first: null, error: s.error + 1 }));
                return;
              }
              tap('success');
              setStep((s) => ({ ...s, ready: hashPin(pin) }));
            }}
          />
          <Txt size={12} color="faint" center style={{ marginTop: 16 }}>Step 2: choose your Google account</Txt>
          </>
          )}
        </View>
      </Sheet>
    </>
  );
}
