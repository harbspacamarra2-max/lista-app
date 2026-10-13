import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import {
  getBudgetStatus,
  getOverview,
  getStreak,
  getUtangSummary,
  getWallets,
  listBills,
  listGroups,
  listCategories,
  listGoals,
  listTransactions,
  payBill,
  setBillReminder,
} from '../../lib/db';
import { addDays, daysBetween, dueLabel, greeting, monthKey, monthName, peso, prettyDate, today } from '../../lib/format';
import { cancelReminder, scheduleBillReminder } from '../../lib/notify';
import { aiReady } from '../../lib/ai';
import { pick } from '../../lib/quips';
import { useData, useQuery, useSettings } from '../../lib/store';
import { fonts, radius, useTheme } from '../../lib/theme';
import { checkForUpdate } from '../../lib/updates';
import { Avatar, Badge, Card, EmptyState, GradientCard, IconButton, ProgressBar, Row, Screen, SectionHeader, Txt, tap } from '../../components/ui';
import { StatPill, TransactionRow } from '../../components/bits';
import { GoalMini } from '../../components/goals';
import { useSmartLog } from '../../components/smart';

const addDaysIso = (n) => addDays(today(), n);

export default function Home() {
  const theme = useTheme();
  const settings = useSettings();
  const [tip, setTip] = useState(() => pick('homeTip'));
  useFocusEffect(useCallback(() => setTip(pick('homeTip')), []));
  const sqlite = useSQLiteContext();
  const { bump, toast } = useData();
  const [quick, setQuick] = useState('');
  const smart = useSmartLog();
  const aiOn = aiReady(settings);
  const quickLog = async () => {
    const text = quick.trim();
    if (!text || smart.busy) return;
    const handled = await smart.understand(text);
    setQuick('');
    if (!handled) router.push(`/add?prefill=${encodeURIComponent(text)}`);
  };
  const markBillPaid = async (b) => {
    await cancelReminder(b.reminder_id);
    const next = await payBill(sqlite, b);
    if (b.remind) {
      const rid = await scheduleBillReminder({ date: next, name: b.name, amount: b.amount, billId: b.id });
      await setBillReminder(sqlite, b.id, rid);
    }
    tap('success');
    bump();
    toast(`${b.emoji} ${b.name} paid! Next due ${prettyDate(next)} ✅`);
  };
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    checkForUpdate().then(setUpdate);
  }, []);
  const { data } = useQuery(async (db) => {
    const [overview, utang, recent, streak, goals, budgets, categories, bills, wallets, groups] = await Promise.all([
      getOverview(db),
      getUtangSummary(db),
      listTransactions(db, { limit: 5 }),
      getStreak(db),
      listGoals(db),
      getBudgetStatus(db),
      listCategories(db),
      listBills(db),
      getWallets(db),
      listGroups(db),
    ]);
    return {
      overview, utang, recent, streak, goals, budgets, categories, bills,
      wallets: { used: wallets.some((w) => w.setUp), total: wallets.reduce((t, w) => t + w.balance, 0) },
      groups: groups.length,
    };
  });

  if (settings.onboarded !== '1') return <Redirect href="/onboarding" />;

  const name = settings.name || 'there';
  const budget = Number(settings.budget || 0);
  const o = data?.overview || { spentToday: 0, spentWeek: 0, spentMonth: 0, incomeMonth: 0 };
  const u = data?.utang || { totalOwe: 0, totalOwed: 0, dueSoon: [] };
  const left = budget - o.spentMonth;
  const used = budget ? o.spentMonth / budget : 0;
  const month = monthName(monthKey());

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Txt w={600} size={14} color="sub">{greeting()} ✌️</Txt>
          <Txt numberOfLines={1} style={{ marginTop: -2 }}>
            <Txt serif size={40}>hey, </Txt>
            <Txt serif="italic" size={40} color="brand">{name.toLowerCase()}</Txt>
          </Txt>
          <Txt w={600} size={13} color="sub" numberOfLines={1}>{tip}</Txt>
        </View>
        <Row gap={8}>
          {data?.streak ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 999, paddingHorizontal: 12, height: 40, justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
              <Txt w={800} size={13.5}>🔥 {data.streak}</Txt>
            </View>
          ) : null}
          <IconButton icon="settings-outline" onPress={() => router.push('/settings')} label="Settings" />
        </Row>
      </Row>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.border,
          paddingLeft: 14,
          paddingRight: 6,
          marginBottom: 14,
          height: 52,
        }}
      >
        <Txt size={18}>{aiOn ? '✨' : '✍️'}</Txt>
        <TextInput
          value={quick}
          onChangeText={setQuick}
          onSubmitEditing={quickLog}
          returnKeyType="done"
          editable={!smart.busy}
          placeholder={aiOn ? 'Say it: JM umutang 350 sa Friday' : 'Type it: jeep 13, JM umutang 350'}
          placeholderTextColor={theme.faint}
          style={{ flex: 1, marginLeft: 10, fontFamily: fonts[600], fontSize: 15, color: theme.text, paddingVertical: 10 }}
        />
        {smart.busy ? (
          <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.brand} />
          </View>
        ) : quick.trim() ? (
          <Pressable
            onPress={quickLog}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-up" size={20} color={theme.onBrand} />
          </Pressable>
        ) : (
          <Pressable
            onPress={smart.scan}
            accessibilityLabel="Scan a receipt"
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="scan-outline" size={20} color={theme.text} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => router.push('/ask')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: theme.lilac,
          borderRadius: 18,
          paddingHorizontal: 14,
          height: 46,
          marginBottom: 14,
          marginTop: -4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Txt size={17}>💬</Txt>
        <Txt w={700} size={14} color={theme.lilacInk} style={{ flex: 1 }} numberOfLines={1}>Ask Sinop: “Saan napunta pera ko?”</Txt>
        <Ionicons name="chevron-forward" size={18} color={theme.lilacInk} />
      </Pressable>

      {update ? (
        <Card tint="lilac" style={{ marginBottom: 12 }} padding={14} onPress={() => Linking.openURL(update.url)}>
          <Row gap={12}>
            <Txt size={26}>✨</Txt>
            <View style={{ flex: 1 }}>
              <Txt w={800} size={15} color={theme.lilacInk}>New version available (v{update.version})</Txt>
              <Txt size={12.5} color={theme.lilacInk}>Tap to download, then open it to update. Your data stays.</Txt>
            </View>
          </Row>
        </Card>
      ) : null}

      {Platform.OS === 'web' && (data?.recent?.length || 0) > 0 && (!settings.last_backup || daysBetween(settings.last_backup, today()) > 14) ? (
        <Card tint="butter" style={{ marginBottom: 12 }} padding={14} onPress={() => router.push('/settings')}>
          <Row gap={12}>
            <Txt size={26}>💾</Txt>
            <View style={{ flex: 1 }}>
              <Txt w={800} size={15} color={theme.butterInk}>Back up your data</Txt>
              <Txt size={12.5} color={theme.butterInk}>Browsers can clear saved data. Save a backup file in Settings, just in case.</Txt>
            </View>
          </Row>
        </Card>
      ) : null}

      <GradientCard>
        <Txt w={600} size={14} color={theme.onBrand} style={{ opacity: 0.85 }}>
          {budget ? `Left to spend in ${month}` : `Spent in ${month}`}
        </Txt>
        <Txt w={800} size={38} color={theme.onBrand} style={{ marginTop: 4 }}>
          {budget ? peso(Math.max(left, 0)) : peso(o.spentMonth)}
        </Txt>
        {budget ? (
          <View style={{ marginTop: 14 }}>
            <ProgressBar
              value={used}
              color={used > 0.9 ? theme.yellow : theme.onBrand}
              track="rgba(255,255,255,0.25)"
              height={9}
            />
            <Txt w={600} size={12.5} color={theme.onBrand} style={{ marginTop: 8, opacity: 0.9 }}>
              {left < 0
                ? `Budget? Never heard of her. 💅 Over by ${peso(-left)}`
                : used >= 0.9
                  ? `Hinay-hinay, bestie 😭 ${Math.round(used * 100)}% used`
                  : `${peso(o.spentMonth)} of ${peso(budget)} used · ${Math.round(used * 100)}%`}
            </Txt>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/settings')}>
            <Txt w={700} size={13} color={theme.onBrand} style={{ marginTop: 10, opacity: 0.9 }}>
              Set a monthly budget →
            </Txt>
          </Pressable>
        )}
        <Row style={{ marginTop: 18 }} gap={10}>
          <HeroChip icon="arrow-down" label="Income" value={peso(o.incomeMonth)} />
          <HeroChip icon="arrow-up" label="Spent" value={peso(o.spentMonth)} />
        </Row>
      </GradientCard>

      <Row style={{ marginTop: 12 }} gap={10}>
        <StatPill label="Today" value={peso(o.spentToday)} />
        <StatPill label="This week" value={peso(o.spentWeek)} />
      </Row>

      <Row gap={10} style={{ marginTop: 10 }}>
        <QuickLink emoji="👛" label="Wallets" value={data?.wallets?.used ? peso(data.wallets.total) : 'Set up'} onPress={() => router.push('/wallets')} />
        <QuickLink emoji="👯" label="Barkadas" value={data?.groups ? `${data.groups} ${data.groups === 1 ? 'group' : 'groups'}` : 'Make one'} onPress={() => router.push('/groups')} />
      </Row>

      <SectionHeader title="Utang" action="See all" onAction={() => router.navigate('/utang')} />
      <Row gap={10}>
        <UtangTile title="You owe" emoji="🫣" amount={u.totalOwe} tint="peach" ink="peachInk" />
        <UtangTile title="Owed to you" emoji="🤑" amount={u.totalOwed} tint="mint" ink="mintInk" />
      </Row>

      {u.dueSoon.length ? (
        <Card style={{ marginTop: 12 }} padding={14}>
          <Txt w={800} size={14} style={{ marginBottom: 6, marginLeft: 4 }}>⏰ Due soon</Txt>
          {u.dueSoon.slice(0, 3).map((d) => {
            const due = dueLabel(d.due_date);
            return (
              <Pressable
                key={d.id}
                onPress={() => {
                  tap();
                  router.push(`/person/${d.person_id}`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}
              >
                <Avatar emoji={d.person_emoji} tintName={d.direction === 'owe' ? 'peach' : 'mint'} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt w={700} size={14.5} numberOfLines={1}>
                    {d.direction === 'owe' ? `Pay ${d.person_name}` : `${d.person_name} pays you`}
                  </Txt>
                  <View style={{ marginTop: 4 }}>
                    <Badge text={due.text} tone={due.tone} />
                  </View>
                </View>
                <Txt w={800} size={15}>{peso(d.remaining)}</Txt>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <SectionHeader title="Bills" action={data?.bills?.length ? 'Manage' : null} onAction={() => router.push('/bills')} />
      {(data?.bills || []).length ? (
        <Card padding={12}>
          {data.bills
            .filter((b) => b.next_due <= addDaysIso(7))
            .slice(0, 4)
            .map((b) => {
              const due = dueLabel(b.next_due);
              return (
                <Row key={b.id} gap={12} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
                  <Avatar emoji={b.emoji} tintName={b.category_color || 'butter'} size={42} />
                  <View style={{ flex: 1 }}>
                    <Txt w={700} size={14.5} numberOfLines={1}>{b.name} · {peso(b.amount)}</Txt>
                    <View style={{ marginTop: 4 }}>
                      <Badge text={due.text} tone={due.tone} />
                    </View>
                  </View>
                  <Pressable
                    onPress={() => markBillPaid(b)}
                    style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: theme.brandTint, justifyContent: 'center' }}
                  >
                    <Txt w={800} size={13} color={theme.mode === 'light' ? theme.brandDeep : theme.brand}>Bayad ✓</Txt>
                  </Pressable>
                </Row>
              );
            })}
          {!data.bills.some((b) => b.next_due <= addDaysIso(7)) ? (
            <Pressable onPress={() => router.push('/bills')} style={{ padding: 8 }}>
              <Txt w={600} size={13.5} color="sub">
                Nothing due this week 😌 Next: {data.bills[0].emoji} {data.bills[0].name} on {prettyDate(data.bills[0].next_due)}
              </Txt>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <Card onPress={() => router.push('/bills')} padding={16}>
          <Row gap={12}>
            <Txt size={28}>🔁</Txt>
            <View style={{ flex: 1 }}>
              <Txt w={800} size={15}>Add your bills & subscriptions</Txt>
              <Txt size={13} color="sub">Netflix, rent, load, tuition… we’ll remind you before they’re due.</Txt>
            </View>
            <Txt w={800} size={18} color="brand">→</Txt>
          </Row>
        </Card>
      )}

      {(data?.budgets || []).some((b) => b.pct >= 0.8) ? (
        <Card style={{ marginTop: 12 }} padding={14}>
          <Txt w={800} size={14} style={{ marginBottom: 8, marginLeft: 2 }}>🎯 Budget check</Txt>
          {data.budgets
            .filter((b) => b.pct >= 0.8)
            .slice(0, 3)
            .map((b) => (
              <View key={b.id} style={{ paddingVertical: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt w={700} size={14}>{b.emoji} {b.name}</Txt>
                  <Txt w={700} size={13} color={b.pct >= 1 ? theme.red : theme.amber}>
                    {b.pct >= 1 ? `Over by ${peso(b.spent - b.budget)} 😭` : `${Math.round(b.pct * 100)}% used`}
                  </Txt>
                </Row>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar value={b.pct} color={b.pct >= 1 ? theme.red : theme.amber} height={7} />
                </View>
              </View>
            ))}
        </Card>
      ) : null}

      <SectionHeader title="Ipon goals" action={data?.goals?.length ? 'See all' : null} onAction={() => router.push('/goals')} />
      {data?.goals?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
          {data.goals.map((g) => (
            <GoalMini key={g.id} g={g} />
          ))}
          <Card onPress={() => router.push('/goals')} padding={14} style={{ width: 120, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={26}>➕</Txt>
            <Txt w={700} size={13} color="sub" center style={{ marginTop: 6 }}>New goal</Txt>
          </Card>
        </ScrollView>
      ) : (
        <Card onPress={() => router.push('/goals')} padding={16}>
          <Row gap={12}>
            <Txt size={30}>🐷</Txt>
            <View style={{ flex: 1 }}>
              <Txt w={800} size={15}>Start an ipon goal</Txt>
              <Txt size={13} color="sub">New phone? Beach trip? Save for it little by little.</Txt>
            </View>
            <Txt w={800} size={18} color="brand">→</Txt>
          </Row>
        </Card>
      )}

      <SectionHeader title="Recent" action={data?.recent?.length ? 'See all' : null} onAction={() => router.navigate('/activity')} />
      <Card padding={data?.recent?.length ? 12 : 0}>
        {data && !data.recent.length ? (
          <EmptyState
            emoji="📝"
            title="Wala pang lista! ✍️"
            body="Your wallet is suspiciously quiet 🤫 Tap + to log your first gastos."
            action="Add expense"
            onAction={() => router.push('/add')}
          />
        ) : (
          (data?.recent || []).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} showDate onPress={() => router.push(`/add?id=${tx.id}`)} />
          ))
        )}
      </Card>
      {smart.sheet}
    </Screen>
  );
}

function HeroChip({ icon, label, value }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={theme.onBrand} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt w={600} size={11.5} color={theme.onBrand} style={{ opacity: 0.85 }}>{label}</Txt>
        <Txt w={800} size={14.5} color={theme.onBrand} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      </View>
    </View>
  );
}

function UtangTile({ title, emoji, amount, tint, ink }) {
  const theme = useTheme();
  return (
    <Card tint={tint} style={{ flex: 1 }} onPress={() => router.navigate('/utang')}>
      <Txt size={22}>{emoji}</Txt>
      <Txt w={700} size={13} color={theme[ink]} style={{ marginTop: 10 }}>{title}</Txt>
      <Txt w={800} size={20} color={theme[ink]} numberOfLines={1} adjustsFontSizeToFit>{peso(amount)}</Txt>
    </Card>
  );
}

function QuickLink({ emoji, label, value, onPress }) {
  return (
    <Card onPress={onPress} padding={14} style={{ flex: 1 }}>
      <Row gap={10}>
        <Txt size={22}>{emoji}</Txt>
        <View style={{ flex: 1 }}>
          <Txt w={700} size={12.5} color="sub">{label}</Txt>
          <Txt w={800} size={15.5} numberOfLines={1}>{value}</Txt>
        </View>
      </Row>
    </Card>
  );
}
