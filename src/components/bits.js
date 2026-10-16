import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Rect, Line } from 'react-native-svg';
import { fonts, radius, swatch, useTheme } from '../lib/theme';
import {
  DAYS,
  addDays,
  cleanAmountInput,
  daysInMonth,
  monthKey,
  monthLabel,
  peso,
  prettyDate,
  shiftMonth,
  today,
} from '../lib/format';
import { methodLabel, pickableMethods } from '../lib/db';
import { Avatar, Badge, Chip, IconButton, Row, Sheet, Txt, tap } from './ui';

export function TransactionRow({ tx, onPress, onLongPress, showDate }) {
  const theme = useTheme();
  const income = tx.kind === 'income';
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ paddingVertical: 10, borderRadius: radius.md }, pressed && { opacity: 0.6 }]}
    >
      <Row gap={12}>
        <Avatar emoji={tx.category_emoji || '✨'} tintName={tx.category_color || 'stone'} size={46} />
        <View style={{ flex: 1 }}>
          <Txt w={700} size={15} numberOfLines={1}>{tx.note || tx.category_name || 'Uncategorized'}</Txt>
          <Txt size={12.5} color="sub" numberOfLines={1} style={{ marginTop: 2 }}>
            {[tx.note ? tx.category_name : null, methodLabel(tx.method), showDate ? prettyDate(tx.date) : null, tx.photo ? '📎' : null]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
        <Txt w={800} size={15.5} color={income ? theme.brand : theme.text}>
          {income ? '+' : '−'}{peso(tx.amount)}
        </Txt>
      </Row>
    </Pressable>
  );
}

export function MonthSwitcher({ value, onChange, style }) {
  const current = monthKey();
  const isCurrent = value >= current;
  return (
    <Row style={[{ justifyContent: 'space-between' }, style]}>
      <IconButton icon="chevron-back" size={40} onPress={() => onChange(shiftMonth(value, -1))} label="Previous month" />
      <View style={{ alignItems: 'center' }}>
        <Txt w={800} size={16}>{monthLabel(value)}</Txt>
        {value === current ? <Txt size={12} color="sub">This month</Txt> : null}
      </View>
      <IconButton
        icon="chevron-forward"
        size={40}
        onPress={() => !isCurrent && onChange(shiftMonth(value, 1))}
        color={isCurrent ? 'faint' : undefined}
        label="Next month"
      />
    </Row>
  );
}

export function AmountInput({ value, onChange, color, autoFocus }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Row gap={4} style={{ justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts[800], fontSize: 40, color: color ?? theme.text, opacity: 0.55 }}>₱</Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(cleanAmountInput(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.faint}
          autoFocus={autoFocus}
          style={{
            fontFamily: fonts[800],
            fontSize: 52,
            color: color ?? theme.text,
            minWidth: 60,
            textAlign: 'center',
            letterSpacing: -1.5,
            paddingVertical: 4,
          }}
          maxLength={12}
          selectionColor={theme.brand}
        />
      </Row>
    </View>
  );
}

export function CalendarSheet({ visible, value, onClose, onPick, title = 'Pick a date', allowClear }) {
  const theme = useTheme();
  const [view, setView] = useState(monthKey(value || today()));
  const t = today();
  const cells = useMemo(() => {
    const [y, m] = view.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const n = daysInMonth(view);
    const out = [];
    for (let i = 0; i < first; i += 1) out.push(null);
    for (let d = 1; d <= n; d += 1) out.push(`${view}-${String(d).padStart(2, '0')}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <IconButton icon="chevron-back" size={38} tint="cardAlt" onPress={() => setView(shiftMonth(view, -1))} label="Previous month" />
        <Txt w={800} size={16}>{monthLabel(view)}</Txt>
        <IconButton icon="chevron-forward" size={38} tint="cardAlt" onPress={() => setView(shiftMonth(view, 1))} label="Next month" />
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {DAYS.map((d) => (
          <Txt key={d} w={700} size={12} color="faint" center style={{ flex: 1, marginBottom: 6 }}>{d.slice(0, 2)}</Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((iso, i) => {
          const selected = iso && iso === value;
          const isToday = iso === t;
          return (
            <View key={iso || `e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
              {iso ? (
                <Pressable
                  onPress={() => {
                    tap();
                    onPick(iso);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? theme.brand : isToday ? theme.brandTint : 'transparent',
                  }}
                >
                  <Txt w={selected || isToday ? 800 : 600} size={15} color={selected ? theme.onBrand : 'text'}>
                    {Number(iso.slice(8))}
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      <Row style={{ marginTop: 14, flexWrap: 'wrap' }} gap={8}>
        <QuickDate label="Today" onPress={() => onPick(t)} />
        <QuickDate label="Tomorrow" onPress={() => onPick(addDays(t, 1))} />
        <QuickDate label="In a week" onPress={() => onPick(addDays(t, 7))} />
        {allowClear ? <QuickDate label="No date" onPress={() => onPick(null)} /> : null}
      </Row>
    </Sheet>
  );
}

function QuickDate({ label, onPress }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: theme.cardAlt, justifyContent: 'center' }}
    >
      <Txt w={700} size={13}>{label}</Txt>
    </Pressable>
  );
}

export function DebtStatus({ debt }) {
  if (debt.status === 'paid') return <Badge text="Paid ✓" tone="good" />;
  if (debt.status === 'partial') return <Badge text="Partly paid" tone="lilac" />;
  return <Badge text="Unpaid" tone="calm" />;
}

export function DonutChart({ data, size = 190, thickness = 26, centerTop, centerBottom }) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.cardAlt} strokeWidth={thickness} fill="none" />
          {total > 0 &&
            data.map((d) => {
              const len = (d.value / total) * c;
              const seg = Math.max(0, len - gap);
              const el = (
                <Circle
                  key={d.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  fill="none"
                  strokeDasharray={`${seg} ${c - seg}`}
                  strokeDashoffset={-offset - gap / 2}
                />
              );
              offset += len;
              return el;
            })}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerTop ? <Txt size={12.5} color="sub">{centerTop}</Txt> : null}
        {centerBottom ? <Txt w={800} size={22}>{centerBottom}</Txt> : null}
      </View>
    </View>
  );
}

