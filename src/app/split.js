import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listCategories, listGroups, listPeople, saveSplit, setDebtReminder } from '../lib/db';
import { addDays, cleanAmountInput, peso, prettyDate, toCentavos, today } from '../lib/format';
import { scheduleDueReminder } from '../lib/notify';
import { useData } from '../lib/store';
import { fonts, radius, useTheme } from '../lib/theme';
import { Alert } from '../lib/alert';
import { Aura, Avatar, Button, Chip, Field, IconButton, Row, Segmented, Txt, tap } from '../components/ui';
import { AmountInput, CalendarSheet } from '../components/bits';

export default function Split() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { bump, toast } = useData();

  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const [friends, setFriends] = useState([]);
  const [newName, setNewName] = useState('');
  const [people, setPeople] = useState([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [logMine, setLogMine] = useState(true);
  const [mode, setMode] = useState('equal');
  const [myCustom, setMyCustom] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [dueDate, setDueDate] = useState(null);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const params = useLocalSearchParams();

  useEffect(() => {
    (async () => {
      const [ppl, cats, grps] = await Promise.all([listPeople(db), listCategories(db, 'expense'), listGroups(db)]);
      setPeople(ppl);
      setCategories(cats);
      setCategoryId((cats[0] || {}).id ?? null);
      setGroups(grps.filter((g) => g.members.length));
      const start = grps.find((g) => String(g.id) === String(params.groupId));
      if (start) {
        setFriends(start.members.map((m) => ({ name: m.name, custom: '' })));
        if (!reason) setReason(`${start.emoji} ${start.name}`);
      }
    })();
  }, [db]);

  const addGroup = (g) => {
    tap();
    setFriends((fs) => {
      const have = new Set(fs.map((f) => f.name.toLowerCase()));
      return [...fs, ...g.members.filter((m) => !have.has(m.name.toLowerCase())).map((m) => ({ name: m.name, custom: '' }))];
    });
  };

  const totalC = toCentavos(total);
  const heads = friends.length + (includeMe ? 1 : 0);

  const shares = useMemo(() => {
    if (mode === 'custom') {
      return {
        mine: includeMe ? toCentavos(myCustom) : 0,
        friends: friends.map((f) => ({ name: f.name, amount: toCentavos(f.custom) })),
      };
    }
    if (!heads || !totalC) return { mine: 0, friends: friends.map((f) => ({ name: f.name, amount: 0 })) };
    const each = Math.floor(totalC / heads);
    const extra = totalC - each * heads;
    const list = friends.map((f, i) => ({ name: f.name, amount: each + (!includeMe && i === 0 ? extra : 0) }));
    return { mine: includeMe ? each + extra : 0, friends: list };
  }, [mode, friends, includeMe, myCustom, totalC, heads]);

  const assigned = shares.mine + shares.friends.reduce((s, f) => s + f.amount, 0);
  const leftover = totalC - assigned;
  const canSave = totalC > 0 && friends.length > 0 && (mode === 'equal' || leftover === 0) && !saving;

  const addFriend = (name) => {
    const clean = name.trim();
    if (!clean) return;
    if (friends.some((f) => f.name.toLowerCase() === clean.toLowerCase())) return;
    tap();
    setFriends((fs) => [...fs, { name: clean, custom: '' }]);
    setNewName('');
  };

  const removeFriend = (name) => setFriends((fs) => fs.filter((f) => f.name !== name));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const created = await saveSplit(db, {
        reason: reason.trim(),
        date: today(),
        dueDate,
        shares: shares.friends,
        myShare: includeMe && logMine ? { amount: shares.mine, categoryId } : null,
      });
      if (dueDate) {
        for (const c of created) {
          const rid = await scheduleDueReminder({ dueDate, personName: c.name, direction: 'owed', amount: c.amount });
          if (rid) await setDebtReminder(db, c.id, rid);
        }
      }
      tap('success');
      bump();
      router.back();
      setTimeout(() => toast(`Hati-hati done! 🍕 ${created.length} ${created.length === 1 ? 'utang' : 'utangs'} added. Maningil ka ha 😤`), 300);
    } catch (e) {
      setSaving(false);
      Alert.alert('Oops', 'Could not save the split. Please try again.');
    }
  };

  const suggestions = people
    .filter((p) => !friends.some((f) => f.name.toLowerCase() === p.name.toLowerCase()))
    .filter((p) => !newName.trim() || p.name.toLowerCase().includes(newName.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Aura height={360} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton icon="close" onPress={() => router.back()} label="Close" />
          <Txt w={800} size={17}>Hati-hati 🍕</Txt>
          <View style={{ width: 44 }} />
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Txt w={700} size={14} color="sub" center style={{ marginTop: 16 }}>Total bill</Txt>
        <AmountInput value={total} onChange={setTotal} color={theme.brand} autoFocus />

        <Field placeholder="What for? e.g. Samgyup night" value={reason} onChangeText={setReason} style={{ marginTop: 6 }} maxLength={40} />

        <Label>Who’s in?</Label>
        {groups.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {groups.map((g) => (
              <Chip key={g.id} label={`${g.name} (${g.members.length})`} emoji={g.emoji} small onPress={() => addGroup(g)} />
            ))}
          </ScrollView>
        ) : null}
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="Me" emoji="🙋" selected={includeMe} onPress={() => setIncludeMe((v) => !v)} />
          {friends.map((f) => (
            <Chip key={f.name} label={`${f.name}  ✕`} emoji="👤" selected onPress={() => removeFriend(f.name)} tintName="lilac" />
          ))}
        </Row>
        <Field
          placeholder="Add a friend’s name"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={() => addFriend(newName)}
          returnKeyType="done"
          autoCapitalize="words"
          style={{ marginTop: 10 }}
          right={
            <Pressable onPress={() => addFriend(newName)} hitSlop={8}>
              <Ionicons name="add-circle" size={26} color={theme.brand} />
            </Pressable>
          }
        />
        {suggestions.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
            {suggestions.map((p) => (
              <Chip key={p.id} label={p.name} emoji={p.emoji} small onPress={() => addFriend(p.name)} />
            ))}
          </ScrollView>
        ) : null}

        <Label>How to split?</Label>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'equal', label: 'Equally', emoji: '⚖️' },
            { value: 'custom', label: 'Custom', emoji: '✍️' },
          ]}
        />

        {heads > 0 ? (
          <View style={{ marginTop: 12, backgroundColor: theme.card, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, padding: 8 }}>
            {includeMe ? (
              <ShareRow
                emoji="🙋"
                name="Me"
                amount={shares.mine}
                custom={mode === 'custom'}
                value={myCustom}
                onChange={setMyCustom}
              />
            ) : null}
            {friends.map((f, i) => (
              <ShareRow
                key={f.name}
                emoji="👤"
                name={f.name}
                amount={shares.friends[i]?.amount || 0}
                custom={mode === 'custom'}
                value={f.custom}
                onChange={(t) => setFriends((fs) => fs.map((x) => (x.name === f.name ? { ...x, custom: t } : x)))}
              />
            ))}
          </View>
        ) : null}

        {mode === 'custom' && totalC > 0 ? (
          <Txt w={700} size={13} color={leftover === 0 ? 'brand' : 'red'} style={{ marginTop: 8, marginLeft: 4 }}>
            {leftover === 0 ? 'Perfect, it adds up ✓' : leftover > 0 ? `${peso(leftover)} left to assign` : `${peso(-leftover)} too much`}
          </Txt>
        ) : null}

        {includeMe ? (
          <>
            <Row style={{ marginTop: 18, backgroundColor: theme.card, borderRadius: radius.md, padding: 14, justifyContent: 'space-between', borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flex: 1 }}>
                <Txt w={700} size={14.5}>Log my share as an expense</Txt>
                <Txt size={12.5} color="sub">{shares.mine ? `${peso(shares.mine)} goes to your gastos` : 'Your part of the bill'}</Txt>
              </View>
              <Switch value={logMine} onValueChange={setLogMine} trackColor={{ true: theme.brand, false: theme.border }} thumbColor="#FFFFFF" />
            </Row>
            {logMine ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} emoji={c.emoji} tintName={c.color} small selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Label>Pay me back by</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="No due date" selected={!dueDate} onPress={() => setDueDate(null)} />
          <Chip label="Tomorrow" selected={dueDate === addDays(today(), 1)} onPress={() => setDueDate(addDays(today(), 1))} />
          <Chip label="In a week" selected={dueDate === addDays(today(), 7)} onPress={() => setDueDate(addDays(today(), 7))} />
          <Chip
            label={dueDate && dueDate !== addDays(today(), 1) && dueDate !== addDays(today(), 7) ? prettyDate(dueDate) : 'Pick date'}
            emoji="📅"
            selected={!!dueDate && dueDate !== addDays(today(), 1) && dueDate !== addDays(today(), 7)}
            onPress={() => setPicker(true)}
          />
        </Row>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 12, backgroundColor: theme.bg }}>
        <Button
          title={!friends.length ? 'Add at least 1 friend' : canSave ? `Split ${peso(totalC)} with ${friends.length}` : 'Check the amounts'}
          icon="people"
          onPress={save}
          disabled={!canSave}
        />
      </View>

      <CalendarSheet
        visible={picker}
        value={dueDate || addDays(today(), 7)}
        title="Pay me back by"
        allowClear
        onClose={() => setPicker(false)}
        onPick={(d) => {
          setDueDate(d);
          setPicker(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ShareRow({ emoji, name, amount, custom, value, onChange }) {
  const theme = useTheme();
  return (
    <Row gap={12} style={{ paddingVertical: 8, paddingHorizontal: 8 }}>
      <Avatar emoji={emoji} tintName={name === 'Me' ? 'mint' : 'lilac'} size={38} />
      <Txt w={700} size={15} style={{ flex: 1 }} numberOfLines={1}>{name}</Txt>
      {custom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardAlt, borderRadius: 12, paddingHorizontal: 10, minWidth: 110 }}>
          <Txt w={800} size={15} color="faint">₱</Txt>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(cleanAmountInput(t))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.faint}
            style={{ flex: 1, fontFamily: fonts[800], fontSize: 16, color: theme.text, paddingVertical: 8, marginLeft: 4 }}
          />
        </View>
      ) : (
        <Txt w={800} size={16}>{peso(amount)}</Txt>
      )}
    </Row>
  );
}

function Label({ children }) {
  return (
    <Txt w={800} size={14} color="sub" style={{ marginTop: 22, marginBottom: 10, marginLeft: 2 }}>
      {children}
    </Txt>
  );
}

