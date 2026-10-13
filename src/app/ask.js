import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listCategories, listPeople, setSetting } from '../lib/db';
import { aiChat, aiReady, friendlyAiError, hasAiKey } from '../lib/ai';
import { describeAction, executeAction, isValidAction } from '../lib/actions';
import { buildSnapshot } from '../lib/snapshot';
import { Alert } from '../lib/alert';
import { useData, useSettings } from '../lib/store';
import { fonts, radius, useTheme } from '../lib/theme';
import { Aura, Button, Card, IconButton, Row, Txt, tap } from '../components/ui';
import { ActionReview } from '../components/smart';

const STARTERS = [
  'Magkano nagastos ko this week?',
  'Sino may utang sa akin?',
  'Saan ako pinaka-gastos this month?',
  'Kaya ko pa ba budget ko?',
  'Tips para makaipon 🐷',
  'JM umutang 350 sa Friday',
];

const CLOSED = { visible: false, actions: [], reply: '', source: '', photo: null, stamp: 0, at: null };

const HELLO = [
  'Hi! Ask me anything about your gastos, utang, or ipon. Or tell me what to log 💚',
  'Uy! Ano tanong mo? Promise di kita ija-judge… masyado 😌',
  'Ready na ako. Chika mo na kung saan napunta pera mo 👀',
];

