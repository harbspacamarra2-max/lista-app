import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { pick } from '../../lib/quips';
import { Ionicons } from '@expo/vector-icons';
import { getUtangSummary } from '../../lib/db';
import { dueLabel, peso } from '../../lib/format';
import { useQuery } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { Avatar, Badge, Button, Card, EmptyState, Row, Screen, Segmented, Title, Txt } from '../../components/ui';

export default function Utang() {
  const theme = useTheme();
  const [tab, setTab] = useState('owed');
  const [showSettled, setShowSettled] = useState(false);
  const { data } = useQuery((db) => getUtangSummary(db));
  const [lines, setLines] = useState({ owed: pick('borrowButton'), owe: pick('oweButton') });
  useFocusEffect(
    useCallback(() => {
      setLines({ owed: pick('borrowButton'), owe: pick('oweButton') });
    }, [])
  );

  const people = data?.people || [];
  const key = tab;
  const open = people
    .filter((p) => p[key] > 0)
    .sort((a, b) => {
      if (a.nextDue && b.nextDue) return a.nextDue < b.nextDue ? -1 : 1;
      if (a.nextDue) return -1;
      if (b.nextDue) return 1;
      return b[key] - a[key];
    });
  const settled = people.filter((p) => p.debts > 0 && p.owe === 0 && p.owed === 0);
  const total = tab === 'owe' ? data?.totalOwe || 0 : data?.totalOwed || 0;
  const isOwe = tab === 'owe';

  return (
    <Screen>
      <Title main="utang" italic="list" sub="Who owes whom, sorted. No more awkward hulaan." />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owed', label: 'Owed to me', emoji: '🤑' },
          { value: 'owe', label: 'I owe', emoji: '🫣' },
        ]}
      />

      <Card tint={isOwe ? 'peach' : 'mint'} style={{ marginTop: 14 }}>
        <Row style={{ justifyContent: 'space-between' }} align="flex-end">
          <View>
            <Txt w={700} size={13} color={isOwe ? theme.peachInk : theme.mintInk}>
              {isOwe ? 'Total you owe' : 'Total owed to you'}
            </Txt>
            <Txt w={800} size={32} color={isOwe ? theme.peachInk : theme.mintInk}>{peso(total)}</Txt>
          </View>
          <Txt w={700} size={13} color={isOwe ? theme.peachInk : theme.mintInk} style={{ marginBottom: 6 }}>
            {open.length} {open.length === 1 ? 'person' : 'people'}
          </Txt>
        </Row>
      </Card>

      <Row gap={8} style={{ marginTop: 12 }}>
        <Button
          title={isOwe ? lines.owe : lines.owed}
          icon="add-circle"
          variant="soft"
          size="md"
          style={{ flex: 1 }}
          onPress={() => router.push(`/add?type=utang&direction=${tab}`)}
        />
        {!isOwe ? (
          <Button title="🍕 Hati-hati" variant="dark" size="md" onPress={() => router.push('/split')} />
        ) : null}
      </Row>

      <View style={{ marginTop: 18, gap: 10 }}>
        {data && !open.length ? (
          <Card padding={0}>
            <EmptyState
              emoji={isOwe ? '😌' : '🕊️'}
              title={isOwe ? 'You’re debt-free! 💅' : 'Nobody owes you… yet 👀'}
              body={isOwe ? 'Wala kang utang. Love that for you.' : 'When someone borrows money, log it here so you never forget.'}
            />
          </Card>
        ) : null}
        {open.map((p) => (
          <PersonCard key={p.id} p={p} amount={p[key]} isOwe={isOwe} />
        ))}
      </View>

      {settled.length ? (
        <View style={{ marginTop: 22 }}>
          <Pressable onPress={() => setShowSettled((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
            <Txt w={800} size={15} color="sub">All settled ({settled.length})</Txt>
            <Ionicons name={showSettled ? 'chevron-up' : 'chevron-down'} size={16} color={theme.sub} />
          </Pressable>
          {showSettled ? (
            <View style={{ marginTop: 10, gap: 10 }}>
              {settled.map((p) => (
                <PersonCard key={p.id} p={p} amount={0} settled />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function PersonCard({ p, amount, isOwe, settled }) {
  const due = p.nextDue ? dueLabel(p.nextDue) : null;
  return (
    <Card onPress={() => router.push(`/person/${p.id}`)} padding={14}>
      <Row gap={12}>
        <Avatar emoji={p.emoji} tintName={settled ? 'stone' : isOwe ? 'peach' : 'mint'} size={48} />
        <View style={{ flex: 1 }}>
          <Txt w={800} size={16} numberOfLines={1}>{p.name}</Txt>
          <View style={{ marginTop: 5, flexDirection: 'row', gap: 6 }}>
            {settled ? (
              <Badge text="Settled ✓" tone="good" />
            ) : due ? (
              <Badge text={due.text} tone={due.tone} />
            ) : (
              <Badge text={`${p.open} open`} tone="calm" />
            )}
          </View>
        </View>
        <Txt w={800} size={17}>{settled ? '₱0' : peso(amount)}</Txt>
      </Row>
    </Card>
  );
}
