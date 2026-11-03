import { FIREBASE_CONFIG } from '../../firebase/firebase.config.js';

const FIREBASE_SDK_VERSION = '11.10.0';
const REQUIRED_FIREBASE_FIELDS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
let appApiPromise;
let appPromise;
let authApiPromise;
let databaseApiPromise;

function assertFirebaseConfiguration() {
  const missingFields = REQUIRED_FIREBASE_FIELDS.filter((field) => {
    const value = FIREBASE_CONFIG[field];
    return typeof value !== 'string' || !value.trim() || value.includes('<<<');
  });
  if (missingFields.length) {
    throw new Error(`Realtime Database is not configured. Complete these fields in firebase.config.js: ${missingFields.join(', ')}.`);
  }
}

export function loadFirebaseAppApi() {
  appApiPromise ||= import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`)
    .catch((error) => { appApiPromise = undefined; throw error; });
  return appApiPromise;
}

export function loadFirebaseAuthApi() {
  authApiPromise ||= import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`)
    .catch((error) => { authApiPromise = undefined; throw error; });
  return authApiPromise;
}

export function loadFirebaseDatabaseApi() {
  databaseApiPromise ||= import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`)
    .catch((error) => { databaseApiPromise = undefined; throw error; });
  return databaseApiPromise;
}

export function getFirebaseApp() {
  if (appPromise) return appPromise;
  assertFirebaseConfiguration();
  appPromise = loadFirebaseAppApi().then((appApi) => {
    const appName = 'sf3-character-database';
    return appApi.getApps().find((existingApp) => existingApp.name === appName)
      || appApi.initializeApp(FIREBASE_CONFIG, appName);
  }).catch((error) => { appPromise = undefined; throw error; });
  return appPromise;
}
