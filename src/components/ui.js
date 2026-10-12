import { forwardRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts, radius, swatch, useTheme } from '../lib/theme';

export function tap(style = 'light') {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
  };
  if (style === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else {
    Haptics.impactAsync(map[style] || map.light).catch(() => {});
  }
}

export function Txt({ w = 500, size = 15, color, style, children, center, serif, ...rest }) {
  const theme = useTheme();
  const c = color ? theme[color] ?? color : theme.text;
  const family = serif ? (serif === 'italic' ? fonts.serifItalic : fonts.serif) : fonts[w] || fonts[500];
  const spacing = serif ? -0.3 : size >= 26 ? -0.8 : size >= 18 ? -0.3 : 0;
  return (
    <Text
      style={[
        { fontFamily: family, fontSize: size, color: c, letterSpacing: spacing },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, padded = true, contentStyle, header, refreshControl }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={[padded && { paddingHorizontal: 20 }, { paddingTop: insets.top + 12, paddingBottom: 140 }, contentStyle]}>
      {header}
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Aura />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

export function Aura({ height = 420 }) {
  const theme = useTheme();
  const [a, b, c] = theme.aura;
  const o = theme.auraOpacity;
  const [w, setW] = useState(0);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(Math.ceil(e.nativeEvent.layout.width))}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    >
      {w > 0 ? (
      <Svg width={w} height={height}>
        <Defs>
          <RadialGradient id="aura1" cx="12%" cy="8%" rx="70%" ry="55%" fx="12%" fy="8%">
            <Stop offset="0" stopColor={a} stopOpacity={o} />
            <Stop offset="1" stopColor={a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="aura2" cx="95%" cy="18%" rx="60%" ry="50%" fx="95%" fy="18%">
            <Stop offset="0" stopColor={b} stopOpacity={o} />
            <Stop offset="1" stopColor={b} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="aura3" cx="55%" cy="70%" rx="65%" ry="40%" fx="55%" fy="70%">
            <Stop offset="0" stopColor={c} stopOpacity={o * 0.8} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={theme.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={height} fill="url(#aura1)" />
        <Rect width={w} height={height} fill="url(#aura2)" />
        <Rect width={w} height={height} fill="url(#aura3)" />
        <Rect width={w} height={height} fill="url(#fade)" />
      </Svg>
      ) : null}
    </View>
  );
}

export function GradientCard({ children, style, padding = 22 }) {
  const theme = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.ceil(width) !== size.w || Math.ceil(height) !== size.h) setSize({ w: Math.ceil(width), h: Math.ceil(height) });
      }}
      style={[{ borderRadius: radius.xl, overflow: 'hidden', padding, backgroundColor: theme.brand }, style]}
    >
      {size.w > 0 ? (
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.w} height={size.h}>
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.brand} />
            <Stop offset="1" stopColor={theme.brandDeep} />
          </LinearGradient>
          <RadialGradient id="gloss1" cx="88%" cy="0%" rx="55%" ry="70%" fx="88%" fy="0%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gloss2" cx="0%" cy="100%" rx="60%" ry="60%" fx="0%" fy="100%">
            <Stop offset="0" stopColor={theme.aura[1]} stopOpacity={0.45} />
            <Stop offset="1" stopColor={theme.aura[1]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size.w} height={size.h} rx={radius.xl} fill="url(#hero)" />
        <Rect width={size.w} height={size.h} rx={radius.xl} fill="url(#gloss1)" />
        <Rect width={size.w} height={size.h} rx={radius.xl} fill="url(#gloss2)" />
      </Svg>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, tint, padding = 18 }) {
  const theme = useTheme();
  const base = [
    {
      backgroundColor: tint ? theme[tint] ?? tint : theme.card,
      borderRadius: radius.lg,
      padding,
      borderWidth: tint ? 0 : 1,
      borderColor: theme.border,
    },
    theme.mode === 'light' && !tint && styles.softShadow,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [base, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = 10, align = 'center' }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction, style }) {
  return (
    <Row style={[{ justifyContent: 'space-between', marginTop: 26, marginBottom: 12 }, style]}>
      <Txt serif="italic" size={26}>{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Txt w={700} size={14} color="brand">{action}</Txt>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Title({ main, italic, sub, style }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text>
        {main ? <Txt serif size={42}>{main} </Txt> : null}
        {italic ? <Txt serif="italic" size={42} color="brand">{italic}</Txt> : null}
      </Text>
      {sub ? <Txt size={14} color="sub" style={{ marginTop: 2 }}>{sub}</Txt> : null}
    </View>
  );
}

export function Button({ title, onPress, icon, variant = 'primary', disabled, style, size = 'lg' }) {
  const theme = useTheme();
  const variants = {
    primary: { bg: theme.brand, fg: theme.onBrand },
    soft: { bg: theme.brandTint, fg: theme.mode === 'light' ? theme.brandDeep : theme.brand },
    ghost: { bg: theme.cardAlt, fg: theme.text },
    danger: { bg: theme.redTint, fg: theme.red },
    dark: { bg: theme.text, fg: theme.bg },
  };
  const v = variants[variant] || variants.primary;
  const h = size === 'lg' ? 56 : size === 'md' ? 46 : 38;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap('medium');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: radius.pill,
          backgroundColor: v.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={v.fg} /> : null}
      <Txt w={700} size={size === 'sm' ? 13 : 16} color={v.fg}>{title}</Txt>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, size = 44, tint, color, style, label }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress?.();
      }}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint ? theme[tint] ?? tint : theme.card,
          alignItems: 'center',
          justifyContent: 'center',
        },
        theme.mode === 'light' && !tint && styles.softShadow,
        pressed && { transform: [{ scale: 0.92 }] },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={color ? theme[color] ?? color : theme.text} />
    </Pressable>
  );
}

