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
      replaceDataset: (dataset) => characters.replaceDataset(dataset),
    },
  });

  characters = createCharactersController({ dataset, notify: settings.showStatus });
  settings.initialize();

  const startupMessages = {
    local: ['Loaded saved character data from LocalStorage.', 'success'],
    'invalid-local': ['Saved data is invalid or unavailable, and the app did not overwrite it.', 'warning'],
    json: ['Loaded character data and initialized LocalStorage.', 'success'],
    error: ['Unable to load the character database from the JSON file.', 'error'],
  };
  settings.showStatus(...startupMessages[source]);
}

document.addEventListener('DOMContentLoaded', initializeApp, { once: true });

