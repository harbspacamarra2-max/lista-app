import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { Field, Txt, tap } from './ui';

export function firstEmoji(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return '';
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const first = seg.segment(t)[Symbol.iterator]().next().value;
      if (first) return first.segment;
    }
  } catch {
  }
  return Array.from(t).slice(0, 2).join('');
}

export function EmojiChooser({ value, onChange, choices = [], style }) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');
  const custom = value && !choices.includes(value);
  const box = (on) => ({
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: on ? theme.brandTint : theme.card,
    borderWidth: 1.5,
    borderColor: on ? theme.brand : theme.border,
  });
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {custom ? (
          <View style={box(true)}>
            <Txt size={20}>{value}</Txt>
          </View>
        ) : null}
        {choices.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              tap();
              onChange(e);
            }}
            style={box(value === e)}
          >
            <Txt size={20}>{e}</Txt>
          </Pressable>
        ))}
      </View>
      <Field
        placeholder="Or type / paste any emoji 😊"
        value={typed}
        onChangeText={(t) => {
          const e = firstEmoji(t);
          setTyped(e);
          if (e) onChange(e);
        }}
        style={{ marginTop: 10 }}
        maxLength={16}
        autoCorrect={false}
      />
    </View>
  );
}