export function Chip({ label, emoji, selected, onPress, tintName, style, small }) {
  const theme = useTheme();
  const sw = tintName ? swatch(theme, tintName) : null;
  const bg = selected ? (sw ? sw.tint : theme.brandTint) : theme.card;
  const border = selected ? (sw ? sw.ink : theme.brand) : theme.border;
  const fg = selected ? (sw ? sw.ink : theme.mode === 'light' ? theme.brandDeep : theme.brand) : theme.text;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: small ? 12 : 14,
          height: small ? 34 : 40,
          borderRadius: radius.pill,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
        },
        pressed && { transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      {emoji ? <Text style={{ fontSize: small ? 14 : 16 }}>{emoji}</Text> : null}
      <Txt w={selected ? 700 : 600} size={small ? 13 : 14} color={fg}>{label}</Txt>
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style }) {
  const theme = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: theme.cardAlt, borderRadius: radius.pill, padding: 4 }, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.card : 'transparent',
              flexDirection: 'row',
              gap: 6,
              ...(active && theme.mode === 'light' ? styles.softShadow : null),
            }}
          >
            {o.emoji ? <Text style={{ fontSize: 14 }}>{o.emoji}</Text> : null}
            <Txt w={active ? 700 : 600} size={14} color={active ? 'text' : 'sub'}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ emoji, tintName = 'mint', size = 44, tint }) {
  const theme = useTheme();
  const sw = swatch(theme, tintName);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.36,
        backgroundColor: tint ?? sw.tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ value, color, track, height = 10 }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? theme.cardAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? theme.brand }} />
    </View>
  );
}

export function Badge({ text, tone = 'calm' }) {
  const theme = useTheme();
  const tones = {
    late: [theme.redTint, theme.red],
    warn: [theme.amberTint, theme.amber],
    calm: [theme.cardAlt, theme.sub],
    good: [theme.brandTint, theme.mode === 'light' ? theme.brandDeep : theme.brand],
    lilac: [theme.lilac, theme.lilacInk],
  };
  const [bg, fg] = tones[tone] || tones.calm;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Txt w={700} size={11.5} color={fg}>{text}</Txt>
    </View>
  );
}

export function EmptyState({ emoji, title, body, action, onAction }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 46, marginBottom: 10 }}>{emoji}</Text>
      <Txt w={800} size={17} center>{title}</Txt>
      {body ? <Txt size={14} color="sub" center style={{ marginTop: 6, lineHeight: 20 }}>{body}</Txt> : null}
      {action ? <Button title={action} onPress={onAction} size="md" variant="soft" style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export const Field = forwardRef(function Field({ label, style, inputStyle, right, ...rest }, ref) {
  const theme = useTheme();
  return (
    <View style={style}>
      {label ? <Txt w={700} size={13} color="sub" style={{ marginBottom: 8, marginLeft: 4 }}>{label}</Txt> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.card,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: theme.border,
          paddingHorizontal: 16,
          minHeight: 52,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={theme.faint}
          style={[{ flex: 1, fontFamily: fonts[600], fontSize: 16, color: theme.text, paddingVertical: 12 }, inputStyle]}
          {...rest}
        />
        {right}
      </View>
    </View>
  );
});

export function Divider({ style }) {
  const theme = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.border }, style]} />;
}

export function Sheet({ visible, onClose, title, children }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: theme.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.bg,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 20,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 14 }} />
          {title ? (
            <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <Txt w={800} size={20}>{title}</Txt>
              <IconButton icon="close" size={36} tint="cardAlt" onPress={onClose} label="Close" />
            </Row>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  softShadow: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
