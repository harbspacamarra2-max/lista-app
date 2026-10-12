import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setSetting } from '../lib/db';
import { cleanAmountInput, toCentavos } from '../lib/format';
import { useData } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Aura, Button, Field, Row, Txt, tap } from '../components/ui';

const PERKS = [
  ['💸', 'Log gastos in seconds'],
  ['🤝', 'Track utang & pautang'],
  ['⏰', 'Get due-date reminders'],
  ['📊', 'See where your money goes'],
];

export default function Onboarding() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { refreshSettings, bump } = useData();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');

  const start = async () => {
    await setSetting(db, 'name', name.trim());
    await setSetting(db, 'budget', String(toCentavos(budget)));
    await setSetting(db, 'onboarded', '1');
    tap('success');
    await refreshSettings();
    bump();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Aura height={560} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../../assets/icon.png')} style={{ width: 88, height: 88, borderRadius: 26 }} />
        <Txt style={{ marginTop: 22 }}>
          <Txt serif size={52}>hi, i’m </Txt>
          <Txt serif="italic" size={52} color="brand">lista</Txt>
        </Txt>
        <Txt size={16} color="sub" style={{ marginTop: 6, lineHeight: 23 }}>
          Your pocket notebook for gastos and utang. No more “saan napunta pera ko?” 😭
        </Txt>

        <View style={{ marginTop: 22, gap: 10 }}>
          {PERKS.map(([e, t]) => (
            <Row key={t} gap={12}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={18}>{e}</Txt>
              </View>
              <Txt w={700} size={15}>{t}</Txt>
            </Row>
          ))}
        </View>

        <Field label="What should we call you?" placeholder="Your name" value={name} onChangeText={setName} style={{ marginTop: 30 }} autoCapitalize="words" maxLength={24} />
        <Field
          label="Monthly budget (optional)"
          placeholder="e.g. 5000"
          value={budget}
          onChangeText={(t) => setBudget(cleanAmountInput(t))}
          keyboardType="decimal-pad"
          style={{ marginTop: 16 }}
          right={<Txt w={800} size={18} color="faint">₱</Txt>}
        />

        <Button title="Let’s go!" icon="arrow-forward" onPress={start} style={{ marginTop: 28 }} disabled={!name.trim()} />
        <Txt size={12.5} color="faint" center style={{ marginTop: 12 }}>Everything stays on your phone. No sign-up needed.</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
