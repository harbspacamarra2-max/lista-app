import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { Txt } from './ui';

export function Toast({ message, stamp }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!message) return undefined;
    y.setValue(-120);
    Animated.spring(y, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(y, { toValue: -140, duration: 260, useNativeDriver: true }).start();
    }, 2600);
    return () => clearTimeout(id);
  }, [stamp]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, alignItems: 'center', zIndex: 200, elevation: 200 }}>
      <Animated.View
        style={{
          transform: [{ translateY: y }],
          backgroundColor: theme.text,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          maxWidth: 360,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Txt w={700} size={14.5} color={theme.bg} center>{message}</Txt>
      </Animated.View>
    </View>
  );
}
