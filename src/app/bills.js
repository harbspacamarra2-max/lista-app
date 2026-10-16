import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  pickableMethods,
  deleteBill,
  listBills,
  listCategories,
  payBill,
  saveBill,
  setBillReminder,
  skipBill,
} from '../lib/db';
import { addDays, centavosToInput, cleanAmountInput, dueLabel, peso, prettyDate, toCentavos, today } from '../lib/format';
import { cancelReminder, scheduleBillReminder } from '../lib/notify';
import { useData, useQuery } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Alert } from '../lib/alert';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Field, IconButton, Row, Screen, Segmented, Sheet, Title, Txt, tap } from '../components/ui';
import { CalendarSheet } from '../components/bits';
import { goBack } from '../lib/nav';

const PRESETS = [
  ['Netflix', '🎬', 'Fun'],
  ['Spotify', '🎵', 'Fun'],
  ['YouTube Premium', '▶️', 'Fun'],
  ['Rent / Upa', '🏠', 'Bills'],
  ['Meralco', '💡', 'Bills'],
  ['Water', '🚰', 'Bills'],
  ['WiFi', '📶', 'Bills'],
  ['Load promo', '📱', 'Load & Data'],
  ['Tuition', '🎓', 'School'],
  ['Gym', '🏋️', 'Health'],
  ['iCloud / Google One', '☁️', 'Others'],
];
const EMOJIS = ['🧾', '🏠', '💡', '🚰', '📶', '📱', '🎬', '🎵', '▶️', '🎓', '🏋️', '☁️', '🚗', '🛵', '🐶', '💳', '🎮', '📦'];

const blank = () => ({ id: null, name: '', emoji: '🧾', amount: '', category_id: null, method: 'cash', freq: 'monthly', next_due: addDays(today(), 7), remind: true, reminder_id: null });

