import { Alert as RNAlert, Platform } from 'react-native';

function webAlert(title, message, buttons) {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = buttons || [];
  const cancel = list.find((b) => b.style === 'cancel');
  const action = list.find((b) => b.style !== 'cancel');
  if (cancel && action) {
    if (window.confirm(text)) action.onPress?.();
    else cancel.onPress?.();
    return;
  }
  window.alert(text);
  (action || cancel)?.onPress?.();
}

export const Alert = {
  alert: (title, message, buttons, options) =>
    Platform.OS === 'web' ? webAlert(title, message, buttons) : RNAlert.alert(title, message, buttons, options),
};
