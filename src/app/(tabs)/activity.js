import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/alert';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteTransaction, listTransactions } from '../../lib/db';
import { monthKey, peso, prettyDate } from '../../lib/format';
import { useData, useQuery } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { Card, Chip, EmptyState, Field, Row, Screen, Title, Txt } from '../../components/ui';
import { MonthSwitcher, TransactionRow } from '../../components/bits';

export default function Activity() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { bump } = useData();
  const [month, setMonth] = useState(monthKey());
  const [kind, setKind] = useState(null);
  const [search, setSearch] = useState('');

  const { data } = useQuery((d) => listTransactions(d, { month, kind, search: search.trim() || undefined }), [month, kind, search]);

  const groups = useMemo(() => {
    const out = [];
    for (const tx of data || []) {
      let g = out[out.length - 1];
      if (!g || g.date !== tx.date) {
        g = { date: tx.date, items: [], spent: 0, earned: 0 };
        out.push(g);
      }
      g.items.push(tx);
      if (tx.kind === 'expense') g.spent += tx.amount;
      else g.earned += tx.amount;
    }
    return out;
  }, [data]);

  const totals = useMemo(() => {
    let spent = 0;
    let earned = 0;
    for (const tx of data || []) {
      if (tx.kind === 'expense') spent += tx.amount;
      else earned += tx.amount;
    }
    return { spent, earned };
  }, [data]);

  const confirmDelete = (tx) => {
    Alert.alert('Delete this?', `${tx.note || tx.category_name} · ${peso(tx.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, tx.id);
          bump();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Title main="your" italic="activity" sub="Every peso in and out, day by day." />

      <Field
        placeholder="Search notes or categories"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        right={<Ionicons name="search" size={18} color={theme.faint} />}
      />

      <Row style={{ marginTop: 12 }} gap={8}>
        <Chip label="All" selected={!kind} onPress={() => setKind(null)} small />
        <Chip label="Expenses" emoji="💸" selected={kind === 'expense'} onPress={() => setKind('expense')} small />
        <Chip label="Income" emoji="💰" selected={kind === 'income'} onPress={() => setKind('income')} small />
      </Row>

      <MonthSwitcher value={month} onChange={setMonth} style={{ marginTop: 18 }} />

      <Row style={{ marginTop: 14 }} gap={10}>
        <Card style={{ flex: 1 }} padding={14} tint="peach">
          <Txt w={700} size={12} color={theme.peachInk}>Spent</Txt>
          <Txt w={800} size={18} color={theme.peachInk} numberOfLines={1} adjustsFontSizeToFit>{peso(totals.spent)}</Txt>
        </Card>
        <Card style={{ flex: 1 }} padding={14} tint="mint">
          <Txt w={700} size={12} color={theme.mintInk}>Earned</Txt>
          <Txt w={800} size={18} color={theme.mintInk} numberOfLines={1} adjustsFontSizeToFit>{peso(totals.earned)}</Txt>
        </Card>
      </Row>

      {data && !groups.length ? (
        <Card style={{ marginTop: 18 }} padding={0}>
          <EmptyState
            emoji={search ? '🔍' : '🌱'}
            title={search ? 'Nothing found 🕵️' : 'Suspiciously quiet here 🤫'}
            body={search ? 'Try a different word.' : 'Either you saved money this month or you forgot to log. Sana all 😌'}
          />
        </Card>
      ) : null}

      {groups.map((g) => (
        <View key={g.date} style={{ marginTop: 20 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
            <Txt w={800} size={14}>{prettyDate(g.date)}</Txt>
            <Txt w={700} size={13} color="sub">
              {g.spent ? `−${peso(g.spent)}` : ''}
              {g.spent && g.earned ? '  ' : ''}
              {g.earned ? `+${peso(g.earned)}` : ''}
            </Txt>
          </Row>
          <Card padding={10}>
            {g.items.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onPress={() => router.push(`/add?id=${tx.id}`)}
                onLongPress={() => confirmDelete(tx)}
              />
            ))}
          </Card>
        </View>
      ))}

      {groups.length ? (
        <Txt size={12} color="faint" center style={{ marginTop: 18 }}>
          Tap to edit · long-press to delete
        </Txt>
      ) : null}
    </Screen>
  );
}
