import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { Txt, tap } from './ui';

export function Toast({ message, stamp, action }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;
  const used = useRef(false);

  useEffect(() => {
    if (!message) return undefined;
    used.current = false;
    y.setValue(-120);
    Animated.spring(y, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(y, { toValue: -160, duration: 260, useNativeDriver: true }).start();
    }, action ? 5500 : 2600);
    return () => clearTimeout(id);
  }, [stamp]);

  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, alignItems: 'center', zIndex: 200, elevation: 200 }}>
      <Animated.View
        pointerEvents={action ? 'auto' : 'none'}
        style={{
          transform: [{ translateY: y }],
          backgroundColor: theme.text,
          paddingLeft: 18,
          paddingRight: action ? 6 : 18,
          paddingVertical: action ? 6 : 12,
          borderRadius: 999,
          maxWidth: 380,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Txt w={700} size={14.5} color={theme.bg} center={!action} style={action ? { flexShrink: 1 } : null}>{message}</Txt>
        {action ? (
          <Pressable
            onPress={() => {
              if (used.current) return;
              used.current = true;
              tap('medium');
              Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start();
              action.onPress();
            }}
            hitSlop={8}
            style={{ backgroundColor: theme.brand, borderRadius: 999, paddingHorizontal: 16, height: 36, justifyContent: 'center' }}
          >
            <Txt w={800} size={14} color={theme.onBrand}>{action.label}</Txt>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
