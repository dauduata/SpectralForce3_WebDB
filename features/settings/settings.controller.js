import { REALTIME_DB_CONFIG } from '../../firebase/firebase.config.js';
import { validateDataset } from '../../services/data/dataset-validator.js';
import { saveStoredDataset } from '../../services/data/dataset.service.js';
import { observeAuthState, signInWithGoogle, signOutFromFirebase } from '../../services/firebase/auth.service.js';
import { loadFromRealtimeDB, saveToRealtimeDB } from '../../services/firebase/realtime-db.service.js';
import { createSettingsUI } from './settings.ui.js';

export function createSettingsController({ characters }) {
  const ui = createSettingsUI();
  let authResolved = false;
  let syncAuthorized = false;
  let currentUser = null;
  let authActionInProgress = false;
  let realtimeSyncInProgress = false;
  let observerRegistered = false;

  function renderAuth(error = null) {
    ui.renderAuth({ user: currentUser, authorized: syncAuthorized, resolved: authResolved, error, busy: authActionInProgress || realtimeSyncInProgress });
  }

  async function handleAuthAction(action) {
    if (authActionInProgress) return;
    authActionInProgress = true;
    ui.setAuthBusy(true);
    renderAuth();
    ui.showStatus(action === 'sign-in' ? 'Opening Google sign-in...' : 'Signing out...', 'info', 0);
    try {
      if (action === 'sign-in') {
        await signInWithGoogle();
        ui.showStatus('Google account verified. Realtime Database sync is available.', 'success');
      } else {
        await signOutFromFirebase();
        ui.showStatus('Signed out of Firebase.', 'success');
      }
    } catch (error) {
      console.error('Firebase Authentication failed:', error);
      ui.showStatus(error.message || 'Firebase Authentication failed.', 'error');
    } finally {
      authActionInProgress = false;
      ui.setAuthBusy(false);
      renderAuth();
    }
  }

  async function handleSyncAction(action) {
    if (realtimeSyncInProgress || !authResolved || !syncAuthorized) return;
    const isSave = action === 'save';
    const confirmation = isSave
      ? 'Save the current localStorage dataset to Firebase Realtime Database?'
      : 'Load the dataset from Firebase Realtime Database? This will overwrite the current localStorage dataset.';
    if (!window.confirm(confirmation)) return;

    realtimeSyncInProgress = true;
    ui.setSyncLoading(true, action);
    renderAuth();
    ui.showStatus(isSave ? 'Saving to Realtime Database...' : 'Loading from Realtime Database...', 'info', 0);
    try {
      const path = REALTIME_DB_CONFIG.databasePath.trim().replace(/^\/+|\/+$/g, '');
      if (!path) throw new Error('Realtime Database path must target a child path, not the database root.');
      if (isSave) {
        const dataset = validateDataset(characters.getDataset(), { requireCharacters: true, strictRecords: true });
        const result = await saveToRealtimeDB(path, dataset);
        ui.showStatus(`Saved ${result.characters} characters and ${result.countries} countries to Realtime Database.`, 'success');
      } else {
        const dataset = validateDataset(await loadFromRealtimeDB(path), { requireCharacters: true, strictRecords: true });
        if (!saveStoredDataset(dataset)) throw new Error('Remote dataset was valid, but localStorage could not be updated.');
        characters.replaceDataset(dataset);
        ui.showStatus('Loaded the dataset from Realtime Database and updated localStorage.', 'success');
      }
    } catch (error) {
      console.error('Realtime Database sync failed:', error);
      ui.showStatus(error.message || 'Realtime Database sync failed.', 'error');
    } finally {
      realtimeSyncInProgress = false;
      ui.setSyncLoading(false);
      renderAuth();
    }
  }

  function initialize() {
    if (observerRegistered) return;
    observerRegistered = true;
    ui.bind({ onAuthAction: handleAuthAction, onSyncAction: handleSyncAction });
    observeAuthState((status) => {
      authResolved = true;
      if (status.error) {
        syncAuthorized = false;
        currentUser = null;
        renderAuth(status.error);
        console.error('Unable to initialize Firebase Authentication:', status.error);
        return;
      }
      currentUser = status.user;
      syncAuthorized = status.authorized;
      renderAuth();
    }).catch((error) => {
      authResolved = true;
      syncAuthorized = false;
      currentUser = null;
      renderAuth(error);
      console.error('Unable to initialize Firebase Authentication:', error);
    });
  }

  return { initialize, showStatus: ui.showStatus };
}
