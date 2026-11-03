import { getFirebaseApp, loadFirebaseDatabaseApi } from './firebase-app.service.js';

export async function saveToRealtimeDB(path, dataset) {
  const [app, databaseApi] = await Promise.all([getFirebaseApp(), loadFirebaseDatabaseApi()]);
  const database = databaseApi.getDatabase(app);
  await databaseApi.set(databaseApi.ref(database, path), dataset);
  return {
    countries: dataset.countries.length,
    characters: dataset.characters.length,
  };
}

export async function loadFromRealtimeDB(path) {
  const [app, databaseApi] = await Promise.all([getFirebaseApp(), loadFirebaseDatabaseApi()]);
  const database = databaseApi.getDatabase(app);
  const snapshot = await databaseApi.get(databaseApi.ref(database, path));
  if (!snapshot.exists()) {
    throw new Error('No dataset exists at the configured Realtime Database path. Local data was not changed.');
  }
  return snapshot.val();
}
