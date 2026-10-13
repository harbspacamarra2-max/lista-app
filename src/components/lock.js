import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { Aura, Txt, tap } from './ui';

let LocalAuth = null;
try {
  LocalAuth = Platform.OS === 'web' ? null : require('expo-local-authentication');
} catch {
  LocalAuth = null;
}

export function hashPin(pin) {
  let h = 5381;
  const s = `lista:${pin}:hanna`;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export async function biometricsAvailable() {
  if (!LocalAuth) return false;
  try {
    return (await LocalAuth.hasHardwareAsync()) && (await LocalAuth.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function askBiometrics() {
  if (!LocalAuth) return false;
  try {
    const r = await LocalAuth.authenticateAsync({ promptMessage: 'Unlock Sinop', cancelLabel: 'Use PIN', disableDeviceFallback: true });
    return !!r.success;
  } catch {
    return false;
  }
}

export function PinPad({ onComplete, error, extraKey }) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    setPin('');
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [error]);

  const press = (d) => {
    tap();
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        onComplete(next);
        setPin('');
      }, 120);
    }
  };

  const Key = ({ label, onPress, children }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 74,
        height: 74,
        borderRadius: 37,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: label || children ? (pressed ? theme.brandTint : theme.card) : 'transparent',
        borderWidth: label ? 1 : 0,
        borderColor: theme.border,
      })}
    >
      {label ? <Txt w={700} size={26}>{label}</Txt> : children}
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ flexDirection: 'row', gap: 16, marginBottom: 34, transform: [{ translateX: shake }] }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: i < pin.length ? theme.brand : 'transparent',
              borderWidth: 2,
              borderColor: error ? theme.red : theme.brand,
            }}
          />
        ))}
      </Animated.View>
      {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row) => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 22, marginBottom: 16 }}>
          {row.map((d) => (
            <Key key={d} label={d} onPress={() => press(d)} />
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 22 }}>
        {extraKey ? <Key onPress={extraKey.onPress}>{extraKey.icon}</Key> : <Key />}
        <Key label="0" onPress={() => press('0')} />
        <Key
          onPress={() => {
            tap();
            setPin((p) => p.slice(0, -1));
          }}
        >
          <Ionicons name="backspace-outline" size={26} color={theme.text} />
        </Key>
      </View>
    </View>
  );
}

export function LockScreen({ pinHash, useBio, onUnlock, onForgot }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState(0);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => {
    (async () => {
      if (!useBio) return;
      const ok = await biometricsAvailable();
      setBioOk(ok);
      if (ok && (await askBiometrics())) onUnlock();
    })();
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.bg, zIndex: 100, elevation: 100 }}>
      <Aura height={520} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 64, height: 64, borderRadius: 18 }} />
        <Txt style={{ marginTop: 16 }}>
          <Txt serif size={38}>welcome </Txt>
          <Txt serif="italic" size={38} color="brand">back</Txt>
        </Txt>
        <Txt w={600} size={14} color={error ? 'red' : 'sub'} style={{ marginTop: 4, marginBottom: 28 }}>
          {error ? 'Wrong PIN, try again 🙈' : 'Enter your PIN to open Sinop'}
        </Txt>
        <PinPad
          error={error}
          onComplete={(pin) => {
            if (hashPin(pin) === pinHash) {
              tap('success');
              onUnlock();
            } else {
              setError((e) => e + 1);
            }
          }}
          extraKey={
            bioOk
              ? {
                  icon: <Ionicons name="finger-print" size={28} color={theme.brand} />,
                  onPress: async () => {
                    if (await askBiometrics()) onUnlock();
                  },
                }
              : null
          }
        />
        <Pressable onPress={onForgot} style={{ marginTop: 26 }} hitSlop={10}>
          <Txt w={700} size={13} color="faint">Forgot PIN?</Txt>
        </Pressable>
      </View>
    </View>
  );
}
