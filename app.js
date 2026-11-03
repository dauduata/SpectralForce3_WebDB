import { loadFromRealtimeDB, saveToRealtimeDB } from './realtimeDB.service.js';

const STORAGE_KEY = 'sf3-character-database-v1';
const ATTRIBUTE_KEYS = ['strength', 'intelligence', 'charm', 'diplomacy', 'loyalty'];
const STAT_VALUES = [2, 4, 6, 8, 10];
const ALLOWED_STAT_VALUES = [null, 0, 2, 4, 6, 8, 10];

const state = {
  dataset: null,
  query: '',
  countryFilter: 'all',
  specialSkillOnly: false,
  sortCriteria: [{ field: 'name_english', direction: 'asc' }],
  selectedCharacterId: null,
  editNameEnglish: '',
  editStats: {},
};

let previewTimer = null;
let statusTimer = null;
let realtimeSyncInProgress = false;

const placeholderPortrait = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#182235"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#A5B4C9" font-size="18">N/A</text></svg>'
)}`;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  bindEventHandlers();

  const storageResult = loadFromLocalStorage();

  if (storageResult.data) {
    state.dataset = storageResult.data;
    await hydrateSpecialSkills(state.dataset);
    saveToLocalStorage(state.dataset);
    showStatus('Loaded saved character data from LocalStorage.', 'success');
  } else if (storageResult.hasStoredValue) {
    state.dataset = { countries: [], characters: [] };
    showStatus('Saved data is invalid or unavailable, and the app did not overwrite it.', 'warning');
    renderCountryFilter();
    renderCharacterTable();
    return;
  } else {
    try {
      showStatus('Loading character data...', 'info');
      state.dataset = await fetchCharacterData();
      saveToLocalStorage(state.dataset);
      showStatus('Loaded character data and initialized LocalStorage.', 'success');
    } catch (error) {
      console.error(error);
      state.dataset = { countries: [], characters: [] };
      showStatus('Unable to load the character database from the JSON file.', 'error');
      renderCountryFilter();
      renderCharacterTable();
      return;
    }
  }

  renderCountryFilter();
  renderCharacterTable();
}

async function hydrateSpecialSkills(dataset) {
  const characters = dataset?.characters || [];
  if (!characters.some((character) => !Object.prototype.hasOwnProperty.call(character, 'special_skill'))) {
    return;
  }

  try {
    const response = await fetch('./data/sf3_data.json', { cache: 'no-store' });
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

function bindEventHandlers() {
  const searchInput = document.getElementById('searchInput');
  const countryFilter = document.getElementById('countryFilter');
  const specialSkillFilter = document.getElementById('specialSkillFilter');
  const tableBody = document.getElementById('characterTableBody');
  const modal = document.getElementById('detailModal');
  const snackbar = document.getElementById('statusSnackbar');
  const settingsControl = document.getElementById('settingsControl');
  const settingsButton = document.getElementById('settingsButton');
  const settingsMenu = document.getElementById('settingsMenu');

  snackbar.querySelector('.snackbar-close').addEventListener('click', hideStatus);

  settingsButton.addEventListener('click', () => {
    const isOpen = !settingsMenu.classList.toggle('hidden');
    settingsButton.setAttribute('aria-expanded', String(isOpen));
  });

  settingsMenu.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-sync-action]');
    if (!actionButton || realtimeSyncInProgress) return;

    closeSettingsMenu();
    handleRealtimeSync(actionButton.dataset.syncAction);
  });

  document.addEventListener('click', (event) => {
    if (!settingsControl.contains(event.target)) {
      closeSettingsMenu();
    }
  });

  searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim();
    renderCharacterTable();
  });

  countryFilter.addEventListener('change', (event) => {
    state.countryFilter = event.target.value;
    renderCharacterTable();
  });

  specialSkillFilter.addEventListener('click', () => {
    state.specialSkillOnly = !state.specialSkillOnly;
    specialSkillFilter.setAttribute('aria-pressed', String(state.specialSkillOnly));
    specialSkillFilter.classList.toggle('is-active', state.specialSkillOnly);
    renderCharacterTable();
  });

  document.querySelectorAll('.sort-button').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort;
      const criterionIndex = state.sortCriteria.findIndex((criterion) => criterion.field === field);

      if (criterionIndex === -1) {
        state.sortCriteria.push({ field, direction: 'asc' });
      } else if (state.sortCriteria[criterionIndex].direction === 'asc') {
        state.sortCriteria[criterionIndex].direction = 'desc';
      } else {
        state.sortCriteria.splice(criterionIndex, 1);
      }

      renderCharacterTable();
    });
  });

  tableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-character-id]');
    if (!row) return;
    openCharacterDetail(row.dataset.characterId);
  });

  tableBody.addEventListener('mouseover', (event) => {
    const row = event.target.closest('tr[data-character-id]');
    if (!row) return;
    const character = findCharacterById(row.dataset.characterId);
    if (character) {
      showCharacterPreview(character);
    }
  });

  tableBody.addEventListener('mousemove', (event) => {
    const row = event.target.closest('tr[data-character-id]');
    if (!row) return;
    const character = findCharacterById(row.dataset.characterId);
    if (character) {
      showCharacterPreview(character);
    }
  });

  tableBody.addEventListener('mouseout', (event) => {
    const row = event.target.closest('tr[data-character-id]');
    if (row && !row.contains(event.relatedTarget)) {
      hideCharacterPreview();
    }
  });

  tableBody.addEventListener('mouseleave', () => {
    hideCharacterPreview();
  });

  modal.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    if (action === 'close-modal') {
      closeCharacterDetail();
      return;
    }

    if (action === 'cancel-edit') {
      closeCharacterDetail();
      return;
    }

    if (action === 'save-edit') {
      saveFromEditForm();
      return;
    }

    if (action === 'set-stat-value') {
      const statKey = actionTarget.dataset.statKey;
      const segmentValue = Number(actionTarget.dataset.statValue);
      if (!statKey || !Number.isFinite(segmentValue)) {
        return;
      }

      state.editStats[statKey] = getNextStatValue(state.editStats[statKey], segmentValue);
      renderDetailContent();
      return;
    }

    if (action === 'clear-stat-value') {
      const statKey = actionTarget.dataset.statKey;
      if (!statKey) return;
      state.editStats[statKey] = null;
      renderDetailContent();
    }
  });
  
  modal.addEventListener('input', (event) => {
    if (event.target.id === 'editNameEnglish') {
      state.editNameEnglish = event.target.value;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSettingsMenu();
    }

    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCharacterDetail();
    }
  });
}

async function fetchCharacterData() {
  const response = await fetch('./data/sf3_data.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.status}`);
  }

  const json = await response.json();
  return normalizeDataset(json);
}

