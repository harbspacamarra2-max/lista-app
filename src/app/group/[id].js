import { useState } from 'react';
import { Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteGroup, getGroup, getUtangSummary } from '../../lib/db';
import { peso } from '../../lib/format';
import { Alert } from '../../lib/alert';
import { useData, useQuery } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { Avatar, Button, Card, IconButton, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { GroupSheet } from '../../components/barkada';

export default function GroupScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump } = useData();
  const { id } = useLocalSearchParams();
  const gid = Number(id);
  const [editing, setEditing] = useState(false);

  const { data } = useQuery(async (d) => {
    const [group, utang] = await Promise.all([getGroup(d, gid), getUtangSummary(d)]);
    if (!group) return { group: null };
    const byId = new Map(utang.people.map((p) => [p.id, p]));
    const rows = group.members.map((m) => {
      const u = byId.get(m.id) || { owe: 0, owed: 0 };
      return { ...m, owe: u.owe, owed: u.owed, net: u.owed - u.owe };
    });
    rows.sort((a, b) => b.net - a.net);
    return { group, rows };
  }, [gid]);

  if (data && !data.group) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={() => router.back()} label="Back" />
        <Txt w={800} size={18} style={{ marginTop: 20 }}>This barkada was removed.</Txt>
      </Screen>
    );
  }
  const group = data?.group;
  const rows = data?.rows || [];
  const owedTotal = rows.reduce((s, r) => s + Math.max(0, r.net), 0);
  const oweTotal = rows.reduce((s, r) => s + Math.max(0, -r.net), 0);

  const remindAll = async () => {
    const lines = rows.filter((r) => r.net > 0).map((r) => `• ${r.name}: ${peso(r.net)}`);
    if (!lines.length) return;
    try {
      await Share.share({
        message: `Hi ${group.name}! ${group.emoji} Friendly singil lang po 😅\n\n${lines.join('\n')}\n\nSalamat sa pagbayad, mga lodi 🫶`,
      });
    } catch {
    }
  };

  const remove = () => {
    Alert.alert(`Delete ${group.name}?`, 'Only the group is removed. Everyone’s utang stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGroup(db, gid);
          bump();
          router.back();
        },
      },
    ]);
  };

  if (!group) return <Screen><View /></Screen>;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" onPress={() => router.back()} label="Back" />
        <Row gap={8}>
          <IconButton icon="create-outline" onPress={() => setEditing(true)} label="Edit" />
          <IconButton icon="trash-outline" tint="redTint" color="red" onPress={remove} label="Delete" />
        </Row>
      </Row>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Avatar emoji={group.emoji} tintName="lilac" size={84} />
        <Txt w={800} size={26} style={{ marginTop: 12 }}>{group.name}</Txt>
        <Txt size={13} color="sub">{rows.length} {rows.length === 1 ? 'member' : 'members'}</Txt>
      </View>

      <Row gap={10} style={{ marginTop: 18 }}>
        <Card tint="mint" style={{ flex: 1 }} padding={14}>
          <Txt w={700} size={12} color={theme.mintInk}>They owe you</Txt>
          <Txt w={800} size={20} color={theme.mintInk}>{peso(owedTotal)}</Txt>
        </Card>
        <Card tint="peach" style={{ flex: 1 }} padding={14}>
          <Txt w={700} size={12} color={theme.peachInk}>You owe them</Txt>
          <Txt w={800} size={20} color={theme.peachInk}>{peso(oweTotal)}</Txt>
        </Card>
      </Row>

      <Row gap={10} style={{ marginTop: 12 }}>
        <Button title="🍕 Hati-hati" size="md" style={{ flex: 1 }} onPress={() => router.push(`/split?groupId=${gid}`)} />
        {owedTotal > 0 ? <Button title="Singil all" icon="paper-plane" variant="dark" size="md" style={{ flex: 1 }} onPress={remindAll} /> : null}
      </Row>

      <SectionHeader title="Who owes what" />
      <Card padding={8}>
        {rows.map((r) => (
          <Card key={r.id} onPress={() => router.push(`/person/${r.id}`)} padding={10} style={{ borderWidth: 0, shadowOpacity: 0, elevation: 0 }}>
            <Row gap={12}>
              <Avatar emoji={r.emoji} tintName={r.net > 0 ? 'mint' : r.net < 0 ? 'peach' : 'stone'} size={42} />
              <View style={{ flex: 1 }}>
                <Txt w={800} size={15}>{r.name}</Txt>
                <Txt size={12} color="sub">
                  {r.net > 0 ? 'Owes you' : r.net < 0 ? 'You owe' : 'Quits'}
                  {r.owe && r.owed ? ' · net of both sides' : ''}
                </Txt>
              </View>
              <Txt w={800} size={15.5} color={r.net > 0 ? theme.mintInk : r.net < 0 ? theme.peachInk : 'faint'}>
                {r.net ? peso(Math.abs(r.net)) : '₱0'}
              </Txt>
            </Row>
          </Card>
        ))}
      </Card>
      <Txt size={12} color="faint" center style={{ marginTop: 12 }}>Tap someone to record payments or use “Quits na”.</Txt>

      {editing ? (
        <GroupSheet
          visible={editing}
          initial={group}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            bump();
          }}
        />
      ) : null}
    </Screen>
  );
}
