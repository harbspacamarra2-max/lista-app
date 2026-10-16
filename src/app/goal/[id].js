import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addGoalEntry, deleteGoal, deleteGoalEntry, getGoal, listGoalEntries } from '../../lib/db';
import { cleanAmountInput, peso, prettyDate, shortDate, toCentavos } from '../../lib/format';
import { useData, useQuery } from '../../lib/store';
import { swatch, useTheme } from '../../lib/theme';
import { Alert } from '../../lib/alert';
import { Button, Card, Chip, Field, IconButton, Row, Screen, SectionHeader, Segmented, Sheet, Txt, tap } from '../../components/ui';
import { Ring, goalHint } from '../../components/goals';
import { Celebrate } from '../../components/celebrate';
import { WalletPicker } from '../../components/bits';
import { goBack } from '../../lib/nav';

export default function GoalScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump } = useData();
  const { id } = useLocalSearchParams();
  const goalId = Number(id);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [wallet, setWallet] = useState('cash');
  const [party, setParty] = useState(false);

  const { data } = useQuery(async (d) => {
    const [goal, entries] = await Promise.all([getGoal(d, goalId), listGoalEntries(d, goalId)]);
    return { goal, entries };
  }, [goalId]);

  if (data && !data.goal) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <Txt w={800} size={18} style={{ marginTop: 20 }}>This goal was removed.</Txt>
      </Screen>
    );
  }
  const g = data?.goal;
  if (!g) return <Screen><View /></Screen>;

  const sw = swatch(theme, g.color);
  const pct = g.target ? g.saved / g.target : 0;
  const left = Math.max(0, g.target - g.saved);

  const save = async () => {
    const cents = toCentavos(amount);
    if (!cents) return;
    const signed = mode === 'add' ? cents : -Math.min(cents, g.saved);
    await addGoalEntry(db, { goalId, amount: signed, note: note.trim(), method: wallet === 'none' ? null : wallet });
    tap('success');
    const reached = mode === 'add' && g.saved < g.target && g.saved + cents >= g.target;
    setSheet(false);
    setAmount('');
    setNote('');
    bump();
    if (reached) setTimeout(() => setParty(true), 350);
  };

  const remove = () => {
    Alert.alert(`Delete “${g.name}”?`, 'The goal and its savings history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(db, goalId);
          bump();
          goBack();
        },
      },
    ]);
  };

  const removeEntry = (e) => {
    Alert.alert('Remove this entry?', `${peso(Math.abs(e.amount))} on ${prettyDate(e.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteGoalEntry(db, e.id);
          bump();
        },
      },
    ]);
  };

  const open = (m) => {
    setMode(m);
    setAmount('');
    setSheet(true);
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <IconButton icon="trash-outline" tint="redTint" color="red" onPress={remove} label="Delete goal" />
      </Row>

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Ring pct={pct} size={190} stroke={16} color={sw.ink} track={sw.tint}>
          <Txt size={44}>{g.emoji}</Txt>
          <Txt serif="italic" size={34} color={sw.ink}>{Math.min(100, Math.round(pct * 100))}%</Txt>
        </Ring>
        <Txt serif size={36} style={{ marginTop: 14 }} center>{g.name}</Txt>
        <Txt w={700} size={15} color="sub" style={{ marginTop: 2 }}>
          {peso(g.saved)} of {peso(g.target)}
          {g.deadline ? ` · by ${shortDate(g.deadline)}` : ''}
        </Txt>
      </View>

      <Card tint={g.saved >= g.target ? 'mint' : undefined} style={{ marginTop: 18, alignItems: 'center' }} padding={14}>
        <Txt w={700} size={14} color={g.saved >= g.target ? theme.mintInk : 'text'}>{goalHint(g)}</Txt>
        {left > 0 ? <Txt size={12.5} color="sub" style={{ marginTop: 2 }}>Kaya mo ’yan! 💪</Txt> : null}
      </Card>

      <Row gap={10} style={{ marginTop: 12 }}>
        <Button title="Add money" icon="add" style={{ flex: 1 }} onPress={() => open('add')} />
        <Button title="Withdraw" icon="remove" variant="ghost" style={{ flex: 1 }} onPress={() => open('take')} disabled={!g.saved} />
      </Row>

      {data.entries.length ? (
        <>
          <SectionHeader title="History" />
          <Card padding={8}>
            {data.entries.map((e) => (
              <Pressable key={e.id} onLongPress={() => removeEntry(e)} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt w={700} size={14.5}>{e.note || (e.amount > 0 ? 'Added to ipon' : 'Withdrawn')}</Txt>
                    <Txt size={12.5} color="sub">{prettyDate(e.date)}</Txt>
                  </View>
                  <Txt w={800} size={15} color={e.amount > 0 ? sw.ink : theme.red}>
                    {e.amount > 0 ? '+' : '−'}{peso(Math.abs(e.amount))}
                  </Txt>
                </Row>
              </Pressable>
            ))}
          </Card>
          <Txt size={12} color="faint" center style={{ marginTop: 10 }}>Long-press an entry to remove it</Txt>
        </>
      ) : null}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={mode === 'add' ? 'Add to ipon 🐷' : 'Withdraw'}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'add', label: 'Add', emoji: '➕' },
            { value: 'take', label: 'Withdraw', emoji: '➖' },
          ]}
        />
        <Field
          value={amount}
          onChangeText={(t) => setAmount(cleanAmountInput(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus
          style={{ marginTop: 14 }}
          inputStyle={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          right={<Txt w={800} size={20} color="faint">₱</Txt>}
        />
        {mode === 'add' ? (
          <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {[20, 50, 100, 500].map((v) => (
              <Chip key={v} label={`₱${v}`} small onPress={() => setAmount(String(v))} />
            ))}
            {left > 0 ? <Chip label="The rest" emoji="🏁" small onPress={() => setAmount(String(left / 100))} /> : null}
          </Row>
        ) : null}
        <Field placeholder="Note (optional)" value={note} onChangeText={setNote} style={{ marginTop: 10 }} maxLength={40} />
        <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>{mode === 'add' ? 'Taken from' : 'Put back into'}</Txt>
        <WalletPicker
          value={wallet}
          onChange={setWallet}
          noneLabel="Not from my wallet"
          hint={wallet === 'none' ? 'Your wallet and budget won’t change.' : mode === 'add' ? 'Moves it out of your wallet and counts it in this month’s budget.' : 'Adds it back to your wallet.'}
        />
        <Button title={mode === 'add' ? 'Save to ipon' : 'Withdraw'} style={{ marginTop: 16 }} onPress={save} disabled={!toCentavos(amount)} />
      </Sheet>

      <Celebrate visible={party} icon="🐷" title="goal reached!" subtitle={`${g.emoji} ${g.name} — you did it!`} onDone={() => setParty(false)} />
    </Screen>
  );
}