function normalizeDataset(data) {
  const result = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : { countries: [], characters: [] };

  if (!Array.isArray(result.countries)) {
    result.countries = [];
  }

  result.countries = result.countries
    .filter((country) => country && typeof country === 'object')
    .map((country) => {
      return { ...country };
    });

  if (!Array.isArray(result.characters)) {
    result.characters = [];
  }

  result.characters = result.characters
    .filter((character) => character && typeof character === 'object')
    .map((character) => {
      const normalizedCharacter = { ...character };
      const savedStats = normalizedCharacter.stats && typeof normalizedCharacter.stats === 'object'
        ? normalizedCharacter.stats
        : null;
      const stats = savedStats && typeof savedStats === 'object' ? { ...savedStats } : {};

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

function loadFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { hasStoredValue: false, data: null };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.characters) || !Array.isArray(parsed.countries)) {
      return { hasStoredValue: true, data: null };
    }

    return { hasStoredValue: true, data: normalizeDataset(parsed) };
  } catch (error) {
    return { hasStoredValue: window.localStorage.getItem(STORAGE_KEY) !== null, data: null };
  }
}

function saveToLocalStorage(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('LocalStorage unavailable:', error);
    showStatus('LocalStorage is unavailable, so changes could not be saved.', 'error');
    return false;
  }
}

function renderCountryFilter() {
  const select = document.getElementById('countryFilter');
  if (!select || !state.dataset) return;

  const countries = [...state.dataset.countries].sort((a, b) => getCountryDisplayName(a).localeCompare(getCountryDisplayName(b)));
  const currentValue = state.countryFilter;

  select.innerHTML = '<option value="all">All countries</option>' + countries.map((country) => {
    const name = getCountryDisplayName(country);
    return `<option value="${escapeHtml(country.id_hex || '')}">${escapeHtml(name)}</option>`;
  }).join('');

  if (countries.some((country) => String(country.id_hex) === String(currentValue))) {
    select.value = String(currentValue);
  } else {
    state.countryFilter = 'all';
    select.value = 'all';
  }
}

