import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { Alert } from '../lib/alert';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  PAYMENT_METHODS,
  deleteDebt,
  deleteTransaction,
  frequentEntries,
  getDebt,
  getPerson,
  getTransaction,
  listCategories,
  listPeople,
  saveDebt,
  saveTransaction,
  setDebtReminder,
} from '../lib/db';
import { addDays, centavosToInput, peso, prettyDate, toCentavos, today } from '../lib/format';
import { cancelReminder, scheduleDueReminder } from '../lib/notify';
import { useData } from '../lib/store';
import { QUIPS, fill, pick } from '../lib/quips';
import { radius, useTheme } from '../lib/theme';
import { Aura, Button, Chip, Field, IconButton, Row, Segmented, Txt, tap } from '../components/ui';
import { AmountInput, CalendarSheet } from '../components/bits';

export default function Add() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { bump, toast } = useData();
  const params = useLocalSearchParams();
  const editTxId = params.id ? Number(params.id) : null;
  const editDebtId = params.debtId ? Number(params.debtId) : null;
  const editing = !!(editTxId || editDebtId);

  const [type, setType] = useState(editDebtId ? 'utang' : params.type || 'expense');
  const [amount, setAmount] = useState('');
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [categoryId, setCategoryId] = useState(null);
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState(params.direction === 'owe' ? 'owe' : 'owed');
  const [personName, setPersonName] = useState('');
  const [people, setPeople] = useState([]);
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [remind, setRemind] = useState(true);
  const [oldReminder, setOldReminder] = useState(null);
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [quick, setQuick] = useState({ expense: [], income: [] });

  useEffect(() => {
    (async () => {
      const [exp, inc, ppl] = await Promise.all([
        listCategories(db, 'expense'),
        listCategories(db, 'income'),
        listPeople(db),
      ]);
      setCategories({ expense: exp, income: inc });
      setPeople(ppl);
      if (!editTxId && !editDebtId) {
        const [qe, qi] = await Promise.all([frequentEntries(db, 'expense'), frequentEntries(db, 'income')]);
        setQuick({ expense: qe, income: qi });
      }
      if (editTxId) {
        const tx = await getTransaction(db, editTxId);
        if (tx) {
          setType(tx.kind);
          setAmount(centavosToInput(tx.amount));
          setCategoryId(tx.category_id);
          setMethod(tx.method || 'cash');
          setDate(tx.date);
          setNote(tx.note || '');
        }
      } else if (editDebtId) {
        const d = await getDebt(db, editDebtId);
        if (d) {
          setAmount(centavosToInput(d.amount));
          setDirection(d.direction);
          setPersonName(d.person_name);
          setReason(d.reason || '');
          setDate(d.date);
          setDueDate(d.due_date);
          setRemind(!!d.reminder_id);
          setOldReminder(d.reminder_id);
        }
      } else {
        if (params.personId) {
          const p = await getPerson(db, Number(params.personId));
          if (p) setPersonName(p.name);
        }
        setCategoryId((exp[0] || {}).id ?? null);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listCategories(db, 'expense'), listCategories(db, 'income')])
        .then(([exp, inc]) => setCategories({ expense: exp, income: inc }))
        .catch(() => {});
    }, [db])
  );

  useEffect(() => {
    if (type === 'utang') return;
    const list = categories[type] || [];
    if (list.length && !list.some((c) => c.id === categoryId)) setCategoryId(list[0].id);
  }, [type, categories]);

  const suggestions = useMemo(() => {
    const q = personName.trim().toLowerCase();
    const list = q ? people.filter((p) => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q) : people;
    return list.slice(0, 6);
  }, [people, personName]);

  const cents = toCentavos(amount);
  const isUtang = type === 'utang';
  const accent = type === 'income' ? theme.brand : isUtang ? theme.lilacInk : theme.text;
  const canSave = cents > 0 && (!isUtang || personName.trim().length > 0) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isUtang) {
        const { id } = await saveDebt(db, {
          id: editDebtId,
          personName: personName.trim(),
          direction,
          amount: cents,
          reason: reason.trim(),
          date,
          due_date: dueDate,
        });
        if (oldReminder) await cancelReminder(oldReminder);
        let rid = null;
        if (remind && dueDate) {
          rid = await scheduleDueReminder({ dueDate, personName: personName.trim(), direction, amount: cents });
        }
        await setDebtReminder(db, id, rid);
      } else {
        await saveTransaction(db, {
          id: editTxId,
          kind: type,
          amount: cents,
          category_id: categoryId,
          method,
          date,
          note: note.trim(),
        });
      }
      tap('success');
      bump();
      router.back();
      if (!editing) {
        let line;
        if (isUtang) line = fill(pick(direction === 'owed' ? 'savedOwed' : 'savedOwe'), { name: personName.trim() });
        else if (type === 'income') line = pick('savedIncome');
        else if (cents >= 100000) line = pick('bigExpense');
        else {
          const cat = (categories.expense || []).find((c) => c.id === categoryId);
          const key = `expense${cat?.name || 'Other'}`;
          line = pick(QUIPS[key] ? key : 'expenseOther');
        }
        setTimeout(() => toast(line), 250);
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Oops', 'Could not save. Please try again.');
    }
  };

  const remove = () => {
    Alert.alert('Delete this?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (editTxId) await deleteTransaction(db, editTxId);
          if (editDebtId) {
            if (oldReminder) await cancelReminder(oldReminder);
            await deleteDebt(db, editDebtId);
          }
          bump();
          router.back();
        },
      },
    ]);
  };

  const typeOptions = editDebtId
    ? [{ value: 'utang', label: 'Utang', emoji: '🤝' }]
    : editTxId
      ? [
          { value: 'expense', label: 'Expense', emoji: '💸' },
          { value: 'income', label: 'Income', emoji: '💰' },
        ]
      : [
          { value: 'expense', label: 'Expense', emoji: '💸' },
          { value: 'income', label: 'Income', emoji: '💰' },
          { value: 'utang', label: 'Utang', emoji: '🤝' },
        ];

  const title = editing ? 'Edit' : isUtang ? 'New utang' : type === 'income' ? 'New income' : 'New expense';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Aura height={360} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton icon="close" onPress={() => router.back()} label="Close" />
          <Txt w={800} size={17}>{title}</Txt>
          {editing ? (
            <IconButton icon="trash-outline" tint="redTint" color="red" onPress={remove} label="Delete" />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </Row>
        {typeOptions.length > 1 ? (
          <Segmented options={typeOptions} value={type} onChange={setType} style={{ marginTop: 16 }} />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 18, marginBottom: 6 }}>
          <AmountInput value={amount} onChange={setAmount} color={accent} autoFocus={!editing} />
          <Row gap={8} style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            {[20, 50, 100, 500, 1000].map((v) => (
              <Pressable
                key={v}
                onPress={() => {
                  tap();
                  setAmount(centavosToInput(toCentavos(amount) + v * 100));
                }}
                style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: theme.cardAlt, justifyContent: 'center' }}
              >
                <Txt w={700} size={13} color="sub">+{v}</Txt>
              </Pressable>
            ))}
          </Row>
        </View>

        {isUtang ? (
          <>
            <Label>Who?</Label>
            <Segmented
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'owed', label: 'They owe me', emoji: '🤑' },
                { value: 'owe', label: 'I owe them', emoji: '🫣' },
              ]}
            />
            <Field
              placeholder="Name (e.g. Juan, Mama, Bestie)"
              value={personName}
              onChangeText={setPersonName}
              style={{ marginTop: 10 }}
              autoCapitalize="words"
              editable={!editDebtId}
            />
            {!editDebtId && suggestions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
                {suggestions.map((p) => (
                  <Chip key={p.id} label={p.name} emoji={p.emoji} small onPress={() => setPersonName(p.name)} selected={p.name === personName} />
                ))}
              </ScrollView>
            ) : null}

            {!editDebtId ? (
              <Pressable onPress={() => router.replace('/split')} style={{ marginTop: 12, alignSelf: 'flex-start' }} hitSlop={8}>
                <Txt w={700} size={13.5} color="brand">🍕 Splitting a bill with friends? Try Hati-hati →</Txt>
              </Pressable>
            ) : null}

            <Label>For what?</Label>
            <Field placeholder="Lunch, pamasahe, concert ticket…" value={reason} onChangeText={setReason} />

            <Label>Dates</Label>
            <Row gap={10}>
              <DateButton icon="calendar-outline" label="Borrowed" value={prettyDate(date)} onPress={() => setPicker('date')} />
              <DateButton icon="alarm-outline" label="Due" value={dueDate ? prettyDate(dueDate) : 'No due date'} onPress={() => setPicker('due')} />
            </Row>
            {dueDate ? (
              <Row style={{ marginTop: 14, backgroundColor: theme.card, borderRadius: radius.md, padding: 14, justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt w={700} size={14.5}>Remind me on the due date</Txt>
                  <Txt size={12.5} color="sub">We’ll remind you at 9:00 AM.</Txt>
                </View>
                <Switch
                  value={remind}
                  onValueChange={setRemind}
                  trackColor={{ true: theme.brand, false: theme.border }}
                  thumbColor="#FFFFFF"
                />
              </Row>
            ) : null}
          </>
        ) : (
          <>
            {!editing && (quick[type] || []).length ? (
              <>
                <Label>⚡ Quick add</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {quick[type].map((q, i) => (
                    <Chip
                      key={`${q.category_id}-${q.amount}-${q.note}-${i}`}
                      emoji={q.category_emoji || '✨'}
                      tintName={q.category_color}
                      label={`${q.note || q.category_name || 'Entry'} · ${peso(q.amount)}`}
                      onPress={() => {
                        setAmount(centavosToInput(q.amount));
                        if (q.category_id) setCategoryId(q.category_id);
                        setNote(q.note || '');
                        setMethod(q.method || 'cash');
                      }}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Label>Category</Label>
              <Pressable onPress={() => router.push('/settings?section=categories')} hitSlop={8}>
                <Txt w={700} size={13} color="brand" style={{ marginBottom: 10 }}>+ New</Txt>
              </Pressable>
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(categories[type] || []).map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  emoji={c.emoji}
                  tintName={c.color}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>

            <Label>{type === 'income' ? 'Received via' : 'Paid with'}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m.key} label={m.label} emoji={m.emoji} selected={method === m.key} onPress={() => setMethod(m.key)} />
              ))}
            </ScrollView>

            <Label>When?</Label>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Chip label="Today" selected={date === today()} onPress={() => setDate(today())} />
              <Chip label="Yesterday" selected={date === addDays(today(), -1)} onPress={() => setDate(addDays(today(), -1))} />
              <Chip
                label={date !== today() && date !== addDays(today(), -1) ? prettyDate(date) : 'Pick date'}
                emoji="📅"
                selected={date !== today() && date !== addDays(today(), -1)}
                onPress={() => setPicker('date')}
              />
            </Row>

            <Label>Note</Label>
            <Field
              placeholder={type === 'income' ? 'e.g. Weekly allowance (finally)' : 'e.g. Milk tea (again 😭)'}
              value={note}
              onChangeText={setNote}
              maxLength={80}
            />
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 12, backgroundColor: theme.bg }}>
        <Button
          title={cents > 0 ? `Save ${peso(cents)}` : 'Enter an amount'}
          icon="checkmark-circle"
          onPress={save}
          disabled={!canSave}
        />
      </View>

      <CalendarSheet
        visible={picker === 'date'}
        value={date}
        title={isUtang ? 'Date borrowed' : 'Pick a date'}
        onClose={() => setPicker(null)}
        onPick={(d) => {
          if (d) setDate(d);
          setPicker(null);
        }}
      />
      <CalendarSheet
        visible={picker === 'due'}
        value={dueDate || addDays(today(), 7)}
        title="Due date"
        allowClear
        onClose={() => setPicker(null)}
        onPick={(d) => {
          setDueDate(d);
          setPicker(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Label({ children }) {
  return (
    <Txt w={800} size={14} color="sub" style={{ marginTop: 22, marginBottom: 10, marginLeft: 2 }}>
      {children}
    </Txt>
  );
}

function DateButton({ icon, label, value, onPress }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: theme.border }}
    >
      <Row gap={6}>
        <Ionicons name={icon} size={15} color={theme.sub} />
        <Txt w={700} size={12} color="sub">{label}</Txt>
      </Row>
      <Txt w={800} size={15} style={{ marginTop: 4 }} numberOfLines={1}>{value}</Txt>
    </Pressable>
  );
}
