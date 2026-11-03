export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://YOUR_DATABASE_HOST.firebasedatabase.app',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID',
};

export const REALTIME_DB_CONFIG = {
  databasePath: 'YOUR_DATABASE_PATH',
};

export const FIREBASE_AUTH_CONFIG = {
  method: 'none',
  accessScope: 'one',

  // Authentication is disabled.
  // Single-user access cannot be enforced by Firebase Security Rules
  // without an authenticated user identity.
};