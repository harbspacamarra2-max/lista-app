import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listGoals, saveGoal } from '../lib/db';
import { addDays, cleanAmountInput, peso, prettyDate, toCentavos, today } from '../lib/format';
import { useData, useQuery } from '../lib/store';
import { swatch, swatchNames, useTheme } from '../lib/theme';
import { Button, Card, Chip, EmptyState, Field, IconButton, ProgressBar, Row, Screen, Sheet, Title, Txt, tap } from '../components/ui';
import { CalendarSheet } from '../components/bits';
import { Ring, goalHint } from '../components/goals';
import { goBack } from '../lib/nav';
import { EmojiChooser } from '../components/emoji';

const GOAL_EMOJIS = ['🐷', '📱', '💻', '✈️', '🏝️', '🎧', '👟', '🎓', '🚗', '🏠', '🎁', '💍', '🎮', '📷', '🛵', '🆘'];
const IDEAS = [
  ['New phone', '📱', 15000],
  ['Emergency fund', '🆘', 10000],
  ['Beach trip', '🏝️', 8000],
  ['Concert', '🎧', 6000],
];

export default function Goals() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump } = useData();
  const { data } = useQuery((d) => listGoals(d));
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState({ name: '', emoji: '🐷', color: 'rose', target: '', deadline: null });
  const [picker, setPicker] = useState(false);

  const create = async () => {
    const target = toCentavos(form.target);
    if (!form.name.trim() || !target) return;
    const id = await saveGoal(db, { ...form, target });
    tap('success');
    setSheet(false);
    setForm({ name: '', emoji: '🐷', color: 'rose', target: '', deadline: null });
    bump();
    router.push(`/goal/${id}`);
  };

  const goals = data || [];
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <IconButton icon="add" tint="brand" color="onBrand" onPress={() => setSheet(true)} label="New goal" />
      </Row>
      <Title main="ipon" italic="goals" sub={goals.length ? `${peso(totalSaved)} saved so far. Proud of you 🥹` : 'Small ipon, big dreams.'} />

      {data && !goals.length ? (
        <Card padding={0}>
          <EmptyState
            emoji="🐷"
            title="No goals yet"
            body="Start an ipon for that phone, trip or emergency fund. Every peso counts!"
            action="Create a goal"
            onAction={() => setSheet(true)}
          />
        </Card>
      ) : null}

      <View style={{ gap: 12 }}>
        {goals.map((g) => {
          const sw = swatch(theme, g.color);
          const pct = g.target ? g.saved / g.target : 0;
          return (
            <Card key={g.id} onPress={() => router.push(`/goal/${g.id}`)}>
              <Row gap={14}>
                <Ring pct={pct} size={64} stroke={8} color={sw.ink} track={sw.tint}>
                  <Txt size={26}>{g.emoji}</Txt>
                </Ring>
                <View style={{ flex: 1 }}>
                  <Txt w={800} size={16} numberOfLines={1}>{g.name}</Txt>
                  <Txt w={700} size={14} color={sw.ink} style={{ marginTop: 2 }}>
                    {peso(g.saved)} <Txt size={13} color="sub">of {peso(g.target)}</Txt>
                  </Txt>
                  <Txt size={12.5} color="sub" style={{ marginTop: 4 }}>{goalHint(g)}</Txt>
                </View>
                <Txt serif="italic" size={26} color={sw.ink}>{Math.min(100, Math.round(pct * 100))}%</Txt>
              </Row>
              <View style={{ marginTop: 12 }}>
                <ProgressBar value={pct} color={sw.ink} track={sw.tint} height={8} />
              </View>
            </Card>
          );
        })}
      </View>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="New ipon goal">
        <Txt w={700} size={13} color="sub" style={{ marginBottom: 8 }}>Quick ideas</Txt>
        <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          {IDEAS.map(([n, e, t]) => (
            <Chip key={n} label={n} emoji={e} small onPress={() => setForm((f) => ({ ...f, name: n, emoji: e, target: String(t) }))} />
          ))}
        </Row>
        <Field placeholder="Goal name, e.g. New phone" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} maxLength={30} />
        <Field
          placeholder="Target amount"
          value={form.target}
          onChangeText={(t) => setForm((f) => ({ ...f, target: cleanAmountInput(t) }))}
          keyboardType="decimal-pad"
          style={{ marginTop: 10 }}
          right={<Txt w={800} size={18} color="faint">₱</Txt>}
        />
        <EmojiChooser choices={GOAL_EMOJIS} value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e }))} style={{ marginTop: 12 }} />
        <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {swatchNames.map((n) => {
            const sw = swatch(theme, n);
            const on = form.color === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  tap();
                  setForm((f) => ({ ...f, color: n }));
                }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: sw.tint, borderWidth: on ? 3 : 1.5, borderColor: on ? sw.ink : theme.border }}
              />
            );
          })}
        </Row>
        <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Chip label="No deadline" small selected={!form.deadline} onPress={() => setForm((f) => ({ ...f, deadline: null }))} />
          <Chip
            label={form.deadline ? `By ${prettyDate(form.deadline)}` : 'Set a deadline'}
            emoji="📅"
            small
            selected={!!form.deadline}
            onPress={() => setPicker(true)}
          />
        </Row>
        <Button title="Start saving" icon="sparkles" style={{ marginTop: 18 }} onPress={create} disabled={!form.name.trim() || !toCentavos(form.target)} />
      </Sheet>

      <CalendarSheet
        visible={picker}
        value={form.deadline || addDays(today(), 90)}
        title="Reach it by"
        allowClear
        onClose={() => setPicker(false)}
        onPick={(d) => {
          setForm((f) => ({ ...f, deadline: d }));
          setPicker(false);
        }}
      />
    </Screen>
  );
}
