import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, useWindowDimensions, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { PAYMENT_METHODS, getBudgetStatus, getMonthReport, getTagReport, setSetting, spendingByMethod } from '../../lib/db';
import { aiReady, aiTips, friendlyAiError } from '../../lib/ai';
import { buildSnapshot } from '../../lib/snapshot';
import { daysInMonth, monthKey, monthLabel, monthName, peso, shiftMonth, today } from '../../lib/format';
import { useData, useQuery, useSettings } from '../../lib/store';
import { swatch, useTheme } from '../../lib/theme';
import { Card, EmptyState, ProgressBar, Row, Screen, SectionHeader, Title, Txt } from '../../components/ui';
import { router } from 'expo-router';
import { BarChart, DonutChart, LegendRow, MonthSwitcher } from '../../components/bits';

export default function Reports() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(monthKey());
  const { data } = useQuery(async (db) => {
    const [rep, wallets, budgets, tags] = await Promise.all([getMonthReport(db, month), spendingByMethod(db, month), getBudgetStatus(db, month), getTagReport(db, month)]);
    return { ...rep, wallets, budgets, tags };
  }, [month]);

  const r = data || { byCategory: [], daily: [], spent: 0, income: 0, prevSpent: 0 };
  const net = r.income - r.spent;
  const days = daysInMonth(month);
  const dailyMap = new Map(r.daily.map((d) => [d.date, d.total]));
  const values = Array.from({ length: days }, (_, i) => dailyMap.get(`${month}-${String(i + 1).padStart(2, '0')}`) || 0);
  const isCurrent = month === monthKey();
  const todayIdx = isCurrent ? Number(today().slice(8)) - 1 : -1;
  const elapsed = isCurrent ? Number(today().slice(8)) : days;
  const avg = elapsed ? Math.round(r.spent / elapsed / 100) * 100 : 0;
  const biggestIdx = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const chartWidth = Math.min(width, 520) - 40 - 36;

  const donut = r.byCategory.map((c) => ({
    key: String(c.id ?? 'none'),
    value: c.total,
    color: swatch(theme, c.color).ink,
  }));

  let compare = null;
  if (r.prevSpent > 0 && r.spent > 0) {
    const diff = (r.spent - r.prevSpent) / r.prevSpent;
    const pct = Math.round(Math.abs(diff) * 100);
    const prevName = monthName(shiftMonth(month, -1));
    compare =
      diff <= 0
        ? { emoji: '🎉', text: `You spent ${pct}% less than in ${prevName}. Sana all! 🎉`, tint: 'mint', ink: 'mintInk' }
        : { emoji: '👀', text: `You spent ${pct}% more than in ${prevName}. Hinay-hinay lang, bestie.`, tint: 'peach', ink: 'peachInk' };
  }

  const top = r.byCategory[0];

  return (
    <Screen>
      <Title main="monthly" italic="recap" sub="Where your money went, minus the stress." />
      <MonthSwitcher value={month} onChange={setMonth} />

      <Row style={{ marginTop: 16 }} gap={10}>
        <Mini label="Income" value={peso(r.income)} tint="mint" ink="mintInk" />
        <Mini label="Spent" value={peso(r.spent)} tint="peach" ink="peachInk" />
        <Mini label="Net" value={peso(net, { sign: true })} tint="lilac" ink="lilacInk" />
      </Row>

      {compare ? (
        <Card tint={compare.tint} style={{ marginTop: 12 }} padding={14}>
          <Txt w={700} size={14} color={theme[compare.ink]}>{compare.emoji}  {compare.text}</Txt>
        </Card>
      ) : null}

      {r.spent > 0 ? (
        <Pressable
          onPress={() => router.push(`/wrapped?month=${month}`)}
          style={({ pressed }) => ({ marginTop: 12, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#784BA0', transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <Txt size={26}>🎁</Txt>
          <View style={{ flex: 1 }}>
            <Txt w={800} size={15} color="#FFFFFF">{`${monthName(month)} Wrapped${isCurrent ? ' (so far)' : ''}`}</Txt>
            <Txt w={600} size={12.5} color="#FFFFFF" style={{ opacity: 0.85 }}>Your month, roasted with love 😂</Txt>
          </View>
          <Txt w={800} size={18} color="#FFFFFF">›</Txt>
        </Pressable>
      ) : null}

      <AiTips month={month} hasData={r.spent > 0} />

      <SectionHeader title="Where it went" />
      <Card>
        {data && !r.byCategory.length ? (
          <EmptyState emoji="🧾" title="Zero gastos? Iconic." body="Log some expenses and your breakdown shows up here." />
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <DonutChart data={donut} centerTop="Total spent" centerBottom={peso(r.spent, { decimals: false })} />
            </View>
            {top ? (
              <Txt w={700} size={13.5} color="sub" center style={{ marginBottom: 10 }}>
                {top.emoji} {top.name} makes up {Math.round((top.total / Math.max(r.spent, 1)) * 100)}% of your spending
              </Txt>
            ) : null}
            {r.byCategory.map((c) => (
              <LegendRow
                key={String(c.id ?? 'none')}
                emoji={c.emoji}
                color={c.color}
                name={c.name}
                amount={c.total}
                pct={c.total / Math.max(r.spent, 1)}
                count={c.count}
              />
            ))}
          </>
        )}
      </Card>

      <SectionHeader title="Budgets" action="Edit" onAction={() => router.push('/settings?section=categories')} />
      <Card>
        {(data?.budgets || []).length ? (
          data.budgets.map((b) => {
            const sw = swatch(theme, b.color);
            const col = b.pct >= 1 ? theme.red : b.pct >= 0.8 ? theme.amber : sw.ink;
            return (
              <View key={b.id} style={{ paddingVertical: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt w={700} size={14.5}>{b.emoji} {b.name}</Txt>
                  <Txt w={700} size={13} color="sub">
                    <Txt w={800} size={13} color={col}>{peso(b.spent)}</Txt> / {peso(b.budget)}
                  </Txt>
                </Row>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar value={b.pct} color={col} height={8} />
                </View>
                <Txt size={12} color={b.pct >= 1 ? theme.red : 'sub'} style={{ marginTop: 4 }}>
                  {b.pct >= 1 ? `Over by ${peso(b.spent - b.budget)}. Budget? Never heard of her 💅` : `${peso(b.budget - b.spent)} left`}
                </Txt>
              </View>
            );
          })
        ) : (
          <EmptyState emoji="🎯" title="No budgets yet" body="Set a monthly limit per category, like Food ₱3,000." action="Set budgets" onAction={() => router.push('/settings?section=categories')} />
        )}
      </Card>

      {(data?.wallets || []).length ? (
        <>
          <SectionHeader title="Paid with" />
          <Card>
            {data.wallets.map((w) => {
              const m = PAYMENT_METHODS.find((x) => x.key === w.method) || PAYMENT_METHODS[0];
              const pct = w.total / Math.max(r.spent, 1);
              return (
                <View key={w.method} style={{ paddingVertical: 7 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt w={700} size={14.5}>{m.emoji} {m.label}</Txt>
                    <Txt w={800} size={14.5}>{peso(w.total)}</Txt>
                  </Row>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar value={pct} height={7} />
                  </View>
                  <Txt size={12} color="sub" style={{ marginTop: 3 }}>{Math.round(pct * 100)}% · {w.count} {w.count === 1 ? 'entry' : 'entries'}</Txt>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {(data?.tags || []).length ? (
        <>
          <SectionHeader title="Tags" />
          <Card>
            {data.tags.map((t) => (
              <Pressable key={t.tag} onPress={() => router.navigate(`/activity?q=${encodeURIComponent(t.tag)}`)} style={{ paddingVertical: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt w={700} size={14.5} color="brand">{t.tag}</Txt>
                  <Txt w={800} size={14.5}>{t.spent ? peso(t.spent) : `+${peso(t.earned)}`}</Txt>
                </Row>
                <Txt size={12} color="sub">{t.count} {t.count === 1 ? 'entry' : 'entries'}</Txt>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Day by day" />
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Txt w={600} size={12} color="sub">Daily average</Txt>
            <Txt w={800} size={18}>{peso(avg)}</Txt>
          </View>
          {values[biggestIdx] > 0 ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Txt w={600} size={12} color="sub">Biggest day</Txt>
              <Txt w={800} size={18}>{peso(values[biggestIdx])}</Txt>
            </View>
          ) : null}
        </Row>
        <BarChart
          values={values}
          width={chartWidth}
          highlightIndex={todayIdx >= 0 ? todayIdx : biggestIdx}
          labels={[
            { index: 0, text: '1' },
            { index: 9, text: '10' },
            { index: 19, text: '20' },
            { index: days - 1, text: String(days) },
          ]}
        />
      </Card>
    </Screen>
  );
}

function Mini({ label, value, tint, ink }) {
  const theme = useTheme();
  return (
    <Card tint={tint} style={{ flex: 1 }} padding={12}>
      <Txt w={700} size={12} color={theme[ink]}>{label}</Txt>
      <Txt w={800} size={15} color={theme[ink]} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>{value}</Txt>
    </Card>
  );
}

function readTips(settings, month) {
  try {
    const all = JSON.parse(settings.ai_tips || '{}');
    return Array.isArray(all[month]) ? all[month] : null;
  } catch {
    return null;
  }
}

function AiTips({ month, hasData }) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const settings = useSettings();
  const { refreshSettings, toast } = useData();
  const [loading, setLoading] = useState(false);
  const [tips, setTips] = useState(() => readTips(settings, month));

  useEffect(() => {
    setTips(readTips(settings, month));
  }, [month, settings.ai_tips]);

  if (!aiReady(settings) || !hasData) return null;

  const run = async () => {
    setLoading(true);
    try {
      const snap = await buildSnapshot(db, settings, month);
      const list = await aiTips(snap, monthLabel(month));
      if (!list.length) throw new Error('empty');
      let all = {};
      try {
        all = JSON.parse(settings.ai_tips || '{}');
      } catch {
      }
      const keep = Object.keys(all).sort().slice(-5);
      const next = Object.fromEntries(keep.map((k) => [k, all[k]]));
      next[month] = list;
      await setSetting(db, 'ai_tips', JSON.stringify(next));
      setTips(list);
      refreshSettings();
    } catch (e) {
      toast(friendlyAiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card tint="lilac" style={{ marginTop: 12 }} padding={16}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt w={800} size={15} color={theme.lilacInk}>💡 Sinop tips</Txt>
        {loading ? (
          <ActivityIndicator color={theme.lilacInk} />
        ) : (
          <Pressable onPress={run} hitSlop={10}>
            <Txt w={800} size={13.5} color={theme.lilacInk}>{tips ? 'Refresh ✨' : 'Get tips ✨'}</Txt>
          </Pressable>
        )}
      </Row>
      {tips ? (
        tips.map((t, i) => (
          <Txt key={i} w={600} size={13.5} color={theme.lilacInk} style={{ marginTop: 8, lineHeight: 19 }}>{t}</Txt>
        ))
      ) : (
        <Txt size={13} color={theme.lilacInk} style={{ marginTop: 6 }}>
          Let Sinop AI look at your {monthName(month)} and give you 3 real tips. No judgment, promise 🤞
        </Txt>
      )}
    </Card>
  );
}
