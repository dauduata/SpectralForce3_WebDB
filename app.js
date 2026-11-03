import { createCharactersController } from './features/characters/characters.controller.js';
import { createSettingsController } from './features/settings/settings.controller.js';
import { initializeDataset } from './services/data/dataset.service.js';

async function initializeApp() {
  const { dataset, source, error } = await initializeDataset();
  if (error) console.error(error);

  let characters;
  const settings = createSettingsController({
    characters: {
      getDataset: () => characters.getDataset(),
      replaceDataset: (nextDataset) => characters.replaceDataset(nextDataset),
    },
  });

  characters = createCharactersController({ dataset, notify: settings.showStatus });
  bindToTopButton();
  window.lucide?.createIcons();
  settings.initialize();

  const startupMessages = {
    local: ['Loaded saved character data from LocalStorage.', 'success'],
    'invalid-local': ['Saved data is invalid or unavailable, and the app did not overwrite it.', 'warning'],
    json: ['Loaded character data and initialized LocalStorage.', 'success'],
    error: ['Unable to load the character database from the JSON file.', 'error'],
  };
  settings.showStatus(...startupMessages[source]);
}

function bindToTopButton() {
  const button = document.getElementById('toTopButton');
  if (!button) return;

  const updateVisibility = () => {
    button.classList.toggle('hidden', window.scrollY < 240);
  };

  window.addEventListener('scroll', updateVisibility, { passive: true });
  updateVisibility();
  button.addEventListener('click', () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
  });
}

document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
