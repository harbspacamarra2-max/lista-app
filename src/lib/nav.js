import { router } from 'expo-router';

export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
