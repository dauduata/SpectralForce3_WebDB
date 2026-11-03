import { APP_ACCESS_CONFIG } from '../../config/app-access.config.js';
import { getFirebaseApp, loadFirebaseAuthApi } from './firebase-app.service.js';

let authPromise;
let observerPromise;
const authSubscribers = new Set();
let currentUser = null;

async function getFirebaseAuth() {
  if (!authPromise) {
    authPromise = Promise.all([getFirebaseApp(), loadFirebaseAuthApi()]).then(async ([app, authApi]) => {
      const auth = authApi.getAuth(app);
      await authApi.setPersistence(auth, authApi.browserLocalPersistence);
      return { auth, authApi };
    }).catch((error) => { authPromise = undefined; throw error; });
  }
  return authPromise;
}

export function isAuthorizedUser(user) {
  const email = user?.email?.trim().toLowerCase();
  const allowedEmails = APP_ACCESS_CONFIG.allowedEmails.map((allowedEmail) => allowedEmail.trim().toLowerCase());
  return APP_ACCESS_CONFIG.method === 'google' && Boolean(user?.emailVerified && email && allowedEmails.includes(email));
}

function publishAuthState(user) {
  currentUser = user;
  const status = { user, authorized: isAuthorizedUser(user) };
  authSubscribers.forEach((subscriber) => subscriber(status));
}

export async function observeAuthState(callback) {
  authSubscribers.add(callback);
  try {
    if (!observerPromise) {
      observerPromise = (async () => {
        const { auth, authApi } = await getFirebaseAuth();
        await auth.authStateReady();
        publishAuthState(auth.currentUser);
        authApi.onAuthStateChanged(auth, publishAuthState, (error) => {
          authSubscribers.forEach((subscriber) => subscriber({ user: null, authorized: false, error }));
        });
      })().catch((error) => { observerPromise = undefined; throw error; });
    }
    await observerPromise;
    callback({ user: currentUser, authorized: isAuthorizedUser(currentUser) });
  } catch (error) {
    authSubscribers.delete(callback);
    throw error;
  }
  return () => authSubscribers.delete(callback);
}

export async function getCurrentAuthStatus() {
  const { auth } = await getFirebaseAuth();
  await auth.authStateReady();
  currentUser = auth.currentUser;
  return { user: currentUser, authorized: isAuthorizedUser(currentUser) };
}

export async function signInWithGoogle() {
  const { auth, authApi } = await getFirebaseAuth();
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await authApi.signInWithPopup(auth, provider);
  if (!isAuthorizedUser(credential.user)) {
    await authApi.signOut(auth);
    throw new Error('This Google account is not permitted. Use the verified email listed in app-access.config.js and Realtime Database Rules.');
  }
  return credential.user;
}

export async function signOutFromFirebase() {
  const { auth, authApi } = await getFirebaseAuth();
  await authApi.signOut(auth);
}
