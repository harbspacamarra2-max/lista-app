import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { Txt, tap, styles } from '../../components/ui';

const TABS = {
  index: { label: 'Home', icon: 'home', iconOff: 'home-outline' },
  activity: { label: 'Activity', icon: 'receipt', iconOff: 'receipt-outline' },
  utang: { label: 'Utang', icon: 'people', iconOff: 'people-outline' },
  reports: { label: 'Reports', icon: 'pie-chart', iconOff: 'pie-chart-outline' },
};

function TabBar({ state, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes;

  const renderTab = (route) => {
    const index = routes.indexOf(route);
    const focused = state.index === index;
    const meta = TABS[route.name];
    if (!meta) return null;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          tap();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
      >
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: 14,
            backgroundColor: focused ? theme.brandTint : 'transparent',
          }}
        >
          <Ionicons
            name={focused ? meta.icon : meta.iconOff}
            size={22}
            color={focused ? (theme.mode === 'light' ? theme.brandDeep : theme.brand) : theme.faint}
          />
        </View>
        <Txt w={focused ? 800 : 600} size={11} color={focused ? 'text' : 'faint'} style={{ marginTop: 3 }}>
          {meta.label}
        </Txt>
      </Pressable>
    );
  };

  const left = routes.filter((r) => r.name === 'index' || r.name === 'activity');
  const right = routes.filter((r) => r.name === 'utang' || r.name === 'reports');

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: 14 }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.tabBar,
            borderRadius: 28,
            height: 70,
            paddingHorizontal: 6,
            borderWidth: theme.mode === 'dark' ? 1 : 0,
            borderColor: theme.border,
          },
          styles.softShadow,
          { shadowOpacity: 0.12, elevation: 12 },
        ]}
      >
        {left.map(renderTab)}
        <View style={{ width: 74, alignItems: 'center' }}>
          <Pressable
            accessibilityLabel="Add"
            onPress={() => {
              tap('medium');
              router.push('/add');
            }}
            style={({ pressed }) => [
              {
                width: 60,
                height: 60,
                borderRadius: 22,
                backgroundColor: theme.brand,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -30,
                borderWidth: 5,
                borderColor: theme.bg,
                transform: [{ rotate: '0deg' }],
              },
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Ionicons name="add" size={32} color={theme.onBrand} />
          </Pressable>
        </View>
        {right.map(renderTab)}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="utang" />
      <Tabs.Screen name="reports" />
    </Tabs>
  );
}
