import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { getUtangSummary, listGroups } from '../lib/db';
import { peso } from '../lib/format';
import { useData, useQuery } from '../lib/store';
import { useTheme } from '../lib/theme';
import { Avatar, Card, EmptyState, IconButton, Row, Screen, Title, Txt } from '../components/ui';
import { GroupSheet } from '../components/barkada';
import { goBack } from '../lib/nav';

export default function Groups() {
  const theme = useTheme();
  const { bump } = useData();
  const [sheet, setSheet] = useState(false);
  const { data } = useQuery(async (d) => {
    const [groups, utang] = await Promise.all([listGroups(d), getUtangSummary(d)]);
    const byId = new Map(utang.people.map((p) => [p.id, p]));
    return groups.map((g) => {
      let owed = 0;
      let owe = 0;
      for (const m of g.members) {
        const u = byId.get(m.id);
        if (u) {
          owed += u.owed;
          owe += u.owe;
        }
      }
      return { ...g, owed, owe };
    });
  });

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <IconButton icon="chevron-back" onPress={() => goBack()} label="Back" />
        <IconButton icon="add" onPress={() => setSheet(true)} label="New barkada" />
      </Row>
      <Title main="your" italic="barkadas" sub="Groups for hati-hati and checking who owes what." />

      {data && !data.length ? (
        <Card padding={0}>
          <EmptyState
            emoji="👯"
            title="No barkada yet"
            body="Make a group for your tropa, block mates, or fam. Split bills with everyone in one tap."
            action="Create one"
            onAction={() => setSheet(true)}
          />
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {(data || []).map((g) => (
          <Card key={g.id} onPress={() => router.push(`/group/${g.id}`)} padding={16}>
            <Row gap={12}>
              <Avatar emoji={g.emoji} tintName="lilac" size={50} />
              <View style={{ flex: 1 }}>
                <Txt w={800} size={16} numberOfLines={1}>{g.name}</Txt>
                <Txt size={12.5} color="sub" numberOfLines={1}>{g.members.map((m) => m.name).join(', ')}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {g.owed ? <Txt w={800} size={14} color={theme.mintInk}>+{peso(g.owed)}</Txt> : null}
                {g.owe ? <Txt w={800} size={14} color={theme.peachInk}>−{peso(g.owe)}</Txt> : null}
                {!g.owed && !g.owe ? <Txt w={700} size={13} color="faint">Quits 🤝</Txt> : null}
              </View>
            </Row>
          </Card>
        ))}
      </View>

      {sheet ? (
        <GroupSheet
          visible={sheet}
          onClose={() => setSheet(false)}
          onSaved={(id) => {
            setSheet(false);
            bump();
            router.push(`/group/${id}`);
          }}
        />
      ) : null}
    </Screen>
  );
}
