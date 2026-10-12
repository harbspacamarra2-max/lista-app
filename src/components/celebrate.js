import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { Txt } from './ui';

const BITS = ['🎉', '✨', '💸', '💚', '🥳', '⭐', '🎊', '💫', '🤝', '✨', '🎉', '💖', '🌟', '🎊'];

export function Celebrate({ visible, title, subtitle, onDone, icon = '🤝' }) {
  const theme = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');
  const seeds = useRef(
    BITS.map((e, i) => ({
      e,
      x: (i / BITS.length) * width + (Math.random() * 30 - 15),
      drift: Math.random() * 80 - 40,
      rise: height * (0.45 + Math.random() * 0.35),
      spin: Math.random() * 360 - 180,
      size: 22 + Math.random() * 14,
      delay: Math.random() * 0.25,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    t.setValue(0);
    pop.setValue(0);
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
    const id = setTimeout(() => onDone?.(), 1900);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
        {seeds.map((s, i) => {
          const p = t.interpolate({ inputRange: [0, s.delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: s.x,
                bottom: -40,
                opacity: p.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) },
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, s.drift] }) },
                  { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.spin}deg`] }) },
                ],
              }}
            >
              <Text style={{ fontSize: s.size }}>{s.e}</Text>
            </Animated.View>
          );
        })}
        <Animated.View
          style={{
            backgroundColor: theme.card,
            borderRadius: 28,
            paddingVertical: 24,
            paddingHorizontal: 30,
            alignItems: 'center',
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            opacity: pop,
          }}
        >
          <Text style={{ fontSize: 46 }}>{icon}</Text>
          <Txt serif="italic" size={34} color="brand" style={{ marginTop: 6 }}>{title}</Txt>
          {subtitle ? <Txt w={600} size={14} color="sub" center style={{ marginTop: 4 }}>{subtitle}</Txt> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
