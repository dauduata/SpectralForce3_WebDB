let statusTimer = null;

export function createSettingsUI() {
  const settingsMenu = document.getElementById('settingsMenu');
  const settingsButton = document.getElementById('settingsButton');
  const settingsControl = document.getElementById('settingsControl');
  const authStatus = document.getElementById('firebaseAuthStatus');
  const authButtons = document.querySelectorAll('[data-auth-action]');
  const syncButtons = document.querySelectorAll('[data-sync-action]');
  const snackbar = document.getElementById('statusSnackbar');

  authStatus.textContent = 'Checking Google sign-in...';
  authButtons.forEach((button) => { button.disabled = true; });
  syncButtons.forEach((button) => { button.disabled = true; });

  function bind(handlers) {
    document.querySelector('.snackbar-close').addEventListener('click', hideStatus);
    settingsButton.addEventListener('click', () => setMenuOpen(settingsMenu.classList.contains('hidden')));
    settingsMenu.addEventListener('click', (event) => {
      const authButton = event.target.closest('[data-auth-action]');
      if (authButton) {
        if (!authButton.disabled) handlers.onAuthAction(authButton.dataset.authAction);
        return;
      }
      const syncButton = event.target.closest('[data-sync-action]');
      if (syncButton && !syncButton.disabled) handlers.onSyncAction(syncButton.dataset.syncAction);
    });
    document.addEventListener('click', (event) => {
      if (!settingsControl.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    });
  }

  function setMenuOpen(isOpen) {
    settingsMenu.classList.toggle('hidden', !isOpen);
    settingsButton.setAttribute('aria-expanded', String(isOpen));
  }

  function renderAuth({ user, authorized, resolved = true, error = null, busy = false }) {
    authStatus.textContent = error
      ? `Google sign-in unavailable: ${error.message}`
      : !resolved
        ? 'Checking Google sign-in...'
        : authorized
          ? `Signed in: ${user.email}`
          : user
            ? `Not permitted: ${user.email || 'Google account'}`
            : 'Sign in with the permitted Google account to sync.';
    document.querySelector('[data-auth-action="sign-in"]').classList.toggle('hidden', authorized);
    document.querySelector('[data-auth-action="sign-out"]').classList.toggle('hidden', !user);
    document.querySelector('[data-auth-action="sign-in"]').disabled = !resolved || busy;
    document.querySelector('[data-auth-action="sign-out"]').disabled = !resolved || busy;
    syncButtons.forEach((button) => { button.disabled = !resolved || !authorized || busy; });
  }

  function setSyncLoading(isLoading, action = '') {
    settingsButton.disabled = isLoading;
    settingsButton.setAttribute('aria-busy', String(isLoading));
    syncButtons.forEach((button) => {
      const type = button.dataset.syncAction;
      button.textContent = isLoading && type === action
        ? (type === 'save' ? 'Saving...' : 'Loading...')
        : type === 'save' ? 'Save to RealtimeDB' : 'Load from RealtimeDB';
    });
  }

  function setAuthBusy(isBusy) {
    authButtons.forEach((button) => { button.disabled = isBusy; });
  }

  function showStatus(message, type = 'info', duration = 5000) {
    if (statusTimer) clearTimeout(statusTimer);
    document.getElementById('snackbarMessage').textContent = message;
    snackbar.className = `snackbar ${type}`;
    snackbar.setAttribute('role', type === 'error' ? 'alert' : 'status');
    snackbar.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    if (duration > 0) statusTimer = setTimeout(hideStatus, duration);
  }

  function hideStatus() {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    snackbar.classList.add('hidden');
  }

  return { bind, renderAuth, setSyncLoading, setAuthBusy, showStatus, hideStatus, setMenuOpen };
}
