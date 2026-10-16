import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { PAYMENT_METHODS, addTransfer, deleteTransfer, getWallets, listTransfers, setWalletBalance } from '../lib/db';
import { centavosToInput, cleanAmountInput, peso, prettyDate, toCentavos, today } from '../lib/format';
import { useData, useQuery } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Alert } from '../lib/alert';
import { Button, Card, Chip, Field, GradientCard, IconButton, Row, Screen, SectionHeader, Sheet, Title, Txt, tap } from '../components/ui';
import { goBack } from '../lib/nav';

export default function Wallets() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump, toast } = useData();
  const [edit, setEdit] = useState(null);
  const [value, setValue] = useState('');
  const [move, setMove] = useState(false);
  const [form, setForm] = useState({ from: 'gcash', to: 'cash', amount: '', fee: '', note: '' });

  const { data } = useQuery(async (d) => {
    const [wallets, transfers] = await Promise.all([getWallets(d), listTransfers(d)]);
    return { wallets, transfers };
  });
  const wallets = data?.wallets || [];
  const total = wallets.reduce((s, w) => s + w.balance, 0);
  const anySetUp = wallets.some((w) => w.setUp);

  const openEdit = (w) => {
    setEdit(w);
    setValue(w.balance > 0 ? centavosToInput(w.balance) : '');
  };

  const saveBalance = async () => {
    await setWalletBalance(db, edit.key, toCentavos(value));
    tap('success');
    setEdit(null);
    bump();
    toast(`${edit.emoji} ${edit.label} set to ${peso(toCentavos(value))}`);
  };

  const saveTransfer = async () => {
    const amount = toCentavos(form.amount);
    if (!amount || form.from === form.to) return;
    await addTransfer(db, { from: form.from, to: form.to, amount, fee: toCentavos(form.fee), date: today(), note: form.note.trim() });
    tap('success');
    setMove(false);
    setForm({ ...form, amount: '', fee: '', note: '' });
    bump();
    const a = PAYMENT_METHODS.find((m) => m.key === form.from);
    const b = PAYMENT_METHODS.find((m) => m.key === form.to);
    toast(`${a.emoji} → ${b.emoji} ${peso(amount)} moved`);
  };

  const removeTransfer = (t) => {
    Alert.alert('Delete this transfer?', `${peso(t.amount)} · ${prettyDate(t.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransfer(db, t.id);
          bump();
        },
      },
    ]);
  };

  const label = (k) => PAYMENT_METHODS.find((m) => m.key === k) || PAYMENT_METHODS[0];

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
      </Row>
      <Title main="your" italic="wallets" sub="Cash, GCash, Maya, cards. Lahat ng pera mo, isang tingin lang." />

      <GradientCard>
        <Txt w={700} size={14} color="rgba(255,255,255,0.85)">Total balance</Txt>
        <Txt w={800} size={38} color="#FFFFFF" style={{ marginTop: 2 }}>{peso(total)}</Txt>
        <Txt w={600} size={12.5} color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
          {anySetUp ? 'Updates every time you log something.' : 'Tap a wallet below to set how much is in it now.'}
        </Txt>
      </GradientCard>

      <Row gap={10} style={{ marginTop: 12 }}>
        <Button title="Move money" icon="swap-horizontal" variant="soft" size="md" style={{ flex: 1 }} onPress={() => setMove(true)} />
      </Row>

      <SectionHeader title="Balances" />
      <View style={{ gap: 10 }}>
        {wallets.map((w) => (
          <Card key={w.key} onPress={() => openEdit(w)} padding={16} style={!w.used ? { opacity: 0.6 } : null}>
            <Row gap={12}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={22}>{w.emoji}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt w={800} size={16}>{w.label}</Txt>
                <Txt size={12.5} color="sub">{w.used ? 'Tap to fix the balance' : 'Not set up · tap to add'}</Txt>
              </View>
              <Txt w={800} size={17} color={w.balance < 0 ? theme.red : 'text'}>{peso(w.balance)}</Txt>
            </Row>
          </Card>
        ))}
      </View>
      {wallets.some((w) => w.balance < 0) ? (
        <Txt size={12.5} color="sub" style={{ marginTop: 10, paddingHorizontal: 4 }}>
          Negative? You probably logged spending before setting the starting balance. Tap the wallet to fix it 👌
        </Txt>
      ) : null}

      {(data?.transfers || []).length ? (
        <>
          <SectionHeader title="Transfers" />
          <Card padding={8}>
            {data.transfers.map((t) => (
              <Pressable key={t.id} onLongPress={() => removeTransfer(t)} style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt w={700} size={14.5}>{label(t.from_method).emoji} {label(t.from_method).label} → {label(t.to_method).emoji} {label(t.to_method).label}</Txt>
                    <Txt size={12} color="sub">
                      {prettyDate(t.date)}
                      {t.fee ? ` · fee ${peso(t.fee)}` : ''}
                      {t.note ? ` · ${t.note}` : ''}
                    </Txt>
                  </View>
                  <Txt w={800} size={15}>{peso(t.amount)}</Txt>
                </Row>
              </Pressable>
            ))}
          </Card>
          <Txt size={12} color="faint" center style={{ marginTop: 10 }}>Long-press a transfer to delete it</Txt>
        </>
      ) : null}

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.emoji} ${edit.label}` : ''}>
        <Txt size={14} color="sub">How much is in it right now? Check your app or wallet.</Txt>
        <Field
          value={value}
          onChangeText={(t) => setValue(cleanAmountInput(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus
          style={{ marginTop: 14 }}
          inputStyle={{ fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          right={<Txt w={800} size={20} color="faint">₱</Txt>}
        />
        <Button title="Save balance" style={{ marginTop: 18 }} onPress={saveBalance} />
      </Sheet>

      <Sheet visible={move} onClose={() => setMove(false)} title="Move money 💸">
        <Txt w={800} size={13.5} color="sub">From</Txt>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {PAYMENT_METHODS.map((m) => (
            <Chip key={m.key} label={m.label} emoji={m.emoji} small selected={form.from === m.key} onPress={() => setForm({ ...form, from: m.key })} />
          ))}
        </Row>
        <Txt w={800} size={13.5} color="sub" style={{ marginTop: 14 }}>To</Txt>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {PAYMENT_METHODS.map((m) => (
            <Chip key={m.key} label={m.label} emoji={m.emoji} small selected={form.to === m.key} onPress={() => setForm({ ...form, to: m.key })} />
          ))}
        </Row>
        <Row gap={10} style={{ marginTop: 14 }}>
          <Field
            style={{ flex: 1.4 }}
            value={form.amount}
            onChangeText={(t) => setForm({ ...form, amount: cleanAmountInput(t) })}
            keyboardType="decimal-pad"
            placeholder="Amount"
            right={<Txt w={800} size={16} color="faint">₱</Txt>}
          />
          <Field
            style={{ flex: 1 }}
            value={form.fee}
            onChangeText={(t) => setForm({ ...form, fee: cleanAmountInput(t) })}
            keyboardType="decimal-pad"
            placeholder="Fee"
          />
        </Row>
        <Field style={{ marginTop: 10 }} value={form.note} onChangeText={(t) => setForm({ ...form, note: t })} placeholder="Note (e.g. cash-in sa 7-Eleven)" maxLength={40} />
        {form.from === form.to ? <Txt w={700} size={12.5} color="red" style={{ marginTop: 8 }}>Pick two different wallets 😅</Txt> : null}
        <Button title="Move it" style={{ marginTop: 18 }} disabled={!toCentavos(form.amount) || form.from === form.to} onPress={saveTransfer} />
      </Sheet>
    </Screen>
  );
}