export default function Ask() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const { bump, refreshSettings, toast } = useData();
  const [hello] = useState(() => HELLO[Math.floor(Math.random() * HELLO.length)]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const [review, setReview] = useState(CLOSED);
  const on = aiReady(settings);

  const scrollDown = () => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);

  const send = async (raw) => {
    const q = String(raw ?? text).trim();
    if (!q || busy) return;
    setText('');
    const history = [...msgs, { role: 'me', text: q }];
    setMsgs(history);
    setBusy(true);
    scrollDown();
    try {
      const [snapshot, categories, people] = await Promise.all([buildSnapshot(db, settings), listCategories(db), listPeople(db)]);
      const { reply, actions } = await aiChat(history.slice(-12), snapshot, { categories, people });
      setMsgs((m) => [...m, { role: 'ai', text: reply || 'Hmm, wala akong masabi diyan 😅', actions: actions.map((a) => ({ a, state: 'new' })), categories }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: friendlyAiError(e), error: true }]);
    } finally {
      setBusy(false);
      scrollDown();
    }
  };

  const markSaved = (mi, ai) =>
    setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, actions: x.actions.map((y, j) => (j === ai ? { ...y, state: 'saved' } : y)) } : x)));

  const saveAction = async (mi, ai) => {
    const msg = msgs[mi];
    const item = msg.actions[ai];
    if (item.state !== 'new') return;
    try {
      const out = await executeAction(db, item.a, msg.categories || []);
      tap('success');
      bump();
      toast(out);
      markSaved(mi, ai);
    } catch (e) {
      Alert.alert('Not saved', e?.message || 'Try again.');
    }
  };

  const turnOn = () => {
    Alert.alert(
      'Turn on Sinop AI? ✨',
      'Sinop AI uses Google Gemini on the free plan, so Google may use what you send to improve their products. Ask Sinop sends a summary of your spending and utang with each question.\n\nDon’t type passwords, PINs, or account numbers.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Turn on',
          onPress: async () => {
            await setSetting(db, 'ai_on', '1');
            refreshSettings();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Aura height={320} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Row style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }} gap={12}>
          <IconButton icon="chevron-back" onPress={() => router.back()} label="Back" />
          <View style={{ flex: 1 }}>
            <Txt>
              <Txt serif size={34}>ask </Txt>
              <Txt serif="italic" size={34} color="brand">sinop</Txt>
            </Txt>
          </View>
          {msgs.length ? <IconButton icon="refresh" onPress={() => setMsgs([])} label="New chat" /> : null}
        </Row>

        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!on ? (
            <Card style={{ marginTop: 10 }}>
              <Txt size={40}>🤖</Txt>
              <Txt w={800} size={18} style={{ marginTop: 6 }}>Sinop AI is off</Txt>
              <Txt size={14} color="sub" style={{ marginTop: 4, lineHeight: 20 }}>
                {hasAiKey()
                  ? 'Turn it on to chat about your money, scan receipts, and log stuff by just typing it the way you talk.'
                  : 'AI isn’t available in this version of Sinop yet.'}
              </Txt>
              {hasAiKey() ? <Button title="Turn on Sinop AI ✨" style={{ marginTop: 16 }} onPress={turnOn} /> : null}
            </Card>
          ) : (
            <>
              <Bubble role="ai" text={hello} />
              {msgs.map((m, i) => (
                <View key={i}>
                  <Bubble role={m.role} text={m.text} error={m.error} />
                  {(m.actions || []).map((x, j) => {
                    const d = describeAction(x.a, m.categories || []);
                    const ok = isValidAction(x.a);
                    return (
                      <View
                        key={j}
                        style={{ alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: theme.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: theme.border, padding: 12, marginBottom: 8 }}
                      >
                        <Txt w={800} size={14.5}>{d.title}</Txt>
                        <Txt size={12.5} color="sub" style={{ marginTop: 2 }}>{d.sub}</Txt>
                        {x.state === 'saved' ? (
                          <Txt w={800} size={13} color="brand" style={{ marginTop: 8 }}>Saved ✓</Txt>
                        ) : (
                          <Row gap={8} style={{ marginTop: 10 }}>
                            <Button title="Save ✓" size="sm" disabled={!ok} onPress={() => saveAction(i, j)} />
                            <Button
                              title="Edit"
                              size="sm"
                              variant="ghost"
                              onPress={() => setReview({ visible: true, actions: [x.a], reply: '', source: 'ai', photo: null, stamp: Date.now(), at: [i, j] })}
                            />
                          </Row>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
              {busy ? (
                <View style={{ alignSelf: 'flex-start', backgroundColor: theme.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
                  <ActivityIndicator color={theme.brand} />
                </View>
              ) : null}
              {!msgs.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {STARTERS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => send(s)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 18,
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: theme.border,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                      <Txt w={700} size={13.5}>{s}</Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {on ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12, backgroundColor: theme.bg }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.card,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: theme.border,
                paddingLeft: 16,
                paddingRight: 6,
                minHeight: 52,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => send()}
                placeholder="Ask or tell me what to log…"
                placeholderTextColor={theme.faint}
                returnKeyType="send"
                multiline
                blurOnSubmit
                style={{ flex: 1, fontFamily: fonts[600], fontSize: 15, color: theme.text, paddingVertical: 12, maxHeight: 110 }}
              />
              <Pressable
                onPress={() => send()}
                disabled={!text.trim() || busy}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: text.trim() && !busy ? theme.brand : theme.cardAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-up" size={20} color={text.trim() && !busy ? theme.onBrand : theme.faint} />
              </Pressable>
            </View>
            <Txt size={11} color="faint" center style={{ marginTop: 6 }}>Sinop AI can be wrong. Double-check important stuff.</Txt>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ActionReview
        state={review}
        onClose={() => setReview(CLOSED)}
        onSaved={(done, failed) => {
          const at = review.at;
          setReview(CLOSED);
          bump();
          if (failed.length) {
            Alert.alert('Not saved', failed.join('\n'));
            return;
          }
          if (at) markSaved(at[0], at[1]);
          toast(done[0]);
        }}
      />
    </View>
  );
}

function Bubble({ role, text, error }) {
  const theme = useTheme();
  const me = role === 'me';
  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '86%',
        backgroundColor: me ? theme.brand : error ? theme.redTint : theme.card,
        borderRadius: 20,
        borderBottomRightRadius: me ? 6 : 20,
        borderBottomLeftRadius: me ? 20 : 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 8,
        borderWidth: me ? 0 : 1,
        borderColor: theme.border,
      }}
    >
      <Txt w={600} size={14.5} color={me ? theme.onBrand : error ? theme.red : 'text'} style={{ lineHeight: 21 }}>{text}</Txt>
    </View>
  );
}