export function BarChart({ values, width, height = 150, highlightIndex, labels }) {
  const theme = useTheme();
  const max = Math.max(1, ...values);
  const n = values.length;
  const gap = n > 20 ? 3 : 6;
  const barW = Math.max(3, (width - gap * (n - 1)) / n);
  const chartH = height - 22;
  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={0} x2={width} y1={chartH + 0.5} y2={chartH + 0.5} stroke={theme.border} strokeWidth={1} />
        {values.map((v, i) => {
          const h = v > 0 ? Math.max(4, (v / max) * (chartH - 6)) : 0;
          return (
            <Rect
              key={i}
              x={i * (barW + gap)}
              y={chartH - h}
              width={barW}
              height={h}
              rx={Math.min(barW / 2, 6)}
              fill={i === highlightIndex ? theme.brand : theme.mode === 'light' ? '#BFE8D4' : '#2A5A44'}
            />
          );
        })}
      </Svg>
      {labels ? (
        <View style={{ position: 'absolute', top: chartH + 6, left: 0, right: 0, height: 16 }}>
          {labels.map((l) => (
            <Txt
              key={l.index}
              size={11}
              w={600}
              color="faint"
              style={{ position: 'absolute', left: l.index * (barW + gap) + barW / 2 - 12, width: 24, textAlign: 'center' }}
            >
              {l.text}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LegendRow({ emoji, color, name, amount, pct, count }) {
  const theme = useTheme();
  const sw = swatch(theme, color);
  return (
    <Row gap={12} style={{ paddingVertical: 8 }}>
      <Avatar emoji={emoji} tintName={color} size={40} />
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt w={700} size={14.5}>{name}</Txt>
          <Txt w={800} size={14.5}>{peso(amount)}</Txt>
        </Row>
        <Row style={{ marginTop: 6 }} gap={10}>
          <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: theme.cardAlt, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, pct * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: sw.ink }} />
          </View>
          <Txt w={700} size={12} color="sub" style={{ width: 70, textAlign: 'right' }}>
            {Math.round(pct * 100)}% · {count}x
          </Txt>
        </Row>
      </View>
    </Row>
  );
}

export function StatPill({ label, value, tint }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: tint ? theme[tint] : theme.card, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 12 }}>
      <Txt w={600} size={12} color="sub">{label}</Txt>
      <Txt w={800} size={16} style={{ marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
    </View>
  );
}

export function NavRow({ icon, label, value, onPress, danger }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.6 }]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: danger ? theme.redTint : theme.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={danger ? theme.red : theme.text} />
      </View>
      <Txt w={700} size={15} color={danger ? theme.red : 'text'} style={{ flex: 1 }}>{label}</Txt>
      {value ? <Txt w={600} size={14} color="sub">{value}</Txt> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.faint} />
    </Pressable>
  );
}

export function WalletPicker({ value, onChange, noneLabel = 'Not from my wallet', hint }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {pickableMethods().map((m) => (
          <Chip key={m.key} label={m.label} emoji={m.emoji} small selected={value === m.key} onPress={() => onChange(m.key)} />
        ))}
        <Chip label={noneLabel} emoji="🚫" small selected={!value || value === 'none'} onPress={() => onChange('none')} />
      </View>
      {hint ? <Txt size={12} color="faint" style={{ marginTop: 6, marginLeft: 4, lineHeight: 17 }}>{hint}</Txt> : null}
    </View>
  );
}
