import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteTransaction, listTransactions } from '../../lib/db';
import { useUndoDelete } from '../../lib/undo';
import { daysInMonth, monthKey, peso, pesoShort, prettyDate, today } from '../../lib/format';
import { useData, useQuery } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { Card, Chip, EmptyState, Field, Row, Screen, Segmented, Title, Txt, tap } from '../../components/ui';
import { MonthSwitcher, TransactionRow } from '../../components/bits';

export default function Activity() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [month, setMonth] = useState(monthKey());
  const [view, setView] = useState('list');
  const [day, setDay] = useState(null);
  const [kind, setKind] = useState(null);
  const [search, setSearch] = useState('');

  const { data } = useQuery((d) => listTransactions(d, { month, kind, search: search.trim() || undefined }), [month, kind, search]);

  const groups = useMemo(() => {
    const out = [];
    for (const tx of (data || []).filter((t) => view === 'list' || !day || t.date === day)) {
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
  }, [data, view, day]);

  const totals = useMemo(() => {
    let spent = 0;
    let earned = 0;
    for (const tx of data || []) {
      if (tx.kind === 'expense') spent += tx.amount;
      else earned += tx.amount;
    }
    return { spent, earned };
  }, [data]);

  const undoDelete = useUndoDelete();
  const confirmDelete = (tx) => {
    tap('medium');
    undoDelete('tx', tx.id, `Deleted ${tx.note || tx.category_name} · ${peso(tx.amount)}`, () => deleteTransaction(db, tx.id));
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

      <MonthSwitcher
        value={month}
        onChange={(m) => {
          setMonth(m);
          setDay(null);
        }}
        style={{ marginTop: 18 }}
      />

      <Segmented
        style={{ marginTop: 14 }}
        value={view}
        onChange={(v) => {
          setView(v);
          setDay(null);
        }}
        options={[
          { value: 'list', label: 'List', emoji: '📜' },
          { value: 'calendar', label: 'Calendar', emoji: '📅' },
        ]}
      />

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

      {view === 'calendar' ? (
        <SpendCalendar month={month} items={data || []} selected={day} onPick={(d) => setDay(d === day ? null : d)} />
      ) : null}

      {view === 'calendar' && day && !groups.length ? (
        <Txt size={13.5} color="sub" center style={{ marginTop: 16 }}>Walang gastos on {prettyDate(day)}. Sana all 😇</Txt>
      ) : null}

      {data && !groups.length && !(view === 'calendar' && day) ? (
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

function SpendCalendar({ month, items, selected, onPick }) {
  const theme = useTheme();
  const t = today();
  const { cells, totals, max } = useMemo(() => {
    const sums = {};
    for (const tx of items) {
      if (tx.kind !== 'expense') continue;
      sums[tx.date] = (sums[tx.date] || 0) + tx.amount;
    }
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const out = [];
    for (let i = 0; i < first; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth(month); d += 1) out.push(`${month}-${String(d).padStart(2, '0')}`);
    while (out.length % 7) out.push(null);
    return { cells: out, totals: sums, max: Math.max(1, ...Object.values(sums)) };
  }, [month, items]);

  return (
    <Card style={{ marginTop: 14 }} padding={12}>
      <View style={{ flexDirection: 'row' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Txt key={d} w={700} size={11.5} color="faint" center style={{ flex: 1, marginBottom: 6 }}>{d}</Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((iso, i) => {
          const spent = iso ? totals[iso] || 0 : 0;
          const heat = spent ? 0.18 + 0.82 * (spent / max) : 0;
          const isSel = iso && iso === selected;
          const future = iso && iso > t;
          return (
            <View key={iso || `e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 0.82, padding: 2.5 }}>
              {iso ? (
                <Pressable
                  onPress={() => {
                    tap();
                    onPick(iso);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? theme.brand : theme.cardAlt,
                    borderWidth: iso === t && !isSel ? 1.5 : 0,
                    borderColor: theme.brand,
                    opacity: future ? 0.45 : 1,
                    overflow: 'hidden',
                  }}
                >
                  {spent && !isSel ? (
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: theme.peachInk, opacity: heat * 0.32 }} />
                  ) : null}
                  <Txt w={800} size={13.5} color={isSel ? theme.onBrand : 'text'}>{Number(iso.slice(8))}</Txt>
                  <Txt w={700} size={9.5} color={isSel ? theme.onBrand : spent ? theme.peachInk : 'faint'} numberOfLines={1}>
                    {spent ? pesoShort(spent) : '·'}
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      <Txt size={11.5} color="faint" center style={{ marginTop: 8 }}>
        {selected ? 'Tap the day again to see the whole month' : 'Darker = mas malaki gastos. Tap a day to see it.'}
      </Txt>
    </Card>
  );
}
