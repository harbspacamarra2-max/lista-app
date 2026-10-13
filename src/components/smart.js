import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { listCategories, listPeople } from '../lib/db';
import { aiReady, aiScan, aiUnderstand, friendlyAiError } from '../lib/ai';
import { describeAction, executeAction, isValidAction } from '../lib/actions';
import { think } from '../lib/brain';
import { centavosToInput, cleanAmountInput, toCentavos } from '../lib/format';
import { choosePhotoForScan, deletePhotoFile } from '../lib/photos';
import { Alert } from '../lib/alert';
import { useData, useSettings } from '../lib/store';
import { fonts, radius, useTheme } from '../lib/theme';
import { Button, Row, Sheet, Txt, tap } from './ui';

function amountKey(a) {
  return a.type === 'split' ? 'total' : 'amount';
}

function nameKey(a) {
  if (a.type === 'debt' || a.type === 'payment') return 'person';
  if (a.type === 'split') return null;
  return 'note';
}

function ActionCard({ action, on, onToggle, onChange, categories }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const d = describeAction(action, categories);
  const ok = isValidAction(action);
  const ak = amountKey(action);
  const [amt, setAmt] = useState(() => centavosToInput(action[ak]));
  const nk = nameKey(action);
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: on && ok ? theme.brand : theme.border,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <Row gap={12} align="flex-start">
        <Pressable
          onPress={() => {
            tap();
            onToggle();
          }}
          hitSlop={8}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            marginTop: 2,
            backgroundColor: on ? theme.brand : 'transparent',
            borderWidth: 2,
            borderColor: on ? theme.brand : theme.faint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? <Ionicons name="checkmark" size={16} color={theme.onBrand} /> : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt w={800} size={15.5}>{d.title}</Txt>
          <Txt size={13} color="sub" style={{ marginTop: 2 }}>{d.sub}</Txt>
          {!ok ? <Txt w={700} size={12.5} color="red" style={{ marginTop: 4 }}>Kulang pa: add the amount{action.type !== 'expense' && action.type !== 'income' ? ' or name' : ''}.</Txt> : null}
        </View>
        <Pressable onPress={() => setEditing(!editing)} hitSlop={8}>
          <Ionicons name={editing ? 'chevron-up' : 'create-outline'} size={20} color={theme.sub} />
        </Pressable>
      </Row>
      {editing ? (
        <Row gap={8} style={{ marginTop: 12 }}>
          <TextInput
            value={amt}
            onChangeText={(t) => {
              const c = cleanAmountInput(t);
              setAmt(c);
              onChange({ [ak]: toCentavos(c) || null });
            }}
            keyboardType="decimal-pad"
            placeholder="₱ amount"
            placeholderTextColor={theme.faint}
            style={{ flex: 1, height: 44, borderRadius: 14, backgroundColor: theme.cardAlt, paddingHorizontal: 12, fontFamily: fonts[700], fontSize: 15, color: theme.text }}
          />
          {nk ? (
            <TextInput
              value={action[nk] || ''}
              onChangeText={(t) => onChange({ [nk]: t })}
              placeholder={nk === 'person' ? 'Name' : 'Note'}
              placeholderTextColor={theme.faint}
              style={{ flex: 1.4, height: 44, borderRadius: 14, backgroundColor: theme.cardAlt, paddingHorizontal: 12, fontFamily: fonts[600], fontSize: 15, color: theme.text }}
            />
          ) : null}
        </Row>
      ) : null}
      {editing && (action.type === 'debt' || action.type === 'payment') ? (
        <Pressable
          onPress={() => onChange({ direction: action.direction === 'owe' ? 'owed' : 'owe' })}
          style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: theme.cardAlt, justifyContent: 'center' }}
        >
          <Txt w={700} size={12.5}>⇄ Baliktarin (switch who owes)</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ActionReview({ state, onClose, onSaved }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.visible) return;
    setItems(state.actions.map((a) => ({ a, on: true })));
    listCategories(db).then(setCategories).catch(() => {});
  }, [state.stamp]);

  const chosen = items.filter((x) => x.on && isValidAction(x.a));

  const save = async () => {
    if (!chosen.length) return;
    setSaving(true);
    const done = [];
    const failed = [];
    for (const x of chosen) {
      try {
        done.push(await executeAction(db, x.a, categories, { photo: state.photo && done.length === 0 ? state.photo : null }));
      } catch (e) {
        failed.push(e?.message || 'Could not save one item');
      }
    }
    setSaving(false);
    if (state.photo && !done.length) deletePhotoFile(state.photo);
    tap(failed.length ? 'medium' : 'success');
    onSaved(done, failed);
  };

  const close = () => {
    if (state.photo) deletePhotoFile(state.photo);
    onClose();
  };

  return (
    <Sheet visible={state.visible} onClose={close} title={state.source === 'ai' ? '✨ Ito ba?' : '🧠 Ito ba?'}>
      {state.reply ? (
        <View style={{ backgroundColor: theme.brandTint, borderRadius: radius.lg, padding: 12, marginBottom: 12 }}>
          <Txt w={700} size={14} color={theme.mode === 'light' ? theme.brandDeep : theme.brand}>{state.reply}</Txt>
        </View>
      ) : null}
      {state.photo ? (
        <Image source={{ uri: state.photo }} style={{ width: '100%', height: 140, borderRadius: radius.lg, marginBottom: 12, backgroundColor: theme.cardAlt }} resizeMode="cover" />
      ) : null}
      {items.map((x, i) => (
        <ActionCard
          key={i}
          action={x.a}
          on={x.on}
          categories={categories}
          onToggle={() => setItems(items.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))}
          onChange={(patch) => setItems(items.map((y, j) => (j === i ? { ...y, a: { ...y.a, ...patch } } : y)))}
        />
      ))}
      <Txt size={12} color="faint" center style={{ marginBottom: 12 }}>
        {state.source === 'ai' ? 'AI can make mistakes. Check before saving 👀' : 'Tap ✏️ to fix anything before saving.'}
      </Txt>
      <Button
        title={saving ? 'Saving…' : chosen.length > 1 ? `Save all ${chosen.length} ✓` : 'Save ✓'}
        disabled={!chosen.length || saving}
        onPress={save}
      />
      <Button title="Cancel" variant="ghost" style={{ marginTop: 10 }} onPress={close} />
    </Sheet>
  );
}

