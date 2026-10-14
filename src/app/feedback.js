import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData, useSettings } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Alert } from '../lib/alert';
import { FEEDBACK_KINDS, RATINGS, isDeveloper, listFeedback, removeFeedback, sendFeedback, setFeedbackDone } from '../lib/feedback';
import { Button, Card, Chip, EmptyState, Field, IconButton, Row, Screen, Segmented, Txt, tap } from '../components/ui';

export default function Feedback() {
  const theme = useTheme();
  const settings = useSettings();
  const { toast, cloud } = useData();
  const dev = isDeveloper(cloud.user);
  const [tab, setTab] = useState('send');
  const [rating, setRating] = useState(0);
  const [kind, setKind] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(cloud.user?.email || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = !!message.trim() && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendFeedback({ rating, kind: kind || 'idea', message, contact, user: cloud.user });
      tap('success');
      setSent(true);
      setMessage('');
      setRating(0);
      setKind('');
    } catch {
      Alert.alert('Not sent yet', 'Looks like there’s no internet right now. Your message is still here, so try again in a bit. 📶');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} label="Back" />
        <Txt w={800} size={18}>Feedback</Txt>
        <View style={{ width: 44 }} />
      </Row>

      {dev ? (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'send', label: 'Send' },
            { value: 'inbox', label: 'Inbox' },
          ]}
          style={{ marginBottom: 18 }}
        />
      ) : null}

      {tab === 'inbox' && dev ? (
        <Inbox toast={toast} />
      ) : sent ? (
        <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 54 }}>💌</Text>
          <Txt w={800} size={20} center style={{ marginTop: 10 }}>Salamat{settings.name ? `, ${settings.name}` : ''}!</Txt>
          <Txt size={14} color="sub" center style={{ marginTop: 6, lineHeight: 20 }}>
            Got your message. Every bit of feedback helps make Sinop better for everyone. 💚
          </Txt>
          <Button title="Send another" variant="soft" size="md" style={{ marginTop: 18 }} onPress={() => setSent(false)} />
          <Button title="Back to Sinop" variant="ghost" size="md" style={{ marginTop: 10 }} onPress={() => router.back()} />
        </Card>
      ) : (
        <>
          <Card>
            <Txt w={800} size={20}>How’s Sinop for you? 💭</Txt>
            <Txt size={14} color="sub" style={{ marginTop: 4, lineHeight: 20 }}>
              Bugs, ideas, or just good vibes. We read everything and use it to decide what to fix and build next.
            </Txt>
            <Row style={{ justifyContent: 'space-between', marginTop: 18 }} gap={6}>
              {RATINGS.map((r) => {
                const on = rating === r.value;
                return (
                  <Pressable
                    key={r.value}
                    accessibilityRole="button"
                    accessibilityLabel={r.label}
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      tap();
                      setRating(r.value);
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 10,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: on ? theme.brand : theme.border,
                        backgroundColor: on ? theme.brandTint : theme.card,
                      },
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    <Text style={{ fontSize: on ? 30 : 26 }}>{r.emoji}</Text>
                    <Txt w={on ? 800 : 600} size={11} color={on ? 'text' : 'sub'} style={{ marginTop: 2 }}>{r.label}</Txt>
                  </Pressable>
                );
              })}
            </Row>
          </Card>

          <Txt w={800} size={13} color="sub" style={{ marginTop: 22, marginBottom: 10, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            What’s it about?
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {FEEDBACK_KINDS.map((k) => (
              <Chip key={k.key} emoji={k.emoji} label={k.label} selected={kind === k.key} onPress={() => setKind(kind === k.key ? '' : k.key)} />
            ))}
          </Row>

          <Field
            label="Tell us more"
            value={message}
            onChangeText={setMessage}
            placeholder={kind === 'bug' ? 'What happened? What were you doing when it broke?' : kind === 'idea' ? 'What would make Sinop better for you?' : 'Type anything, Taglish is okay!'}
            multiline
            maxLength={2000}
            inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
            style={{ marginTop: 22 }}
          />
          <Field
            label="Email or number (optional, so we can reply)"
            value={contact}
            onChangeText={setContact}
            placeholder="e.g. juan@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={120}
            style={{ marginTop: 14 }}
          />
          <Txt size={12.5} color="faint" style={{ marginTop: 10, marginLeft: 4, lineHeight: 18 }}>
            We only get what you type here, plus your app version. Never your money data.
          </Txt>
          <Button title={sending ? 'Sending…' : 'Send feedback'} icon="send" onPress={send} disabled={!canSend} style={{ marginTop: 18 }} />
        </>
      )}
    </Screen>
  );
}