function renderCharacterTable() {
  const tableBody = document.getElementById('characterTableBody');
  const countBadge = document.getElementById('characterCount');

  if (!tableBody || !state.dataset) {
    return;
  }

  const filteredList = getVisibleCharacters();
  countBadge.textContent = `${filteredList.length} character${filteredList.length === 1 ? '' : 's'}`;

  if (!filteredList.length) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">No characters match the current search.</td></tr>';
    updateSortIndicators();
    return;
  }

  tableBody.innerHTML = filteredList.map((character) => {
    const portraitUrl = buildPortraitUrl(character.portrait);
    const countryName = resolveCountryName(character.country_id_hex);
    const stats = getOriginalStats(character);

    return `
      <tr data-character-id="${escapeHtml(String(character.id_hex || ''))}" tabindex="0">
        <td class="portrait-cell">
          <img src="${portraitUrl}" alt="${escapeHtml(getCharacterName(character))} portrait" data-portrait="true" loading="lazy" />
        </td>
        <td class="character-id">${escapeHtml(String(character.id_hex || '—'))}</td>
        <td class="name-cell">
          <span class="name-primary">${escapeHtml(getCharacterName(character))}</span>
          <span class="name-secondary">${escapeHtml(getNameJapanese(character))}</span>
        </td>
        <td class="country-name">${escapeHtml(countryName)}</td>
        <td class="numeric-cell">${escapeHtml(formatStatValue(stats.strength))}</td>
        <td class="numeric-cell">${escapeHtml(formatStatValue(stats.intelligence))}</td>
        <td class="numeric-cell">${escapeHtml(formatStatValue(stats.charm))}</td>
        <td class="numeric-cell">${escapeHtml(formatStatValue(stats.diplomacy))}</td>
        <td class="numeric-cell">${escapeHtml(formatStatValue(stats.loyalty))}</td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('img[data-portrait]').forEach((img) => {
    img.addEventListener('error', () => {
      const cell = img.closest('.portrait-cell');
      if (!cell) return;
      cell.innerHTML = '<span class="placeholder">N/A</span>';
    });
  });

  updateSortIndicators();
}

function getVisibleCharacters() {
  const dataset = state.dataset || { characters: [] };
  const normalizedQuery = state.query.toLowerCase();

  const filtered = dataset.characters.filter((character) => {
    const matchesCountry = state.countryFilter === 'all' || String(character.country_id_hex) === String(state.countryFilter);
    if (!matchesCountry) return false;

    const skillName = String(character.special_skill?.name_english || '');
    if (state.specialSkillOnly && !skillName.includes('Secret Art:')) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      getCharacterName(character),
      getNameJapanese(character),
      String(character.id_hex || ''),
      resolveCountryName(character.country_id_hex),
    ].join(' ').toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return sortCharacters(filtered);
}

function sortCharacters(list) {
  const source = [...list];

  return source.sort((left, right) => {
    for (const { field, direction } of state.sortCriteria) {
      let comparison = 0;

      if (field === 'name_english') {
        const leftName = getCharacterName(left).toLowerCase();
        const rightName = getCharacterName(right).toLowerCase();
        comparison = leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: 'base' });
      } else if (field === 'id_hex') {
        const leftValue = Number.parseInt(String(left.id_hex || '0'), 16) || 0;
        const rightValue = Number.parseInt(String(right.id_hex || '0'), 16) || 0;
        comparison = leftValue - rightValue;
      } else {
        const leftValue = getStatValue(left, field);
        const rightValue = getStatValue(right, field);

        if (leftValue === null && rightValue === null) continue;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        comparison = leftValue - rightValue;
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }

    return 0;
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.sort-button').forEach((button) => {
    const indicator = button.querySelector('.sort-indicator');
    if (!indicator) return;

    const criterionIndex = state.sortCriteria.findIndex((criterion) => criterion.field === button.dataset.sort);
    const criterion = state.sortCriteria[criterionIndex];
    const fieldLabel = button.firstChild.textContent.trim();

    if (!criterion) {
      indicator.textContent = '';
      button.setAttribute('aria-label', `Sort by ${fieldLabel}, currently not sorted. Click to sort ascending.`);
      return;
    }

    const directionLabel = criterion.direction === 'asc' ? 'ascending' : 'descending';
    indicator.textContent = `${criterionIndex + 1}${criterion.direction === 'asc' ? '▲' : '▼'}`;
    button.setAttribute('aria-label', `Sort by ${fieldLabel}, ${directionLabel}, priority ${criterionIndex + 1}. Click to cycle sort state.`);
  });
}

function showCharacterPreview(character) {
  const preview = document.getElementById('previewCard');
  if (!preview) return;

  if (previewTimer) {
    clearTimeout(previewTimer);
  }

  previewTimer = setTimeout(() => {
    const stats = getOriginalStats(character);
    const title = getCharacterName(character);

    preview.innerHTML = `
      <div class="detail-header">
        <img class="detail-portrait" src="${buildPortraitUrl(character.portrait)}" alt="${escapeHtml(title)}" />
        <div class="detail-title-wrap">
          <h2 class="detail-title">${escapeHtml(title)}</h2>
          <div class="detail-subtitle">${escapeHtml(getNameJapanese(character))}</div>
          <div class="detail-meta">
            <span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span>
            <span>•</span>
            <span>${escapeHtml(resolveCountryName(character.country_id_hex))}</span>
          </div>
        </div>
      </div>
      <div class="detail-special-skill">
        <span class="detail-special-skill-label">SS:</span>
        <span class="detail-special-skill-name">${escapeHtml(character.special_skill?.name_english || '—')}</span>
        ${character.special_skill?.name_japanese
          ? `<span class="detail-special-skill-japanese">${escapeHtml(character.special_skill.name_japanese)}</span>`
          : ''}
      </div>
      <div class="detail-stats">
        ${ATTRIBUTE_KEYS.map((key) => `
          ${renderStatRow(key, stats[key], { editable: false })}
        `).join('')}
      </div>
    `;

    const previewImage = preview.querySelector('img');
    if (previewImage) {
      previewImage.addEventListener('error', () => {
        previewImage.src = placeholderPortrait;
      });
    }

    preview.classList.remove('hidden');
  }, 80);
}

function hideCharacterPreview() {
  const preview = document.getElementById('previewCard');
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }

  if (preview) {
    preview.classList.add('hidden');
  }
}

function openCharacterDetail(characterId) {
  const character = findCharacterById(characterId);
  if (!character) return;

  hideCharacterPreview();
  state.selectedCharacterId = characterId;
  const modal = document.getElementById('detailModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  enterEditMode();
}

function renderDetailContent() {
  const modalContent = document.getElementById('detailContent');
  const character = findCharacterById(state.selectedCharacterId);

  if (!modalContent || !character) {
    return;
  }

  const stats = getOriginalStats(character);
  const title = getCharacterName(character);
  const subtitle = getNameJapanese(character);
  const countryName = resolveCountryName(character.country_id_hex);
  const invalidKeys = ATTRIBUTE_KEYS.filter((key) => {
    const value = stats[key];
    return value !== null && value !== undefined && value !== '' && !isValidStatValue(value);
  });

  if (invalidKeys.length > 0) {
    showStatus(`Stored value(s) for ${invalidKeys.map(capitalizeLabel).join(', ')} are invalid and need correction before saving.`, 'warning');
  }

  modalContent.innerHTML = `
    <div class="detail-header">
      <img class="detail-portrait" src="${buildPortraitUrl(character.portrait)}" alt="${escapeHtml(title)}" />
      <div class="detail-title-wrap">
        <h2 id="detailTitle" class="detail-title">${escapeHtml(title)}</h2>
        <div class="detail-subtitle">${escapeHtml(subtitle)}</div>
        <div class="detail-meta">
          <span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span>
          <span>•</span>
          <span>${escapeHtml(countryName)}</span>
        </div>
      </div>
    </div>
    <div class="field-group">
      <label for="editNameEnglish">English Name</label>
      <input id="editNameEnglish" type="text" value="${escapeHtml(state.editNameEnglish)}" autocomplete="off" />
    </div>
    <div class="detail-stats detail-stats-edit">
      ${ATTRIBUTE_KEYS.map((key) => renderStatRow(key, state.editStats[key], { editable: true })).join('')}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="cancel-edit">Cancel</button>
      <button type="button" class="btn btn-primary" data-action="save-edit">Save</button>
    </div>
  `;

  const portraitImage = modalContent.querySelector('.detail-portrait');
  if (portraitImage) {
    portraitImage.addEventListener('error', () => {
      portraitImage.src = placeholderPortrait;
    });
  }
}

function enterEditMode() {
  if (!state.selectedCharacterId) return;

  const character = findCharacterById(state.selectedCharacterId);
  if (!character) return;

  state.editStats = ATTRIBUTE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = normalizeStatValue(getOriginalStats(character)[key]);
    return accumulator;
  }, {});
  state.editNameEnglish = character.name_english || '';

  renderDetailContent();
}

function saveFromEditForm() {
  if (!state.selectedCharacterId) {
    return;
  }

  const values = { ...state.editStats };
  const invalidKeys = ATTRIBUTE_KEYS.filter((key) => !isValidStatValue(values[key]));

  if (invalidKeys.length > 0) {
    showStatus(`Please fix invalid values for ${invalidKeys.map(capitalizeLabel).join(', ')} before saving.`, 'error');
    return;
  }

  try {
    const saved = saveCharacterStats(state.selectedCharacterId, values, state.editNameEnglish);
    if (!saved) {
      return;
    }

    const character = findCharacterById(state.selectedCharacterId);
    state.editStats = { ...values };
    renderCharacterTable();
    closeCharacterDetail();
    showStatus(`${getCharacterName(character)} was updated successfully.`, 'success');
  } catch (error) {
    console.error(error);
    showStatus(error.message, 'error');
  }
}

function saveCharacterStats(characterId, stats, nameEnglish) {
  const character = findCharacterById(characterId);
  if (!character) {
    throw new Error('Character not found.');
  }

  if (!character.stats || typeof character.stats !== 'object') {
    character.stats = {};
  }

  for (const key of ATTRIBUTE_KEYS) {
    const value = stats[key];
    const normalized = normalizeStatValue(value) ?? 0;

    if (!isValidStatValue(value) || !ALLOWED_STAT_VALUES.includes(normalized)) {
      throw new Error(`Invalid value for ${capitalizeLabel(key)}.`);
    }

    character.stats[key] = normalized;
  }

  character.name_english = nameEnglish.trim();
  const result = saveToLocalStorage(state.dataset);
  return result;
}

function closeCharacterDetail() {
  const modal = document.getElementById('detailModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  state.selectedCharacterId = null;
  state.editNameEnglish = '';
  state.editStats = {};
}

function findCharacterById(characterId) {
  return (state.dataset?.characters || []).find((character) => String(character.id_hex) === String(characterId));
}

function getOriginalStats(character) {
  if (!character || !character.stats) {
    return ATTRIBUTE_KEYS.reduce((accumulator, key) => {
      accumulator[key] = 0;
      return accumulator;
    }, {});
  }

  return ATTRIBUTE_KEYS.reduce((accumulator, key) => {
    accumulator[key] = character.stats[key] ?? 0;
    return accumulator;
  }, {});
}

function normalizeStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getNextStatValue(currentValue, segmentValue) {
  const normalizedCurrent = normalizeStatValue(currentValue);
  if (normalizedCurrent === segmentValue) {
    return 0;
  }

  return segmentValue;
}

function renderStatRow(statKey, value, { editable = false } = {}) {
  const label = capitalizeLabel(statKey);
  const safeValue = normalizeStatValue(value);
  const isInvalid = value !== null && value !== undefined && value !== '' && !isValidStatValue(value);

  const segmentsMarkup = STAT_VALUES.map((segmentValue) => {
    const isFilled = safeValue !== null && safeValue >= segmentValue;
    const buttonType = editable ? 'button' : 'span';
    const attributes = editable
      ? `type="button" class="stat-segment ${isFilled ? 'filled' : ''}" data-action="set-stat-value" data-stat-key="${statKey}" data-stat-value="${segmentValue}" aria-label="Set ${label} to ${segmentValue}" aria-pressed="${isFilled ? 'true' : 'false'}"`
      : `class="stat-segment ${isFilled ? 'filled' : ''}" aria-hidden="true"`;

    return `<${buttonType} ${attributes}></${buttonType}>`;
  }).join('');

  const displayValue = isInvalid ? '!' : formatStatValue(safeValue);

  if (editable) {
    return `
      <div class="stat-row stat-row-edit ${isInvalid ? 'stat-row-invalid' : ''}">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-control">
          <div class="stat-segments">${segmentsMarkup}</div>
        </div>
        <div class="stat-value-group">
          <span class="stat-value">${escapeHtml(displayValue)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="stat-row ${isInvalid ? 'stat-row-invalid' : ''}">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-control">
        <div class="stat-segments">${segmentsMarkup}</div>
      </div>
      <span class="stat-value">${escapeHtml(displayValue)}</span>
    </div>
  `;
}

function getStatValue(character, field) {
  const stats = getOriginalStats(character);
  const value = stats[field];
  return value === null || value === undefined ? null : Number(value);
}

function buildPortraitUrl(portraitPath) {
  if (!portraitPath) {
    return placeholderPortrait;
  }

  const safePath = String(portraitPath).replace(/^\.\//, '').replace(/^\//, '');
  return `./data/${safePath}`;
}

function resolveCountryName(countryId) {
  if (!state.dataset) return 'Unknown';

  const cleanId = String(countryId ?? '').trim();
  const country = state.dataset.countries.find((entry) => String(entry.id_hex) === cleanId);

  if (!country) {
    return cleanId ? `Unknown (${cleanId})` : 'Unknown';
  }

  return country.name_english || country.name_japanese || `Country ${cleanId ? cleanId : 'Unknown'}`;
}

function getCountryDisplayName(country) {
  return country?.name_english || country?.name_japanese || `Country ${country?.id_hex || 'Unknown'}`;
}

function getCharacterName(character) {
  return character?.name_english || character?.name_japanese || 'Unknown character';
}

function getNameJapanese(character) {
  return character?.name_japanese || '—';
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const sanitized = Number(value);
  if (!Number.isFinite(sanitized) || !isValidStatValue(value)) {
    return '!';
  }

  return String(sanitized);
}

function isValidStatInput(value) {
  if (value === null || value === undefined) return false;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  const numericValue = Number(trimmed);
  return ALLOWED_STAT_VALUES.includes(numericValue);
}

function isValidStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && ALLOWED_STAT_VALUES.includes(numericValue);
}

function capitalizeLabel(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function showStatus(message, type = 'info', duration = 5000) {
  const snackbar = document.getElementById('statusSnackbar');
  const messageElement = document.getElementById('snackbarMessage');
  if (!snackbar || !messageElement) return;

  if (statusTimer) {
    clearTimeout(statusTimer);
  }

  messageElement.textContent = message;
  snackbar.className = `snackbar ${type}`;
  snackbar.setAttribute('role', type === 'error' ? 'alert' : 'status');
  snackbar.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  if (duration > 0) {
    statusTimer = setTimeout(hideStatus, duration);
  }
}

function hideStatus() {
  const snackbar = document.getElementById('statusSnackbar');
  if (!snackbar) return;

  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }

  snackbar.classList.add('hidden');
}

function closeSettingsMenu() {
  const settingsMenu = document.getElementById('settingsMenu');
  const settingsButton = document.getElementById('settingsButton');
  if (!settingsMenu || !settingsButton) return;

  settingsMenu.classList.add('hidden');
  settingsButton.setAttribute('aria-expanded', 'false');
}

async function handleRealtimeSync(action) {
  if (realtimeSyncInProgress) return;

  const isSave = action === 'save';
  const confirmation = isSave
    ? 'Save the current localStorage dataset to Firebase Realtime Database?'
    : 'Load the dataset from Firebase Realtime Database? This will overwrite the current localStorage dataset.';

  if (!window.confirm(confirmation)) return;

  realtimeSyncInProgress = true;
  setRealtimeSyncLoading(true, action);
  showStatus(isSave ? 'Saving to Realtime Database...' : 'Loading from Realtime Database...', 'info', 0);

  try {
    if (isSave) {
      const result = await saveToRealtimeDB();
      showStatus(`Saved ${result.characters} characters and ${result.countries} countries to Realtime Database.`, 'success');
    } else {
      state.dataset = await loadFromRealtimeDB();
      renderCountryFilter();
      renderCharacterTable();
      showStatus('Loaded the dataset from Realtime Database and updated localStorage.', 'success');
    }
  } catch (error) {
    console.error('Realtime Database sync failed:', error);
    showStatus(error.message || 'Realtime Database sync failed.', 'error');
  } finally {
    realtimeSyncInProgress = false;
    setRealtimeSyncLoading(false);
  }
}

function setRealtimeSyncLoading(isLoading, action = '') {
  const settingsButton = document.getElementById('settingsButton');
  const actionButtons = document.querySelectorAll('[data-sync-action]');

  settingsButton.disabled = isLoading;
  settingsButton.setAttribute('aria-busy', String(isLoading));

  actionButtons.forEach((button) => {
    button.disabled = isLoading;
    button.textContent = isLoading && button.dataset.syncAction === action
      ? (action === 'save' ? 'Saving...' : 'Loading...')
      : action === 'save' && button.dataset.syncAction === 'save'
        ? 'Save to RealtimeDB'
        : 'Load from RealtimeDB';
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
