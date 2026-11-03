const ATTRIBUTE_KEYS = ['strength', 'intelligence', 'charm', 'diplomacy', 'loyalty'];
const STAT_VALUES = [2, 4, 6, 8, 10];
const placeholderPortrait = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#182235"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#A5B4C9" font-size="18">N/A</text></svg>')}`;
let previewTimer = null;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function capitalizeLabel(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function normalizeStatValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isValidStatValue(value) {
  if (value === null || value === undefined || value === '') return true;
  return [null, 0, 2, 4, 6, 8, 10].includes(Number(value));
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && isValidStatValue(value) ? String(numberValue) : '!';
}

function renderStatRow(statKey, value, editable = false) {
  const label = capitalizeLabel(statKey);
  const safeValue = normalizeStatValue(value);
  const invalid = value !== null && value !== undefined && value !== '' && !isValidStatValue(value);
  const segments = STAT_VALUES.map((segmentValue) => {
    const filled = safeValue !== null && safeValue >= segmentValue;
    const tag = editable ? 'button' : 'span';
    const attributes = editable
      ? `type="button" class="stat-segment ${filled ? 'filled' : ''}" data-action="set-stat-value" data-stat-key="${statKey}" data-stat-value="${segmentValue}" aria-label="Set ${label} to ${segmentValue}" aria-pressed="${filled}"`
      : `class="stat-segment ${filled ? 'filled' : ''}" aria-hidden="true"`;
    return `<${tag} ${attributes}></${tag}>`;
  }).join('');
  const valueMarkup = `<span class="stat-value">${escapeHtml(invalid ? '!' : formatStatValue(safeValue))}</span>`;
  return editable
    ? `<div class="stat-row stat-row-edit ${invalid ? 'stat-row-invalid' : ''}"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-control"><div class="stat-segments">${segments}</div></div><div class="stat-value-group">${valueMarkup}</div></div>`
    : `<div class="stat-row ${invalid ? 'stat-row-invalid' : ''}"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-control"><div class="stat-segments">${segments}</div></div>${valueMarkup}</div>`;
}

function portraitUrl(path) {
  if (!path) return placeholderPortrait;
  return `./data/${String(path).replace(/^\.\//, '').replace(/^\//, '')}`;
}

function attachPortraitFallback(image) {
  image?.addEventListener('error', () => {
    if (image.closest('.portrait-cell')) image.closest('.portrait-cell').innerHTML = '<span class="placeholder">N/A</span>';
    else image.src = placeholderPortrait;
  }, { once: true });
}

export function createCharactersUI() {
  const tableBody = document.getElementById('characterTableBody');

  function bind(handlers) {
    document.getElementById('searchInput').addEventListener('input', (event) => handlers.onSearch(event.target.value));
    document.getElementById('countryFilter').addEventListener('change', (event) => handlers.onCountryChange(event.target.value));
    document.getElementById('specialSkillFilter').addEventListener('click', () => handlers.onSkillToggle());
    document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => handlers.onSort(button.dataset.sort)));

    tableBody.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) handlers.onOpen(row.dataset.characterId);
    });
    tableBody.addEventListener('mouseover', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) handlers.onPreview(row.dataset.characterId);
    });
    tableBody.addEventListener('mousemove', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) handlers.onPreview(row.dataset.characterId);
    });
    tableBody.addEventListener('mouseout', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row && !row.contains(event.relatedTarget)) handlers.onHidePreview();
    });
    tableBody.addEventListener('mouseleave', handlers.onHidePreview);

    const modal = document.getElementById('detailModal');
    modal.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'close-modal' || target.dataset.action === 'cancel-edit') handlers.onCloseEditor();
      if (target.dataset.action === 'save-edit') handlers.onSaveEdit();
      if (target.dataset.action === 'set-stat-value') handlers.onStatValue(target.dataset.statKey, Number(target.dataset.statValue));
      if (target.dataset.action === 'clear-stat-value') handlers.onClearStat(target.dataset.statKey);
    });
    modal.addEventListener('input', (event) => {
      if (event.target.id === 'editNameEnglish') handlers.onNameInput(event.target.value);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        handlers.onHidePreview();
        handlers.onEscape();
      }
    });
  }

  function renderCountries(countries, selectedCountry, getCountryName) {
    const select = document.getElementById('countryFilter');
    const sorted = [...countries].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));
    select.innerHTML = '<option value="all">All countries</option>' + sorted.map((country) =>
      `<option value="${escapeHtml(country.id_hex || '')}">${escapeHtml(getCountryName(country))}</option>`).join('');
    select.value = String(selectedCountry);
  }

  function renderTable(characters, helpers, sortCriteria) {
    document.getElementById('characterCount').textContent = `${characters.length} character${characters.length === 1 ? '' : 's'}`;
    if (!characters.length) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="9">No characters match the current search.</td></tr>';
      updateSortIndicators(sortCriteria);
      return;
    }
    tableBody.innerHTML = characters.map((character) => {
      const stats = helpers.getStats(character);
      return `<tr data-character-id="${escapeHtml(String(character.id_hex || ''))}" tabindex="0"><td class="portrait-cell"><img src="${portraitUrl(character.portrait)}" alt="${escapeHtml(helpers.getName(character))} portrait" data-portrait="true" loading="lazy" /></td><td class="character-id">${escapeHtml(String(character.id_hex || '—'))}</td><td class="name-cell"><span class="name-primary">${escapeHtml(helpers.getName(character))}</span><span class="name-secondary">${escapeHtml(helpers.getJapaneseName(character))}</span></td><td class="country-name">${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}</td>${ATTRIBUTE_KEYS.map((key) => `<td class="numeric-cell">${escapeHtml(formatStatValue(stats[key]))}</td>`).join('')}</tr>`;
    }).join('');
    tableBody.querySelectorAll('img[data-portrait]').forEach(attachPortraitFallback);
    updateSortIndicators(sortCriteria);
  }

  function updateSortIndicators(sortCriteria) {
    document.querySelectorAll('.sort-button').forEach((button) => {
      const indicator = button.querySelector('.sort-indicator');
      if (!indicator) return;
      const index = sortCriteria.findIndex((criterion) => criterion.field === button.dataset.sort);
      const criterion = sortCriteria[index];
      const label = button.firstChild.textContent.trim();
      if (!criterion) {
        indicator.textContent = '';
        button.setAttribute('aria-label', `Sort by ${label}, currently not sorted. Click to sort ascending.`);
        return;
      }
      const direction = criterion.direction === 'asc' ? 'ascending' : 'descending';
      indicator.textContent = `${index + 1}${criterion.direction === 'asc' ? '▲' : '▼'}`;
      button.setAttribute('aria-label', `Sort by ${label}, ${direction}, priority ${index + 1}. Click to cycle sort state.`);
    });
  }

  function showPreview(character, helpers) {
    const preview = document.getElementById('previewCard');
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const name = helpers.getName(character);
      preview.innerHTML = `<div class="detail-header"><img class="detail-portrait" src="${portraitUrl(character.portrait)}" alt="${escapeHtml(name)}" /><div class="detail-title-wrap"><h2 class="detail-title">${escapeHtml(name)}</h2><div class="detail-subtitle">${escapeHtml(helpers.getJapaneseName(character))}</div><div class="detail-meta"><span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span><span>•</span><span>${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}</span></div></div></div><div class="detail-special-skill"><span class="detail-special-skill-label">SS:</span><span class="detail-special-skill-name">${escapeHtml(character.special_skill?.name_english || '—')}</span>${character.special_skill?.name_japanese ? `<span class="detail-special-skill-japanese">${escapeHtml(character.special_skill.name_japanese)}</span>` : ''}</div><div class="detail-stats">${ATTRIBUTE_KEYS.map((key) => renderStatRow(key, helpers.getStats(character)[key])).join('')}</div>`;
      attachPortraitFallback(preview.querySelector('img'));
      preview.classList.remove('hidden');
    }, 80);
  }

  function hidePreview() {
    clearTimeout(previewTimer);
    previewTimer = null;
    document.getElementById('previewCard').classList.add('hidden');
  }

  function openEditor() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeEditor() {
    const modal = document.getElementById('detailModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderEditor(model, helpers) {
    const { character, name, stats } = model;
    const content = document.getElementById('detailContent');
    const originalStats = helpers.getStats(character);
    const invalid = ATTRIBUTE_KEYS.filter((key) => !isValidStatValue(originalStats[key]));
    if (invalid.length) helpers.notify(`Stored value(s) for ${invalid.map(capitalizeLabel).join(', ')} are invalid and need correction before saving.`, 'warning');
    const title = helpers.getName(character);
    content.innerHTML = `<div class="detail-header"><img class="detail-portrait" src="${portraitUrl(character.portrait)}" alt="${escapeHtml(title)}" /><div class="detail-title-wrap"><h2 id="detailTitle" class="detail-title">${escapeHtml(title)}</h2><div class="detail-subtitle">${escapeHtml(helpers.getJapaneseName(character))}</div><div class="detail-meta"><span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span><span>•</span><span>${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}</span></div></div></div><div class="field-group"><label for="editNameEnglish">English Name</label><input id="editNameEnglish" type="text" value="${escapeHtml(name)}" autocomplete="off" /></div><div class="detail-stats detail-stats-edit">${ATTRIBUTE_KEYS.map((key) => renderStatRow(key, stats[key], true)).join('')}</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="cancel-edit">Cancel</button><button type="button" class="btn btn-primary" data-action="save-edit">Save</button></div>`;
    attachPortraitFallback(content.querySelector('.detail-portrait'));
  }

  return { bind, renderCountries, renderTable, showPreview, hidePreview, openEditor, closeEditor, renderEditor };
}
