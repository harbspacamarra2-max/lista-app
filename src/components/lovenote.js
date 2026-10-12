import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { Txt } from './ui';

const HEARTS = ['💖', '💗', '💕', '❤️', '💞', '💓', '🌸', '💘', '💝', '✨', '💖', '💗', '💕', '🌷', '💞', '❤️'];

export function LoveNote({ visible, onClose }) {
  const theme = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');
  const seeds = useRef(
    HEARTS.map((e, i) => ({
      e,
      x: (i / HEARTS.length) * width + (Math.random() * 24 - 12),
      drift: Math.random() * 60 - 30,
      rise: height * (0.6 + Math.random() * 0.45),
      size: 20 + Math.random() * 18,
      delay: Math.random() * 0.5,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return undefined;
    t.setValue(0);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,10,25,0.45)', padding: 28 }}>
        {seeds.map((s, i) => {
          const p = t.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
          const shifted = Animated.modulo(Animated.add(p, s.delay), 1);
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: s.x,
                bottom: -40,
                opacity: shifted.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: shifted.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) },
                  { translateX: shifted.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, s.drift, 0] }) },
                ],
              }}
            >
              <Text style={{ fontSize: s.size }}>{s.e}</Text>
            </Animated.View>
          );
        })}
        <Animated.View
          style={{
            backgroundColor: theme.mode === 'light' ? '#FFF7FA' : '#2A1520',
            borderRadius: 30,
            paddingVertical: 30,
            paddingHorizontal: 26,
            alignItems: 'center',
            maxWidth: 360,
            borderWidth: 1.5,
            borderColor: theme.mode === 'light' ? '#FFD0E0' : '#5A2A40',
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            opacity: pop,
          }}
        >
          <Text style={{ fontSize: 52 }}>💌</Text>
          <Txt serif="italic" size={34} color={theme.mode === 'light' ? '#C2185B' : '#FF9EC4'} center style={{ marginTop: 8 }}>
            for hanna
          </Txt>
          <Txt w={600} size={17} center style={{ marginTop: 12, lineHeight: 26 }}>
            This app was built solely for my love, Hanna Siena. I love you, love.
          </Txt>
          <Txt size={22} style={{ marginTop: 14 }}>💖</Txt>
          <Txt w={600} size={12} color="faint" style={{ marginTop: 14 }}>tap anywhere to close</Txt>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
