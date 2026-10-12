import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, Switch, View } from 'react-native';
import { Alert } from '../lib/alert';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addCategory, archiveCategory, exportCSV, listCategories, resetAll, setCategoryBudget, setSetting } from '../lib/db';
import { centavosToInput, cleanAmountInput, peso, pesoShort, toCentavos } from '../lib/format';
import { setDailyNudge } from '../lib/notify';
import { useData, useQuery, useSettings } from '../lib/store';
import { accentNames, accents, swatch, swatchNames, useTheme, useThemePref } from '../lib/theme';
import { Avatar, Button, Card, Chip, Divider, Field, IconButton, Row, Screen, Segmented, Sheet, Txt, tap } from '../components/ui';
import { NavRow } from '../components/bits';
import { LoveNote } from '../components/lovenote';
import { PinPad, biometricsAvailable, hashPin } from '../components/lock';

const EMOJI_CHOICES = ['☕', '🍔', '🧋', '🍕', '🚗', '⛽', '🏠', '👕', '💄', '🐶', '🎬', '🎵', '🎓', '✈️', '🏋️', '🎁', '🧾', '💻', '📦', '🙏'];

export default function Settings() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { pref, setPref, accent, setAccent } = useThemePref();
  const settings = useSettings();
  const { bump, refreshSettings } = useData();
  const params = useLocalSearchParams();

  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const [catSheet, setCatSheet] = useState(params.section === 'categories');
  const [catKind, setCatKind] = useState('expense');
  const [newCat, setNewCat] = useState({ name: '', emoji: '☕', color: 'mint' });
  const [love, setLove] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [lockSheet, setLockSheet] = useState(false);
  const [pinStep, setPinStep] = useState({ first: null, error: 0 });
  const [bioAvail, setBioAvail] = useState(false);
  useEffect(() => {
    biometricsAvailable().then(setBioAvail);
  }, []);
  const [catBudget, setCatBudget] = useState('');
  const taps = useRef({ n: 0, last: 0 });

  const secretTap = () => {
    const now = Date.now();
    taps.current.n = now - taps.current.last < 1500 ? taps.current.n + 1 : 1;
    taps.current.last = now;
    if (taps.current.n >= 10) {
      taps.current.n = 0;
      tap('success');
      setLove(true);
    }
  };

  const { data: cats, reload } = useQuery((d) => listCategories(d), []);

  const nudge = settings.daily_nudge === '1';

  const saveSetting = async (key, v) => {
    await setSetting(db, key, v);
    await refreshSettings();
    bump();
  };

  const openEdit = (field) => {
    setEditing(field);
    setValue(field === 'name' ? settings.name || '' : centavosToInput(Number(settings.budget || 0)));
  };

  const doExport = async () => {
    const csv = await exportCSV(db);
    try {
      await Share.share({ message: csv, title: 'Lista export' });
    } catch {
    }
  };

  const doReset = () => {
    Alert.alert('Reset everything?', 'This deletes all expenses, income and utang. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAll(db);
          bump();
          reload();
          Alert.alert('Done', 'Fresh start! ✨');
        },
      },
    ]);
  };

  const createCategory = async () => {
    if (!newCat.name.trim()) return;
    await addCategory(db, { ...newCat, kind: catKind });
    tap('success');
    setNewCat({ name: '', emoji: '☕', color: 'mint' });
    bump();
    reload();
  };

  const removeCategory = (c) => {
    Alert.alert(`Remove “${c.name}”?`, 'Past entries keep their category.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await archiveCategory(db, c.id);
          bump();
          reload();
        },
      },
    ]);
  };

  useEffect(() => {
    if (params.section === 'categories') setCatSheet(true);
  }, [params.section]);

  const kindCats = (cats || []).filter((c) => c.kind === catKind);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} label="Back" />
        <Txt w={800} size={18}>Settings</Txt>
        <View style={{ width: 44 }} />
      </Row>

      <Card style={{ alignItems: 'center' }}>
        <Avatar emoji="😎" tintName="mint" size={68} />
        <Txt w={800} size={20} style={{ marginTop: 10 }}>{settings.name || 'You'}</Txt>
        <Txt size={13} color="sub">Your data stays on this phone 🔒</Txt>
      </Card>

      <Group title="Profile">
        <NavRow icon="person-outline" label="Your name" value={settings.name || 'Set'} onPress={() => openEdit('name')} />
        <Divider />
        <NavRow
          icon="wallet-outline"
          label="Monthly budget"
          value={Number(settings.budget) ? peso(Number(settings.budget)) : 'Not set'}
          onPress={() => openEdit('budget')}
        />
      </Group>

      <Group title="Vibe">
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {accentNames.map((n) => {
            const a = accents[n][theme.mode];
            const on = accent === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  tap();
                  setAccent(n);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 18,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? a.brand : theme.border,
                  backgroundColor: on ? a.brandTint : theme.card,
                }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: a.aura[0] }} />
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: a.brand, marginLeft: -8 }} />
                </View>
                <Txt size={15} style={{ marginTop: 6 }}>{accents[n].emoji}</Txt>
                <Txt w={on ? 800 : 600} size={12} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>{accents[n].label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Segmented
          value={pref}
          onChange={setPref}
          style={{ marginVertical: 8 }}
          options={[
            { value: 'system', label: 'Auto', emoji: '📱' },
            { value: 'light', label: 'Light', emoji: '☀️' },
            { value: 'dark', label: 'Dark', emoji: '🌙' },
          ]}
        />
      </Group>

      <Group title="Stuff">
        <NavRow icon="pricetags-outline" label="Categories & budgets" value={`${(cats || []).length}`} onPress={() => setCatSheet(true)} />
        <Divider />
        <NavRow
          icon="lock-closed-outline"
          label="App lock"
          value={settings.pin ? 'On 🔒' : 'Off'}
          onPress={() => {
            setPinStep({ first: null, error: 0 });
            setLockSheet(true);
          }}
        />
        <Divider />
        <NavRow icon="flag-outline" label="Ipon goals" onPress={() => router.push('/goals')} />
        <Divider />
        <Row style={{ paddingVertical: 12, justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt w={700} size={15}>Daily reminder</Txt>
            <Txt size={12.5} color="sub">A nudge at 8 PM to log your gastos</Txt>
          </View>
          <Switch
            value={nudge}
            trackColor={{ true: theme.brand, false: theme.border }}
            thumbColor="#FFFFFF"
            onValueChange={async (v) => {
              const ok = await setDailyNudge(v);
              if (v && !ok) {
                Alert.alert('Notifications are off', 'Please allow notifications for Lista in your phone’s settings first.');
                return;
              }
              saveSetting('daily_nudge', v ? '1' : '0');
            }}
          />
        </Row>
        <Divider />
        <NavRow icon="share-outline" label="Export as CSV" onPress={doExport} />
        <Divider />
        <NavRow icon="refresh-outline" label="Reset all data" onPress={doReset} danger />
      </Group>

      <Pressable onPress={secretTap} hitSlop={12} style={{ marginTop: 24, paddingVertical: 6 }}>
        <Txt size={12} color="faint" center>Lista v1.1 · Ilista mo na. 💚</Txt>
      </Pressable>
      <LoveNote visible={love} onClose={() => setLove(false)} />

      <Sheet visible={lockSheet} onClose={() => setLockSheet(false)} title="App lock 🔒">
        {settings.pin && !pinStep.changing ? (
          <View>
            <Txt size={14} color="sub">Lista asks for your PIN when you open it. Walang makakasilip sa utang list mo 👀</Txt>
            {bioAvail ? (
              <Row style={{ marginTop: 14, backgroundColor: theme.card, borderRadius: 18, padding: 14, justifyContent: 'space-between', borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flex: 1 }}>
                  <Txt w={700} size={14.5}>Unlock with fingerprint</Txt>
                  <Txt size={12.5} color="sub">Faster than typing your PIN</Txt>
                </View>
                <Switch
                  value={settings.lock_bio === '1'}
                  onValueChange={(v) => saveSetting('lock_bio', v ? '1' : '0')}
                  trackColor={{ true: theme.brand, false: theme.border }}
                  thumbColor="#FFFFFF"
                />
              </Row>
            ) : null}
            <Button title="Change PIN" variant="ghost" size="md" style={{ marginTop: 14 }} onPress={() => setPinStep({ first: null, error: 0, changing: true })} />
            <Button
              title="Turn off app lock"
              variant="danger"
              size="md"
              style={{ marginTop: 8 }}
              onPress={async () => {
                await saveSetting('pin', null);
                setLockSheet(false);
              }}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Txt w={700} size={15} color={pinStep.error ? 'red' : 'sub'} style={{ marginBottom: 18 }}>
              {pinStep.error ? 'PINs didn’t match, try again 🙈' : pinStep.first ? 'Type it again to confirm' : 'Choose a 4-digit PIN'}
            </Txt>
            <PinPad
              error={pinStep.error}
              onComplete={async (pin) => {
                if (!pinStep.first) {
                  setPinStep((s) => ({ ...s, first: pin }));
                  return;
                }
                if (pin !== pinStep.first) {
                  setPinStep((s) => ({ ...s, first: null, error: s.error + 1 }));
                  return;
                }
                await saveSetting('pin', hashPin(pin));
                tap('success');
                setLockSheet(false);
                Alert.alert('App lock is on 🔒', 'Don’t forget your PIN! If you do, the only way in is to reset Lista.');
              }}
            />
          </View>
        )}
      </Sheet>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'name' ? 'Your name' : 'Monthly budget'}>
        {editing === 'budget' ? (
          <Txt size={13.5} color="sub" style={{ marginBottom: 12 }}>
            How much do you want to spend per month? Set 0 to turn it off.
          </Txt>
        ) : null}
        <Field
          value={value}
          onChangeText={(t) => setValue(editing === 'budget' ? cleanAmountInput(t) : t)}
          keyboardType={editing === 'budget' ? 'decimal-pad' : 'default'}
          autoFocus
          placeholder={editing === 'budget' ? '5000' : 'Your name'}
          right={editing === 'budget' ? <Txt w={800} size={18} color="faint">₱</Txt> : null}
          autoCapitalize="words"
        />
        <Button
          title="Save"
          style={{ marginTop: 16 }}
          onPress={async () => {
            if (editing === 'name') await saveSetting('name', value.trim());
            else await saveSetting('budget', String(toCentavos(value)));
            setEditing(null);
          }}
        />
      </Sheet>

      <Sheet visible={catSheet} onClose={() => setCatSheet(false)} title="Categories">
        <Segmented
          value={catKind}
          onChange={setCatKind}
          options={[
            { value: 'expense', label: 'Expense', emoji: '💸' },
            { value: 'income', label: 'Income', emoji: '💰' },
          ]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {kindCats.map((c) => (
            <Chip
              key={c.id}
              label={c.kind === 'expense' && c.budget ? `${c.name} · ${pesoShort(c.budget)}` : c.name}
              emoji={c.emoji}
              tintName={c.color}
              selected={editCat?.id !== c.id}
              small
              onPress={() => {
                setEditCat(c);
                setCatBudget(centavosToInput(c.budget || 0));
              }}
            />
          ))}
        </View>
        <Txt size={12} color="faint" style={{ marginTop: 8 }}>
          {catKind === 'expense' ? 'Tap a category to set a monthly budget 🎯' : 'Tap a custom category to remove it.'}
        </Txt>

        {editCat ? (
          <Card style={{ marginTop: 12 }} padding={14}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt w={800} size={15}>{editCat.emoji} {editCat.name}</Txt>
              <IconButton icon="close" size={32} tint="cardAlt" onPress={() => setEditCat(null)} label="Close" />
            </Row>
            {editCat.kind === 'expense' ? (
              <>
                <Txt size={12.5} color="sub" style={{ marginTop: 6 }}>Monthly budget (leave empty for none). We’ll warn you at 80%.</Txt>
                <Field
                  value={catBudget}
                  onChangeText={(t) => setCatBudget(cleanAmountInput(t))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 3000"
                  style={{ marginTop: 10 }}
                  right={<Txt w={800} size={18} color="faint">₱</Txt>}
                />
                <Button
                  title="Save budget"
                  size="md"
                  style={{ marginTop: 10 }}
                  onPress={async () => {
                    await setCategoryBudget(db, editCat.id, toCentavos(catBudget));
                    tap('success');
                    setEditCat(null);
                    bump();
                    reload();
                  }}
                />
              </>
            ) : null}
            {!editCat.is_default ? (
              <Button
                title="Remove category"
                variant="danger"
                size="md"
                style={{ marginTop: 8 }}
                onPress={() => {
                  removeCategory(editCat);
                  setEditCat(null);
                }}
              />
            ) : null}
          </Card>
        ) : null}

        <Txt w={800} size={15} style={{ marginTop: 20, marginBottom: 10 }}>Add new</Txt>
        <Field placeholder="Name, e.g. Milk tea" value={newCat.name} onChangeText={(t) => setNewCat((s) => ({ ...s, name: t }))} maxLength={20} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {EMOJI_CHOICES.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                tap();
                setNewCat((s) => ({ ...s, emoji: e }));
              }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: newCat.emoji === e ? theme.brandTint : theme.card,
                borderWidth: 1.5,
                borderColor: newCat.emoji === e ? theme.brand : theme.border,
              }}
            >
              <Txt size={20}>{e}</Txt>
            </Pressable>
          ))}
        </View>
        <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {swatchNames.map((n) => {
            const sw = swatch(theme, n);
            const on = newCat.color === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  tap();
                  setNewCat((s) => ({ ...s, color: n }));
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: sw.tint,
                  borderWidth: on ? 3 : 1.5,
                  borderColor: on ? sw.ink : theme.border,
                }}
              />
            );
          })}
        </Row>
        <Button title="Add category" icon="add" style={{ marginTop: 18 }} onPress={createCategory} disabled={!newCat.name.trim()} />
      </Sheet>
    </Screen>
  );
}

function Group({ title, children }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Txt w={800} size={13} color="sub" style={{ marginBottom: 8, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </Txt>
      <Card padding={14} style={{ paddingVertical: 4 }}>{children}</Card>
    </View>
  );
}
