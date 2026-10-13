import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBsGLIoFtXBWhKAn0wpmcvfCcaxB-0aGyw',
  authDomain: 'sinop-fc9d8.firebaseapp.com',
  projectId: 'sinop-fc9d8',
  storageBucket: 'sinop-fc9d8.firebasestorage.app',
  messagingSenderId: '780057166279',
  appId: '1:780057166279:web:e2823fb6a3b5f4fc6199e2',
};

const WEB_CLIENT_ID = '780057166279-c1oa7nl64p84pc50qj34qpnt4d05h9n1.apps.googleusercontent.com';

const isNew = !getApps().length;
export const app = isNew ? initializeApp(firebaseConfig) : getApp();

function makeAuth() {
  if (Platform.OS === 'web' || !isNew) return getAuth(app);
  const { getReactNativePersistence } = require('firebase/auth');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = makeAuth();

export const firestore = (() => {
  if (!isNew) return getFirestore(app);
  if (Platform.OS === 'web') return getFirestore(app);
  return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
})();

let GoogleSignin = null;
let isSuccessResponse = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    isSuccessResponse = mod.isSuccessResponse;
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  } catch {
    GoogleSignin = null;
  }
}

export function watchUser(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const standalone =
      typeof window !== 'undefined' &&
      (window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches);
    if (standalone) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    const res = await signInWithPopup(auth, provider);
    return res.user;
  }
  if (!GoogleSignin) throw new Error('Google sign-in is not available on this device.');
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  const idToken = res.data?.idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  const cred = GoogleAuthProvider.credential(idToken);
  const out = await signInWithCredential(auth, cred);
  return out.user;
}

export async function signOutEverywhere() {
  try {
    if (GoogleSignin) await GoogleSignin.signOut();
  } catch {
  }
  await firebaseSignOut(auth);
}
