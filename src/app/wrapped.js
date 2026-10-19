import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Share, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { getWrapped } from '../lib/db';
import { latestWrapped, monthKey, monthLabel, monthName, peso, shiftMonth, wrappedDropLabel, wrappedOpen } from '../lib/format';
import { useSettings } from '../lib/store';
import { fonts } from '../lib/theme';
import { buildSlides, hasWrapped, shareText, summaryLines } from '../lib/wrapped';
import { tap } from '../components/ui';
import { goBack } from '../lib/nav';

const DURATION = 7000;
const native = Platform.OS !== 'web';

export default function Wrapped() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const month = /^\d{4}-\d{2}$/.test(String(params.month || '')) ? String(params.month) : latestWrapped();
  const locked = !wrappedOpen(month);
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const shotRef = useRef(null);

  useEffect(() => {
    if (locked) {
      setData({ month, empty: true });
      return;
    }
    getWrapped(db, month).then(setData).catch(() => setData({ month, empty: true }));
  }, [db, month]);

  const slides = useMemo(() => (data && hasWrapped(data) ? buildSlides(data, settings.name) : []), [data, settings.name]);
  const slide = slides[index];

  useEffect(() => {
    if (!slide || slide.summary) return undefined;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) setIndex((i) => Math.min(i + 1, slides.length - 1));
    });
    return () => anim.stop();
  }, [index, slides.length]);

  const go = (dir) => {
    tap();
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };

  const close = () => (goBack());

  const share = async () => {
    tap('medium');
    if (native && shotRef.current) {
      try {
        const { captureRef } = require('react-native-view-shot');
        const Sharing = require('expo-sharing');
        const uri = await captureRef(shotRef.current, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Sinop Wrapped' });
          return;
        }
      } catch {
      }
    }
    const text = shareText(data);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text });
      else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Copied! Screenshot your card too para kumpleto ang flex 📸');
      } else await Share.share({ message: text });
    } catch {
    }
  };

  if (!data) return <View style={{ flex: 1, backgroundColor: '#141414' }} />;

  if (!slides.length) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Backdrop id="empty" palette={['#434343', '#000000']} width={width} height={height} />
        <View style={{ flex: 1, justifyContent: 'center', padding: 28, paddingTop: insets.top + 20 }}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>{locked ? '🔒' : '📭'}</Text>
          <Text style={[styles.title(width), { textAlign: 'center', marginTop: 16 }]}>{locked ? `Surprise pa ang ${monthName(month)} Wrapped mo!` : `Wala pang laman ang ${monthName(month)} mo.`}</Text>
          <Text style={[styles.body, { textAlign: 'center', marginTop: 12 }]}>{locked ? `Drops on ${wrappedDropLabel(month)}. Bawal sumilip. 👀🎁` : 'Log your gastos this month, tapos balikan mo ang Wrapped mo sa last day ng month. 🎁'}</Text>
          <Pressable onPress={close} style={styles.cta}><Text style={styles.ctaText}>Okay 👍</Text></Pressable>
        </View>
      </View>
    );
  }

  const ink = slide.dark ? '#14110F' : '#FFFFFF';

  return (
    <View style={{ flex: 1, backgroundColor: slide.palette[0] }}>
      <StatusBar style={slide.dark ? 'dark' : 'light'} />
      <Backdrop id={slide.key} palette={slide.palette} width={width} height={height} />
      {slide.stickers ? <Stickers key={`st-${slide.key}`} items={slide.stickers} width={width} height={height} /> : null}

      <View style={{ position: 'absolute', top: insets.top + 10, left: 14, right: 14, zIndex: 5 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {slides.map((s, i) => (
            <View key={s.key} style={{ flex: 1, height: 3.5, borderRadius: 2, backgroundColor: slide.dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: '100%',
                  backgroundColor: ink,
                  width: i < index ? '100%' : i === index ? (s.summary ? '100%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })) : '0%',
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ fontFamily: fonts[800], fontSize: 13, color: ink, letterSpacing: 1.2, opacity: 0.9 }}>SINOP · {monthLabel(month).toUpperCase()}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={ink} />
          </Pressable>
        </View>
      </View>

      {slide.summary ? (
        <Summary data={data} insets={insets} width={width} shotRef={shotRef} onShare={share} onReplay={() => setIndex(0)} onClose={close} />
      ) : (
        <>
          <SlideBody key={slide.key} slide={slide} ink={ink} width={width} top={insets.top} />
          <View style={{ position: 'absolute', top: insets.top + 60, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
            <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityLabel="Previous" />
            <Pressable style={{ flex: 2 }} onPress={() => go(1)} accessibilityLabel="Next" />
          </View>
        </>
      )}
    </View>
  );
}

function Backdrop({ id, palette, width, height }) {
  const stops = palette.map((c, i) => <Stop key={c + i} offset={palette.length === 1 ? 0 : i / (palette.length - 1)} stopColor={c} />);
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={height}>
      <Defs>
        <LinearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">{stops}</LinearGradient>
        <RadialGradient id={`gl1-${id}`} cx="85%" cy="8%" rx="70%" ry="45%" fx="85%" fy="8%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`gl2-${id}`} cx="0%" cy="95%" rx="80%" ry="45%" fx="0%" fy="95%">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#bg-${id})`} />
      <Rect width={width} height={height} fill={`url(#gl1-${id})`} />
      <Rect width={width} height={height} fill={`url(#gl2-${id})`} />
      <Circle cx={width * 0.92} cy={height * 0.72} r={width * 0.42} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={26} />
      <Circle cx={width * 0.08} cy={height * 0.22} r={width * 0.2} fill="#FFFFFF" fillOpacity={0.08} />
      <Circle cx={width * 0.5} cy={height * 1.02} r={width * 0.6} fill="#FFFFFF" fillOpacity={0.06} />
    </Svg>
  );
}

function Stickers({ items, width, height }) {
  const spots = [
    { left: width - 82, top: height * 0.13, size: 54, rot: '14deg' },
    { left: 18, top: height - 96, size: 44, rot: '-12deg' },
    { left: width - 70, top: height - 120, size: 38, rot: '8deg' },
  ];
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: native }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return items.slice(0, 3).map((e, i) => {
    const s = spots[i];
    const dy = bob.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [6, -6] : [-6, 6] });
    return (
      <Animated.Text
        key={e + i}
        style={{ position: 'absolute', left: s.left, top: s.top, fontSize: s.size, opacity: 0.9, transform: [{ translateY: dy }, { rotate: s.rot }, { scale: pop }] }}
      >
        {e}
      </Animated.Text>
    );
  });
}

function Rise({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: native }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function CountUp({ value, money, style }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setShown(x >= value ? value : money ? Math.round(x / 100) * 100 : Math.round(x)));
    Animated.timing(v, { toValue: value, duration: 1300, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style}>{money ? peso(shown) : shown}</Text>;
}

function bigSize(width, text) {
  const len = String(text).length;
  return Math.max(34, Math.min(76, (width - 56) / Math.max(5, len * 0.62)));
}

const styles = {
  kicker: (ink) => ({ fontFamily: fonts[800], fontSize: 13.5, letterSpacing: 2, color: ink, opacity: 0.85 }),
  title: (width, ink = '#FFFFFF') => ({ fontFamily: fonts.serif, fontSize: Math.min(54, width * 0.13), lineHeight: Math.min(58, width * 0.14), color: ink, letterSpacing: -0.5 }),
  body: { fontFamily: fonts[600], fontSize: 17, lineHeight: 24, color: '#FFFFFF' },
  cta: { marginTop: 28, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 26, height: 50, justifyContent: 'center' },
  ctaText: { fontFamily: fonts[800], fontSize: 16, color: '#141414' },
};

function SlideBody({ slide, ink, width, top }) {
  const jokeBg = slide.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)';
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: top + 70, paddingBottom: 60 }} pointerEvents="none">
      <Rise><Text style={styles.kicker(ink)}>{slide.kicker}</Text></Rise>

      {slide.bigEmoji ? (
        <Rise delay={120}><Text style={{ fontSize: 84, marginTop: 14 }}>{slide.bigEmoji}</Text></Rise>
      ) : null}

      {slide.title ? (
        <Rise delay={180} style={{ marginTop: 12 }}>
          <Text style={styles.title(width, ink)}>{slide.title}</Text>
          {slide.titleItalic ? <Text style={[styles.title(width, ink), { fontFamily: fonts.serifItalic }]}>{slide.titleItalic}</Text> : null}
        </Rise>
      ) : null}

      {slide.quote ? (
        <Rise delay={180} style={{ marginTop: 12 }}>
          <Text style={[styles.title(width, ink), { fontFamily: fonts.serifItalic }]} numberOfLines={3}>“{slide.quote}”</Text>
        </Rise>
      ) : null}

      {slide.amount != null ? (
        <Rise delay={150} style={{ marginTop: 10 }}>
          <CountUp value={slide.amount} money style={{ fontFamily: fonts[800], fontSize: bigSize(width, peso(slide.amount)), color: ink, letterSpacing: -2 }} />
        </Rise>
      ) : null}

      {slide.count != null ? (
        <Rise delay={150} style={{ marginTop: 6 }}>
          <CountUp value={slide.count} style={{ fontFamily: fonts[800], fontSize: 120, lineHeight: 130, color: ink, letterSpacing: -4 }} />
        </Rise>
      ) : null}

      {slide.amountSmall != null ? (
        <Rise delay={260} style={{ marginTop: 10 }}>
          <Text style={{ fontFamily: fonts[800], fontSize: 40, color: ink, letterSpacing: -1 }}>{peso(slide.amountSmall)}</Text>
        </Rise>
      ) : null}

      {slide.rows ? (
        <Rise delay={200} style={{ marginTop: 18, gap: 10 }}>
          {slide.rows.map(([label, v]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: slide.dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)', paddingBottom: 8 }}>
              <Text style={{ fontFamily: fonts[700], fontSize: 17, color: ink }}>{label}</Text>
              <Text style={{ fontFamily: fonts[800], fontSize: 26, color: ink }}>{peso(v)}</Text>
            </View>
          ))}
        </Rise>
      ) : null}

      {slide.rows2 ? (
        <View style={{ marginTop: 16, gap: 6 }}>
          {slide.rows2.map(([e, num, label], i) => (
            <Rise key={label} delay={200 + i * 180}>
              <Text style={{ fontFamily: fonts[800], fontSize: 30, color: ink, letterSpacing: -0.8 }}>
                {e} {num} <Text style={{ fontFamily: fonts[600], fontSize: 18 }}>{label}</Text>
              </Text>
            </Rise>
          ))}
        </View>
      ) : null}

      {slide.bars && slide.bars.length > 1 ? (
        <Rise delay={320} style={{ marginTop: 20, gap: 8 }}>
          {slide.bars.map((b, i) => (
            <View key={b.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts[700], fontSize: 14, color: ink }}>{i + 1}. {b.emoji} {b.name}</Text>
                <Text style={{ fontFamily: fonts[800], fontSize: 14, color: ink }}>{peso(b.total)}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 4, overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: ink, width: `${Math.max(6, (b.total / slide.bars[0].total) * 100)}%` }} />
              </View>
            </View>
          ))}
        </Rise>
      ) : null}

      {slide.body ? (
        <Rise delay={380} style={{ marginTop: 16 }}>
          <Text style={[styles.body, { color: ink }]}>{slide.body}</Text>
        </Rise>
      ) : null}

      {slide.joke ? (
        <Rise delay={700} style={{ marginTop: 18, alignSelf: 'flex-start', maxWidth: '100%' }}>
          <View style={{ backgroundColor: jokeBg, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, transform: [{ rotate: '-1.5deg' }] }}>
            <Text style={{ fontFamily: fonts[700], fontSize: 16, lineHeight: 22, color: ink }}>{slide.joke}</Text>
          </View>
        </Rise>
      ) : null}

      {slide.hint ? (
        <Rise delay={1100} style={{ marginTop: 36 }}>
          <Text style={{ fontFamily: fonts[700], fontSize: 14, color: ink, opacity: 0.75 }}>{slide.hint}</Text>
        </Rise>
      ) : null}
    </View>
  );
}

