import { createContext, useContext } from 'react';

const base = {
  light: {
    mode: 'light',
    bg: '#FAF7F2',
    card: '#FFFFFF',
    cardAlt: '#F2EEE7',
    text: '#17151C',
    sub: '#6B6772',
    faint: '#A8A3AD',
    border: '#ECE7DF',
    red: '#E5484D',
    redTint: '#FFE4E1',
    amber: '#B87300',
    amberTint: '#FFF0C9',
    yellow: '#FFD166',
    lilac: '#EEE8FF',
    lilacInk: '#5B45C9',
    peach: '#FFE6D8',
    peachInk: '#B5521B',
    sky: '#E1EDFF',
    skyInk: '#2D63B8',
    mint: '#DFF3E8',
    mintInk: '#1E7A50',
    butter: '#FFF3CC',
    butterInk: '#8A6200',
    tabBar: 'rgba(255,255,255,0.96)',
    overlay: 'rgba(23,21,28,0.42)',
    auraOpacity: 0.75,
  },
  dark: {
    mode: 'dark',
    bg: '#0F0E13',
    card: '#1A1820',
    cardAlt: '#24212C',
    text: '#F4F1F7',
    sub: '#A9A3B3',
    faint: '#6F6A78',
    border: '#2A2732',
    red: '#FF6B6B',
    redTint: '#3A1D22',
    amber: '#FFC24D',
    amberTint: '#3A2E12',
    yellow: '#FFD166',
    lilac: '#2A2445',
    lilacInk: '#C9BCFF',
    peach: '#3D2618',
    peachInk: '#FFB48A',
    sky: '#182A44',
    skyInk: '#9CC3FF',
    mint: '#16352A',
    mintInk: '#86E3B8',
    butter: '#3A3112',
    butterInk: '#FFD978',
    tabBar: 'rgba(26,24,32,0.97)',
    overlay: 'rgba(0,0,0,0.6)',
    auraOpacity: 0.32,
  },
};

export const accents = {
  matcha: {
    label: 'Matcha',
    emoji: '🍵',
    light: { brand: '#3E9B6B', brandDeep: '#23664A', brandTint: '#E2F2E8', onBrand: '#FFFFFF', aura: ['#BFE6CF', '#F7E6C4', '#E3DAFF'] },
    dark: { brand: '#6FD3A0', brandDeep: '#2F8F63', brandTint: '#1B3A2C', onBrand: '#0C1A13', aura: ['#2F7A55', '#6B5A2E', '#4A3F7A'] },
  },
  ube: {
    label: 'Ube',
    emoji: '💜',
    light: { brand: '#7B5CF0', brandDeep: '#4F35BF', brandTint: '#EDE7FF', onBrand: '#FFFFFF', aura: ['#D8CCFF', '#FFD6EA', '#CFE5FF'] },
    dark: { brand: '#A992FF', brandDeep: '#6A4FE0', brandTint: '#2B2450', onBrand: '#140F2A', aura: ['#5A44B8', '#8A3F6A', '#2F5A8A'] },
  },
  strawberry: {
    label: 'Strawberry',
    emoji: '🍓',
    light: { brand: '#E2557F', brandDeep: '#AE2F57', brandTint: '#FFE4EC', onBrand: '#FFFFFF', aura: ['#FFC8DA', '#FFE8C7', '#E8DAFF'] },
    dark: { brand: '#FF8FB1', brandDeep: '#C9466F', brandTint: '#3E1C2A', onBrand: '#2A0E18', aura: ['#9A3A5C', '#8A6A3A', '#5A4A9A'] },
  },
  sky: {
    label: 'Sky',
    emoji: '☁️',
    light: { brand: '#3D7BE0', brandDeep: '#2552A8', brandTint: '#E0EBFF', onBrand: '#FFFFFF', aura: ['#C9DEFF', '#D4F3EA', '#EADCFF'] },
    dark: { brand: '#8AB6FF', brandDeep: '#3D6FD0', brandTint: '#1A2C4A', onBrand: '#0B1528', aura: ['#2F5AA8', '#2F7A6A', '#5A4A9A'] },
  },
};
export const accentNames = Object.keys(accents);

export function buildTheme(mode, accentName) {
  const a = (accents[accentName] || accents.matcha)[mode];
  return { ...base[mode], ...a, accent: accentName in accents ? accentName : 'matcha' };
}

export const swatches = {
  mint: { light: ['#DFF3E8', '#1E7A50'], dark: ['#16352A', '#86E3B8'] },
  lilac: { light: ['#EEE8FF', '#5B45C9'], dark: ['#2A2445', '#C9BCFF'] },
  peach: { light: ['#FFE6D8', '#B5521B'], dark: ['#3D2618', '#FFB48A'] },
  sky: { light: ['#E1EDFF', '#2D63B8'], dark: ['#182A44', '#9CC3FF'] },
  butter: { light: ['#FFF3CC', '#8A6200'], dark: ['#3A3112', '#FFD978'] },
  rose: { light: ['#FFE3EE', '#B42A63'], dark: ['#3D1A28', '#FF9EC4'] },
  teal: { light: ['#DAF4F3', '#14787A'], dark: ['#123537', '#7EDCDD'] },
  stone: { light: ['#EEEBE5', '#5C5961'], dark: ['#26242B', '#C9C4CF'] },
};
export const swatchNames = Object.keys(swatches);

export function swatch(theme, name) {
  const s = swatches[name] || swatches.stone;
  const [tint, ink] = s[theme.mode];
  return { tint, ink };
}

export const fonts = {
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
};

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export const palettes = { light: buildTheme('light', 'matcha'), dark: buildTheme('dark', 'matcha') };

export const ThemeContext = createContext({
  theme: palettes.light,
  pref: 'system',
  setPref: () => {},
  accent: 'matcha',
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemePref() {
  return useContext(ThemeContext);
}
