import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { daysBetween, peso, shortDate, today } from '../lib/format';
import { swatch, useTheme } from '../lib/theme';
import { Card, Txt } from './ui';

export function Ring({ pct, size = 64, stroke = 8, color, track, children }) {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? theme.cardAlt} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? theme.brand}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * p} ${c}`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

export function goalHint(g) {
  const left = Math.max(0, g.target - g.saved);
  if (left === 0) return 'Goal reached! 🎉';
  if (!g.deadline) return `${peso(left)} to go`;
  const days = daysBetween(today(), g.deadline);
  if (days < 0) return `${peso(left)} to go · past ${shortDate(g.deadline)}`;
  const weeks = Math.max(1, Math.ceil(days / 7));
  return `Save ${peso(Math.ceil(left / weeks / 100) * 100)}/week to hit it`;
}

export function GoalMini({ g }) {
  const theme = useTheme();
  const sw = swatch(theme, g.color);
  const pct = g.target ? g.saved / g.target : 0;
  return (
    <Card onPress={() => router.push(`/goal/${g.id}`)} padding={14} style={{ width: 168 }}>
      <Ring pct={pct} size={56} stroke={7} color={sw.ink} track={sw.tint}>
        <Txt size={22}>{g.emoji}</Txt>
      </Ring>
      <Txt w={800} size={14.5} numberOfLines={1} style={{ marginTop: 10 }}>{g.name}</Txt>
      <Txt w={700} size={13} color={sw.ink} style={{ marginTop: 2 }}>
        {Math.min(100, Math.round(pct * 100))}% · {peso(g.saved)}
      </Txt>
      <Txt size={11.5} color="sub" numberOfLines={1} style={{ marginTop: 2 }}>of {peso(g.target)}</Txt>
    </Card>
  );
}