function Summary({ data, insets, width, shotRef, onShare, onReplay, onClose }) {
  const s = summaryLines(data);
  const cardW = Math.min(width - 40, 380);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 60, paddingBottom: insets.bottom + 16 }}>
      <Rise>
        <View ref={shotRef} collapsable={false} style={{ width: cardW, borderRadius: 28, overflow: 'hidden', backgroundColor: '#784BA0' }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={cardW} height={cardW * 1.45}>
            <Defs>
              <LinearGradient id="sum" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FF3CAC" />
                <Stop offset="0.5" stopColor="#784BA0" />
                <Stop offset="1" stopColor="#2B86C5" />
              </LinearGradient>
            </Defs>
            <Rect width={cardW} height={cardW * 1.45} fill="url(#sum)" />
            <Circle cx={cardW * 0.95} cy={cardW * 0.1} r={cardW * 0.35} fill="#FFFFFF" fillOpacity={0.12} />
            <Circle cx={cardW * 0.05} cy={cardW * 1.35} r={cardW * 0.4} fill="none" stroke="#FFFFFF" strokeOpacity={0.15} strokeWidth={18} />
          </Svg>
          <View style={{ padding: 22 }}>
            <Text style={{ fontFamily: fonts[800], fontSize: 12, letterSpacing: 2, color: '#FFFFFF', opacity: 0.85 }}>SINOP WRAPPED · {monthLabel(data.month).toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <Text style={{ fontSize: 46 }}>{s.persona.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts[700], fontSize: 12, color: '#FFFFFF', opacity: 0.8 }}>I’m a…</Text>
                <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 32, color: '#FFFFFF' }}>{s.persona.title}</Text>
              </View>
            </View>
            <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
              {s.rows.map(([k, v]) => (
                <View key={k} style={{ width: '50%', paddingRight: 10 }}>
                  <Text style={{ fontFamily: fonts[700], fontSize: 11.5, color: '#FFFFFF', opacity: 0.75, letterSpacing: 0.4 }}>{k.toUpperCase()}</Text>
                  <Text style={{ fontFamily: fonts[800], fontSize: 17, color: '#FFFFFF', marginTop: 2 }} numberOfLines={2}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.serifItalic, fontSize: 22, color: '#FFFFFF' }}>sinop</Text>
              <Text style={{ fontFamily: fonts[700], fontSize: 12, color: '#FFFFFF', opacity: 0.85 }}>track mo, sinop mo 💚</Text>
            </View>
          </View>
        </View>
      </Rise>
      <Rise delay={300} style={{ width: cardW, marginTop: 20, gap: 10 }}>
        <Pressable onPress={onShare} style={[styles.cta, { marginTop: 0, alignSelf: 'stretch', alignItems: 'center' }]}>
          <Text style={styles.ctaText}>Share my Wrapped 📤</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onReplay} style={{ flex: 1, height: 46, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts[700], fontSize: 14.5, color: '#FFFFFF' }}>↺ Replay</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ flex: 1, height: 46, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts[700], fontSize: 14.5, color: '#FFFFFF' }}>Done</Text>
          </Pressable>
        </View>
      </Rise>
    </View>
  );
}