const EMPTY = { visible: false, actions: [], reply: '', source: '', photo: null, stamp: 0 };

export function useSmartLog() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const { bump, toast } = useData();
  const [state, setState] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const open = (actions, reply, source, photo = null) => setState({ visible: true, actions, reply, source, photo, stamp: Date.now() });

  const finishInstant = async (action, categories) => {
    const msg = await executeAction(db, action, categories);
    tap('success');
    bump();
    toast(msg);
  };

  const understand = useCallback(
    async (text) => {
      const clean = String(text || '').trim();
      if (!clean) return false;
      setBusy(true);
      try {
        const categories = await listCategories(db);
        if (aiReady(settings)) {
          try {
            const people = await listPeople(db);
            const { actions, reply } = await aiUnderstand(clean, { categories, people });
            if (actions.length) {
              open(actions, reply, 'ai');
              return true;
            }
            const fallback = think(clean, categories);
            if (fallback.length) {
              open(fallback, reply, 'offline');
              return true;
            }
            toast(reply || 'Hmm, di ko gets 😅 Try “jeep 13” or “JM umutang 350”.');
            return true;
          } catch (e) {
            const local = think(clean, categories);
            if (local.length) {
              open(local, `${friendlyAiError(e)} Used the offline brain instead 🧠`, 'offline');
              return true;
            }
            toast(friendlyAiError(e));
            return true;
          }
        }
        const local = think(clean, categories);
        if (!local.length) return false;
        if (local.length === 1 && (local[0].type === 'expense' || local[0].type === 'income') && isValidAction(local[0])) {
          await finishInstant(local[0], categories);
          return true;
        }
        open(local, '', 'offline');
        return true;
      } finally {
        setBusy(false);
      }
    },
    [db, settings, bump, toast]
  );

  const scan = useCallback(async () => {
    if (!aiReady(settings)) {
      Alert.alert('Turn on Sinop AI ✨', 'Scanning receipts uses AI. You can turn it on in Settings → Sinop AI.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }
    const shot = await choosePhotoForScan();
    if (!shot?.base64) return;
    setBusy(true);
    try {
      const [categories, people] = await Promise.all([listCategories(db), listPeople(db)]);
      const { actions, reply } = await aiScan(shot.base64, { categories, people });
      if (!actions.length) {
        deletePhotoFile(shot.uri);
        toast(reply || 'Di ko mabasa 😵 Try a clearer photo.');
        return;
      }
      open(actions, reply, 'ai', shot.uri);
    } catch (e) {
      deletePhotoFile(shot.uri);
      toast(friendlyAiError(e));
    } finally {
      setBusy(false);
    }
  }, [db, settings, toast]);

  const sheet = (
    <ActionReview
      state={state}
      onClose={() => setState(EMPTY)}
      onSaved={(done, failed) => {
        setState(EMPTY);
        bump();
        if (failed.length) {
          Alert.alert(done.length ? 'Saved some of it' : 'Not saved', failed.join('\n'));
        } else {
          toast(done.length > 1 ? `${done.length} items saved ✨` : done[0]);
        }
      }}
    />
  );

  return { understand, scan, busy, sheet };
}

export function Thinking({ label = 'Thinking…' }) {
  const theme = useTheme();
  return (
    <Row gap={8}>
      <ActivityIndicator size="small" color={theme.brand} />
      <Txt w={700} size={13} color="sub">{label}</Txt>
    </Row>
  );
}