export default function Bills() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump, toast } = useData();
  const { data } = useQuery(async (d) => {
    const [bills, categories] = await Promise.all([listBills(d), listCategories(d, 'expense')]);
    return { bills, categories };
  });
  const [form, setForm] = useState(null);
  const [picker, setPicker] = useState(false);

  const bills = data?.bills || [];
  const cats = data?.categories || [];
  const monthly = bills.reduce((s, b) => s + (b.freq === 'weekly' ? (b.amount * 52) / 12 : b.freq === 'yearly' ? b.amount / 12 : b.amount), 0);

  const openNew = (preset) => {
    const f = blank();
    if (preset) {
      const [name, emoji, catName] = preset;
      f.name = name;
      f.emoji = emoji;
      f.category_id = cats.find((c) => c.name === catName)?.id ?? null;
    } else {
      f.category_id = cats.find((c) => c.name === 'Bills')?.id ?? cats[0]?.id ?? null;
    }
    setForm(f);
  };

  const openEdit = (b) => setForm({ ...b, amount: centavosToInput(b.amount), remind: !!b.remind });

  const reschedule = async (bill, due) => {
    await cancelReminder(bill.reminder_id);
    let rid = null;
    if (bill.remind) rid = await scheduleBillReminder({ date: due, name: bill.name, amount: bill.amount, billId: bill.id });
    await setBillReminder(db, bill.id, rid);
  };

  const save = async () => {
    const amount = toCentavos(form.amount);
    if (!form.name.trim() || !amount) return;
    const bill = { ...form, amount };
    const id = await saveBill(db, bill);
    await reschedule({ ...bill, id }, bill.next_due);
    tap('success');
    setForm(null);
    bump();
    toast(form.id ? 'Bill updated ✅' : `${bill.emoji} ${bill.name} added! We’ll remind you ⏰`);
  };

  const pay = async (b) => {
    const next = await payBill(db, b);
    await reschedule(b, next);
    tap('success');
    bump();
    toast(`${b.emoji} ${b.name} paid! Next due ${prettyDate(next)} ✅`);
  };

  const skip = async (b) => {
    const next = await skipBill(db, b);
    await reschedule(b, next);
    setForm(null);
    bump();
    toast(`Skipped. Next due ${prettyDate(next)}`);
  };

  const remove = (b) => {
    Alert.alert(`Delete ${b.name}?`, 'Past payments stay in your Activity.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelReminder(b.reminder_id);
          await deleteBill(db, b.id);
          setForm(null);
          bump();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <IconButton icon="add" tint="brand" color="onBrand" onPress={() => openNew(null)} label="New bill" />
      </Row>
      <Title main="bills &" italic="subs" sub={bills.length ? `About ${peso(Math.round(monthly / 100) * 100)} a month on autopilot 🔁` : 'Never miss a due date again.'} />

      {data && !bills.length ? (
        <Card padding={16}>
          <EmptyState emoji="🔁" title="No bills yet" body="Add the things you pay every month. We’ll remind you and log them in one tap." />
          <Txt w={700} size={13} color="sub" style={{ marginBottom: 8 }}>Quick add</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => (
              <Chip key={p[0]} label={p[0]} emoji={p[1]} small onPress={() => openNew(p)} />
            ))}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {bills.map((b) => {
          const due = dueLabel(b.next_due);
          return (
            <Card key={b.id} onPress={() => openEdit(b)} padding={14}>
              <Row gap={12}>
                <Avatar emoji={b.emoji} tintName={b.category_color || 'butter'} size={46} />
                <View style={{ flex: 1 }}>
                  <Txt w={800} size={15.5} numberOfLines={1}>{b.name}</Txt>
                  <Txt size={12.5} color="sub">{peso(b.amount)} · {b.freq}{b.remind ? ' · ⏰' : ''}</Txt>
                  <View style={{ marginTop: 5 }}>
                    <Badge text={due.text} tone={due.tone} />
                  </View>
                </View>
                <Pressable
                  onPress={() => pay(b)}
                  style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: theme.brandTint, justifyContent: 'center' }}
                >
                  <Txt w={800} size={13} color={theme.mode === 'light' ? theme.brandDeep : theme.brand}>Bayad ✓</Txt>
                </Pressable>
              </Row>
            </Card>
          );
        })}
      </View>

      {bills.length ? (
        <View style={{ marginTop: 18 }}>
          <Txt w={700} size={13} color="sub" style={{ marginBottom: 8 }}>Add more</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.filter((p) => !bills.some((b) => b.name === p[0])).slice(0, 8).map((p) => (
              <Chip key={p[0]} label={p[0]} emoji={p[1]} small onPress={() => openNew(p)} />
            ))}
          </View>
        </View>
      ) : null}

      <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit bill' : 'New bill'}>
        {form ? (
          <View>
            <Field placeholder="Name, e.g. Netflix" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} maxLength={30} />
            <Field
              placeholder="Amount"
              value={form.amount}
              onChangeText={(t) => setForm((f) => ({ ...f, amount: cleanAmountInput(t) }))}
              keyboardType="decimal-pad"
              style={{ marginTop: 10 }}
              right={<Txt w={800} size={18} color="faint">₱</Txt>}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setForm((f) => ({ ...f, emoji: e }))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: form.emoji === e ? theme.brandTint : theme.card,
                    borderWidth: 1.5,
                    borderColor: form.emoji === e ? theme.brand : theme.border,
                  }}
                >
                  <Txt size={19}>{e}</Txt>
                </Pressable>
              ))}
            </View>
            <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>How often?</Txt>
            <Segmented
              value={form.freq}
              onChange={(v) => setForm((f) => ({ ...f, freq: v }))}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
            <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>Next due</Txt>
            <Pressable
              onPress={() => setPicker(true)}
              style={{ backgroundColor: theme.card, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: theme.border }}
            >
              <Txt w={800} size={15}>📅 {prettyDate(form.next_due, { withYear: true })}</Txt>
            </Pressable>
            <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>Category</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cats.map((c) => (
                <Chip key={c.id} label={c.name} emoji={c.emoji} tintName={c.color} small selected={form.category_id === c.id} onPress={() => setForm((f) => ({ ...f, category_id: c.id }))} />
              ))}
            </View>
            <Txt w={800} size={13} color="sub" style={{ marginTop: 16, marginBottom: 8 }}>Paid with</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {pickableMethods().map((m) => (
                <Chip key={m.key} label={m.label} emoji={m.emoji} small selected={form.method === m.key} onPress={() => setForm((f) => ({ ...f, method: m.key }))} />
              ))}
            </View>
            <Row style={{ marginTop: 16, backgroundColor: theme.card, borderRadius: radius.md, padding: 14, justifyContent: 'space-between', borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flex: 1 }}>
                <Txt w={700} size={14.5}>Remind me on the due date</Txt>
                <Txt size={12.5} color="sub">At 9:00 AM, with a “Bayad na” button</Txt>
              </View>
              <Switch value={form.remind} onValueChange={(v) => setForm((f) => ({ ...f, remind: v }))} trackColor={{ true: theme.brand, false: theme.border }} thumbColor="#FFFFFF" />
            </Row>
            <Button title="Save bill" icon="checkmark-circle" style={{ marginTop: 18 }} onPress={save} disabled={!form.name.trim() || !toCentavos(form.amount)} />
            {form.id ? (
              <Row gap={8} style={{ marginTop: 10 }}>
                <Button title="Skip this one" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => skip(form)} />
                <Button title="Delete" variant="danger" size="md" style={{ flex: 1 }} onPress={() => remove(form)} />
              </Row>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <CalendarSheet
        visible={picker}
        value={form?.next_due || today()}
        title="Next due date"
        onClose={() => setPicker(false)}
        onPick={(d) => {
          if (d) setForm((f) => ({ ...f, next_due: d }));
          setPicker(false);
        }}
      />
    </Screen>
  );
}
