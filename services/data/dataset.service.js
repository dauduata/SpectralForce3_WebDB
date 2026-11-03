import { validateDataset } from './dataset-validator.js';

export const STORAGE_KEY = 'sf3-character-database-v1';
const ATTRIBUTE_KEYS = ['strength', 'intelligence', 'charm', 'diplomacy', 'loyalty'];
const DATASET_URL = './data/sf3_data.json';

export function normalizeDataset(data) {
  const result = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { countries: [], characters: [] };

  if (!Array.isArray(result.countries)) result.countries = [];
  result.countries = result.countries
    .filter((country) => country && typeof country === 'object' && !Array.isArray(country))
    .map((country) => ({ ...country }));

  if (!Array.isArray(result.characters)) result.characters = [];
  result.characters = result.characters
    .filter((character) => character && typeof character === 'object' && !Array.isArray(character))
    .map((character) => {
      const normalizedCharacter = { ...character };
      const stats = normalizedCharacter.stats && typeof normalizedCharacter.stats === 'object' && !Array.isArray(normalizedCharacter.stats)
        ? { ...normalizedCharacter.stats }
        : {};

      for (const statKey of ATTRIBUTE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(stats, statKey) || stats[statKey] == null || stats[statKey] === '') {
          stats[statKey] = 0;
        }
      }

      normalizedCharacter.stats = stats;
      return normalizedCharacter;
    });

  return result;
}

export function readStoredDataset() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { hasStoredValue: false, data: null };
  }

  if (raw === null) return { hasStoredValue: false, data: null };

  try {
    const parsed = JSON.parse(raw);
    validateDataset(parsed);
    return { hasStoredValue: true, data: normalizeDataset(parsed) };
  } catch {
    return { hasStoredValue: true, data: null };
  }
}

export function saveStoredDataset(dataset) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    return true;
  } catch (error) {
    console.error('LocalStorage unavailable:', error);
    return false;
  }
}

export async function loadSourceDataset() {
  const response = await fetch(DATASET_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load JSON: ${response.status}`);
  const source = normalizeDataset(await response.json());
  return validateDataset(source);
}

export async function hydrateSpecialSkills(dataset) {
  const characters = dataset?.characters || [];
  if (!characters.some((character) => !Object.prototype.hasOwnProperty.call(character, 'special_skill'))) return;

  try {
    const response = await fetch(DATASET_URL, { cache: 'no-store' });
    if (!response.ok) return;

    const source = await response.json();
    const sourceCharacters = new Map((source.characters || []).map((character) => [String(character.id_hex), character]));
    for (const character of characters) {
      if (Object.prototype.hasOwnProperty.call(character, 'special_skill')) continue;
      const sourceCharacter = sourceCharacters.get(String(character.id_hex));
      if (sourceCharacter && Object.prototype.hasOwnProperty.call(sourceCharacter, 'special_skill')) {
        character.special_skill = sourceCharacter.special_skill;
      }
    }
  } catch (error) {
    console.warn('Unable to refresh special skill metadata:', error);
  }
}

export async function initializeDataset() {
  const stored = readStoredDataset();
  if (stored.data) {
    await hydrateSpecialSkills(stored.data);
    saveStoredDataset(stored.data);
    return { dataset: stored.data, source: 'local' };
  }

  if (stored.hasStoredValue) {
    return { dataset: { countries: [], characters: [] }, source: 'invalid-local' };
  }

  try {
    const dataset = await loadSourceDataset();
    saveStoredDataset(dataset);
    return { dataset, source: 'json' };
  } catch (error) {
    return { dataset: { countries: [], characters: [] }, source: 'error', error };
  }
}
