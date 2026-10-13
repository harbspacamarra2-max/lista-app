import { Platform } from 'react-native';
import 'expo-router/entry';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/task');
  registerWidgetTaskHandler(widgetTaskHandler);
}