function Inbox({ toast }) {
  const theme = useTheme();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await listFeedback());
    } catch {
      setError('Couldn’t load feedback. Check your internet, and make sure the Firestore rules are updated.');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = (items || []).filter((f) => (filter === 'all' ? true : filter === 'done' ? f.status === 'done' : f.status !== 'done'));
  const avg = items && items.filter((f) => f.rating).length
    ? (items.filter((f) => f.rating).reduce((s, f) => s + f.rating, 0) / items.filter((f) => f.rating).length).toFixed(1)
    : '–';
  const kindOf = (k) => FEEDBACK_KINDS.find((x) => x.key === k) || FEEDBACK_KINDS[1];

  const toggle = async (f) => {
    try {
      await setFeedbackDone(f.id, f.status !== 'done');
      setItems((list) => list.map((x) => (x.id === f.id ? { ...x, status: f.status === 'done' ? '' : 'done' } : x)));
      toast(f.status === 'done' ? 'Moved back to open' : 'Marked as done ✓');
    } catch {
      toast('Couldn’t update. Try again.');
    }
  };

  const remove = (f) => {
    Alert.alert('Delete this feedback?', f.message.slice(0, 80), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFeedback(f.id);
            setItems((list) => list.filter((x) => x.id !== f.id));
          } catch {
            toast('Couldn’t delete. Try again.');
          }
        },
      },
    ]);
  };

  if (items === null) return <Txt color="sub" center style={{ marginTop: 30 }}>Loading feedback…</Txt>;

  return (
    <View>
      <Row gap={10}>
        <Card style={{ flex: 1 }} padding={14}>
          <Txt w={800} size={24}>{items.length}</Txt>
          <Txt size={12.5} color="sub">messages</Txt>
        </Card>
        <Card style={{ flex: 1 }} padding={14}>
          <Txt w={800} size={24}>{items.filter((f) => f.status !== 'done').length}</Txt>
          <Txt size={12.5} color="sub">to work on</Txt>
        </Card>
        <Card style={{ flex: 1 }} padding={14}>
          <Txt w={800} size={24}>{avg}</Txt>
          <Txt size={12.5} color="sub">avg rating</Txt>
        </Card>
      </Row>
      <Row gap={8} style={{ marginTop: 16 }}>
        {[['open', 'To do'], ['done', 'Done'], ['all', 'All']].map(([v, label]) => (
          <Chip key={v} small label={label} selected={filter === v} onPress={() => setFilter(v)} />
        ))}
        <View style={{ flex: 1 }} />
        <IconButton
          icon="refresh"
          size={36}
          label="Refresh"
          onPress={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      </Row>
      {error ? <Txt size={13} color={theme.red} style={{ marginTop: 12 }}>{error}</Txt> : null}
      {refreshing ? <Txt size={12} color="faint" style={{ marginTop: 8 }}>Refreshing…</Txt> : null}
      {!shown.length ? (
        <EmptyState emoji="📭" title={filter === 'open' ? 'Nothing to work on' : 'No feedback here yet'} body="New messages from users will show up here." />
      ) : (
        shown.map((f) => {
          const k = kindOf(f.kind);
          const r = RATINGS.find((x) => x.value === f.rating);
          return (
            <Card key={f.id} style={{ marginTop: 12, opacity: f.status === 'done' ? 0.6 : 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt w={800} size={14}>{`${k.emoji} ${k.label}`}</Txt>
                <Text style={{ fontSize: 20 }}>{r ? r.emoji : ''}</Text>
              </Row>
              <Txt size={15} style={{ marginTop: 8, lineHeight: 21 }}>{f.message}</Txt>
              <Txt size={12} color="sub" style={{ marginTop: 10 }}>
                {[f.at ? new Date(f.at).toLocaleString() : 'just now', `v${f.version || '?'}`, f.platform, f.contact].filter(Boolean).join('  •  ')}
              </Txt>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Button title={f.status === 'done' ? 'Reopen' : 'Mark done'} size="sm" variant={f.status === 'done' ? 'ghost' : 'soft'} icon={f.status === 'done' ? 'arrow-undo' : 'checkmark'} onPress={() => toggle(f)} />
                <Button title="Delete" size="sm" variant="danger" icon="trash-outline" onPress={() => remove(f)} />
              </Row>
            </Card>
          );
        })
      )}
    </View>
  );
}
