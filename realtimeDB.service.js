import { FIREBASE_CONFIG, FIREBASE_AUTH_CONFIG, REALTIME_DB_CONFIG } from './firebase.config.js';

const STORAGE_KEY = 'sf3-character-database-v1';
const FIREBASE_SDK_VERSION = '11.10.0';
const REQUIRED_FIREBASE_FIELDS = ['apiKey', 'databaseURL', 'projectId', 'appId'];
const AUTHENTICATION_IMPLEMENTED = false;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateDataset(dataset) {
  if (!isPlainObject(dataset) || !Array.isArray(dataset.countries) || !Array.isArray(dataset.characters)) {
    throw new Error('Dataset is invalid: expected countries and characters arrays.');
  }

  if (dataset.characters.length === 0) {
    throw new Error('Dataset is empty: no characters are available to sync.');
  }

  if (!dataset.countries.every(isPlainObject) || !dataset.characters.every(isPlainObject)) {
    throw new Error('Dataset is invalid: country and character records must be objects.');
  }

  return dataset;
}

function assertConfiguration() {
  const missingFields = REQUIRED_FIREBASE_FIELDS.filter((field) => {
    const value = FIREBASE_CONFIG[field];
    return typeof value !== 'string' || !value.trim() || value.includes('<<<');
  });

  if (missingFields.length > 0) {
    throw new Error(`Realtime Database is not configured. Complete these fields in firebase.config.js: ${missingFields.join(', ')}.`);
  }

  const databasePath = REALTIME_DB_CONFIG.databasePath;
  if (typeof databasePath !== 'string' || !databasePath.trim() || databasePath.includes('<<<')) {
    throw new Error('Choose a Realtime Database path in firebase.config.js before syncing.');
  }
  if (!databasePath.trim().replace(/^\/+|\/+$/g, '')) {
    throw new Error('Realtime Database path must target a child path, not the database root.');
  }

  // sẽ thực hiện sau nếu sau này không muốn ai cũng có thể sync dữ liệu lên firebase database 
  // const authenticationMethod = FIREBASE_AUTH_CONFIG.method;
  // if (typeof authenticationMethod !== 'string' || !authenticationMethod.trim() || authenticationMethod.includes('<<<')) {
  //   throw new Error('Choose and implement an authentication method before syncing. Do not enable public database writes.');
  // }
  // if (!AUTHENTICATION_IMPLEMENTED) {
  //   throw new Error('Firebase Authentication is not implemented yet. Complete the selected sign-in flow before syncing.');
  // }
}

async function getRealtimeDatabaseApi() {
  assertConfiguration();

  const sdkBaseUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appApi, databaseApi] = await Promise.all([
    import(`${sdkBaseUrl}/firebase-app.js`),
    import(`${sdkBaseUrl}/firebase-database.js`),
  ]);

  const appName = 'sf3-character-database';
  const app = appApi.getApps().find((existingApp) => existingApp.name === appName)
    || appApi.initializeApp(FIREBASE_CONFIG, appName);

  return {
    database: databaseApi.getDatabase(app),
    ref: databaseApi.ref,
    get: databaseApi.get,
    set: databaseApi.set,
  };
}

function getConfiguredPath() {
  return REALTIME_DB_CONFIG.databasePath.trim().replace(/^\/+|\/+$/g, '');
}

export async function saveToRealtimeDB() {
  let localDataset;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      throw new Error(`No local dataset found under localStorage key "${STORAGE_KEY}".`);
    }
    localDataset = validateDataset(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Local dataset is not valid JSON and was not synced.');
    }
    throw error;
  }

  const { database, ref, set } = await getRealtimeDatabaseApi();
  await set(ref(database, getConfiguredPath()), localDataset);
  return {
    countries: localDataset.countries.length,
    characters: localDataset.characters.length,
  };
}

export async function loadFromRealtimeDB() {
  const { database, ref, get } = await getRealtimeDatabaseApi();
  const snapshot = await get(ref(database, getConfiguredPath()));

  if (!snapshot.exists()) {
    throw new Error('No dataset exists at the configured Realtime Database path. Local data was not changed.');
  }

  const remoteDataset = validateDataset(snapshot.val());
  const serializedDataset = JSON.stringify(remoteDataset);

  try {
    window.localStorage.setItem(STORAGE_KEY, serializedDataset);
  } catch (error) {
    throw new Error('Remote dataset was valid, but localStorage could not be updated.');
  }

  return remoteDataset;
}