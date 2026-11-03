import { saveStoredDataset } from '../../services/data/dataset.service.js';
import { createCharactersUI } from './characters.ui.js';

const ATTRIBUTE_KEYS = ['strength', 'intelligence', 'charm', 'diplomacy', 'loyalty'];
const ALLOWED_STAT_VALUES = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function createCharactersController({ dataset, notify }) {
  const ui = createCharactersUI();
  const state = {
    dataset,
    query: '',
    countryFilter: 'all',
    specialSkillOnly: false,
    sortCriteria: [{ field: 'name_english', direction: 'asc' }],
    selectedCharacterId: null,
    editNameEnglish: '',
    editStats: {},
  };

  function getStats(character) {
      return ATTRIBUTE_KEYS.reduce((result, key) => {
        result[key] = character?.stats?.[key] ?? 0;
        return result;
      }, {});
  }

  function getName(character) {
    return character?.name_english || character?.name_japanese || 'Unknown character';
  }

  function getJapaneseName(character) {
    return character?.name_japanese || '—';
  }

  function getCountryName(country) {
    return country?.name_english
      || country?.name_japanese
      || `Country ${country?.id_hex || 'Unknown'}`;
  }

  function getCountryNameById(countryId) {
    const cleanId = String(countryId ?? '').trim();
    const country = state.dataset.countries.find(
      (entry) => String(entry.id_hex) === cleanId,
    );
    if (!country) {
      return cleanId ? `Unknown (${cleanId})` : 'Unknown';
    }
    return country.name_english
      || country.name_japanese
      || `Country ${cleanId || 'Unknown'}`;
  }

  function helpers() {
    return {
      getStats,
      getName,
      getJapaneseName,
      getCountryNameById,
      notify,
    };
  }

  function findCharacter(characterId) {
    return state.dataset.characters.find(
      (character) => String(character.id_hex) === String(characterId),
    );
  }

  function getStatValue(character, field) {
    const value = getStats(character)[field];
    return value === null || value === undefined ? null : Number(value);
  }

  function getProfileValue(character) {
    const stats = getStats(character);
    const values = ATTRIBUTE_KEYS.map((key) => Number(stats[key] ?? 0));
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.length ? total / values.length : 0;
  }

  function visibleCharacters() {
    const query = state.query.toLowerCase();
    const matchingCharacters = state.dataset.characters.filter((character) => {
      const countryId = String(character.country_id_hex);
      if (state.countryFilter !== 'all' && countryId !== String(state.countryFilter)) {
        return false;
      }

      const skillName = String(character.special_skill?.name_english || '');
      if (state.specialSkillOnly && !skillName.includes('Secret Art:')) {
        return false;
      }
      if (!query) {
        return true;
      }

      const searchableValues = [
        getName(character),
        getJapaneseName(character),
        String(character.id_hex || ''),
        getCountryNameById(character.country_id_hex),
      ];
      return searchableValues.join(' ').toLowerCase().includes(query);
    });

    return sortCharacters(matchingCharacters);
  }

  function sortCharacters(characters) {
    return [...characters].sort((left, right) => {
      for (const { field, direction } of state.sortCriteria) {
        let comparison = 0;
        if (field === 'name_english') {
          comparison = getName(left)
            .toLowerCase()
            .localeCompare(
              getName(right).toLowerCase(),
              undefined,
              { numeric: true, sensitivity: 'base' },
            );
        } else if (field === 'id_hex') {
          const leftId = Number.parseInt(String(left.id_hex || '0'), 16) || 0;
          const rightId = Number.parseInt(String(right.id_hex || '0'), 16) || 0;
          comparison = leftId - rightId;
        } else if (field === 'profile') {
          comparison = getProfileValue(left) - getProfileValue(right);
        } else {
          const leftValue = getStatValue(left, field);
          const rightValue = getStatValue(right, field);
          if (leftValue === null && rightValue === null) continue;
          if (leftValue === null) return 1;
          if (rightValue === null) return -1;
          comparison = leftValue - rightValue;
        }
        if (comparison) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  function render() {
    const selectedCountryExists = state.dataset.countries.some(
      (country) => String(country.id_hex) === String(state.countryFilter),
    );
    if (!selectedCountryExists) {
      state.countryFilter = 'all';
    }
    ui.renderCountries(state.dataset.countries, state.countryFilter, getCountryName);
    ui.renderTable(visibleCharacters(), helpers(), state.sortCriteria);
    const filter = document.getElementById('specialSkillFilter');
    filter.setAttribute('aria-pressed', String(state.specialSkillOnly));
    filter.classList.toggle('is-active', state.specialSkillOnly);
    if (state.selectedCharacterId !== null) {
      renderEditor();
    }
  }

  function renderEditor() {
    const character = findCharacter(state.selectedCharacterId);
    if (character) {
      ui.renderEditor(
        {
          character,
          name: state.editNameEnglish,
          stats: state.editStats,
        },
        helpers(),
      );
    }
  }

  function openEditor(characterId) {
    const character = findCharacter(characterId);
    if (!character) {
      return;
    }
    ui.hidePreview();
    state.selectedCharacterId = characterId;
    state.editStats = ATTRIBUTE_KEYS.reduce((result, key) => {
      const value = getStats(character)[key];
      result[key] = value === null || value === undefined || value === '' ? null : Number(value);
      return result;
    }, {});
    state.editNameEnglish = character.name_english || '';
    ui.openEditor();
    renderEditor();
  }

  function closeEditor() {
    ui.closeEditor();
    state.selectedCharacterId = null;
    state.editNameEnglish = '';
    state.editStats = {};
  }

  function saveEdit() {
    if (state.selectedCharacterId === null) {
      return;
    }
    const invalid = ATTRIBUTE_KEYS.filter((key) => {
      const value = state.editStats[key];
      return value !== null
        && value !== undefined
        && value !== ''
        && !ALLOWED_STAT_VALUES.includes(Number(value));
    });
    if (invalid.length) {
      const invalidLabels = invalid.map((key) => (
        key[0].toUpperCase() + key.slice(1)
      )).join(', ');
      notify(
        `Please fix invalid values for ${invalidLabels} before saving.`,
        'error',
      );
      return;
    }
    const character = findCharacter(state.selectedCharacterId);
    if (!character) {
      return;
    }
    character.stats ||= {};
    for (const key of ATTRIBUTE_KEYS) {
      character.stats[key] = state.editStats[key] == null
        ? 0
        : Number(state.editStats[key]);
    }
    character.name_english = state.editNameEnglish.trim();
    if (!saveStoredDataset(state.dataset)) {
      notify('LocalStorage is unavailable, so changes could not be saved.', 'error');
      return;
    }
    const name = getName(character);
    closeEditor();
    render();
    notify(`${name} was updated successfully.`, 'success');
  }

  ui.bind({
    onSearch: (value) => {
      state.query = value.trim();
      render();
    },
    onCountryChange: (value) => {
      state.countryFilter = value;
      render();
    },
    onSkillToggle: () => {
      state.specialSkillOnly = !state.specialSkillOnly;
      render();
    },
    onSort: (field) => {
      const index = state.sortCriteria.findIndex(
        (criterion) => criterion.field === field,
      );
      if (index === -1) {
        state.sortCriteria.push({ field, direction: 'asc' });
      } else if (state.sortCriteria[index].direction === 'asc') {
        state.sortCriteria[index].direction = 'desc';
      } else {
        state.sortCriteria.splice(index, 1);
      }
      render();
    },
    onOpen: openEditor,
    onPreview: (id) => {
      const character = findCharacter(id);
      if (character) {
        ui.showPreview(character, helpers());
      }
    },
    onHidePreview: () => {
      ui.hidePreview();
    },
    onCloseEditor: closeEditor,
    onSaveEdit: saveEdit,
    onStatValue: (key, value) => {
      if (!ATTRIBUTE_KEYS.includes(key) || !Number.isFinite(value)) {
        return;
      }
      state.editStats[key] = state.editStats[key] === value ? 0 : value;
      renderEditor();
    },
    onClearStat: (key) => {
      if (ATTRIBUTE_KEYS.includes(key)) {
        state.editStats[key] = null;
        renderEditor();
      }
    },
    onNameInput: (value) => {
      state.editNameEnglish = value;
    },
    onEscape: () => {
      if (state.selectedCharacterId !== null) {
        closeEditor();
      }
    },
  });

  render();
  return {
    getDataset: () => state.dataset,
    replaceDataset: (nextDataset) => {
      state.dataset = nextDataset;
      state.selectedCharacterId = null;
      render();
    },
    refresh: render,
  };
}
