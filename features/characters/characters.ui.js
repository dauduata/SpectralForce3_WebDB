const ATTRIBUTE_KEYS = ['strength', 'intelligence', 'charm', 'diplomacy', 'loyalty'];
const STAT_VALUES = [2, 4, 6, 8, 10];
const placeholderSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<rect width="100" height="100" fill="#182235"/>'
  + '<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" '
  + 'fill="#A5B4C9" font-size="18">N/A</text></svg>';
const placeholderPortrait = (
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(placeholderSvg)}`
);
let previewTimer = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalizeLabel(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function normalizeStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isValidStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(Number(value));
}

function formatStatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && isValidStatValue(value)
    ? String(numberValue)
    : '!';
}

function renderStatRow(statKey, value, editable = false) {
  const label = capitalizeLabel(statKey);
  const safeValue = normalizeStatValue(value);
  const invalid = value !== null && value !== undefined && value !== '' && !isValidStatValue(value);
  const segments = STAT_VALUES.map((segmentValue) => {
    const oddValue = segmentValue - 1;
    const oddFilled = safeValue !== null && safeValue >= oddValue;
    const evenFilled = safeValue !== null && safeValue >= segmentValue;
    const renderHalf = (half, halfValue, filled) => {
      if (!editable) {
        return `
          <span
            class="stat-segment-half ${filled ? 'filled' : ''}"
            aria-hidden="true"
          ></span>
        `;
      }

      return `
        <button
          type="button"
          class="stat-segment-half stat-segment-${half} ${filled ? 'filled' : ''}"
          data-action="set-stat-value"
          data-stat-key="${statKey}"
          data-stat-value="${halfValue}"
          aria-label="Set ${label} to ${halfValue}"
          aria-pressed="${safeValue === halfValue}"
        ></button>
      `;
    };

    return `
      <span class="stat-segment">
        ${renderHalf('left', oddValue, oddFilled)}
        ${renderHalf('right', segmentValue, evenFilled)}
      </span>
    `;
  }).join('');
  const formattedValue = invalid ? '!' : formatStatValue(safeValue);
  const valueMarkup = `<span class="stat-value">${escapeHtml(formattedValue)}</span>`;
  if (editable) {
    return `
      <div class="stat-row stat-row-edit ${invalid ? 'stat-row-invalid' : ''}">
        <div class="stat-label">${escapeHtml(label)}</div>
        <div class="stat-control">
          <div class="stat-segments">${segments}</div>
        </div>
        <div class="stat-value-group">${valueMarkup}</div>
      </div>
    `;
  }

  return `
    <div class="stat-row ${invalid ? 'stat-row-invalid' : ''}">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-control">
        <div class="stat-segments">${segments}</div>
      </div>
      ${valueMarkup}
    </div>
  `;
}

function portraitUrl(path) {
  if (!path) return placeholderPortrait;
  return `./data/${String(path).replace(/^\.\//, '').replace(/^\//, '')}`;
}

function attachPortraitFallback(image) {
  image?.addEventListener('error', () => {
    const portraitCell = image.closest('.portrait-cell');
    if (portraitCell) {
      portraitCell.innerHTML = '<span class="placeholder">N/A</span>';
    } else {
      image.src = placeholderPortrait;
    }
  }, { once: true });
}

const chartInstances = new Map();

function renderRadialChart(canvas, character, stats) {
  if (!canvas || typeof window === 'undefined' || !window.Chart) {
    return;
  }

  const existingChart = chartInstances.get(String(character.id_hex || ''));
  if (existingChart) {
    existingChart.destroy();
    chartInstances.delete(String(character.id_hex || ''));
  }

  const data = ATTRIBUTE_KEYS.map((key) => {
    const value = normalizeStatValue(stats[key]);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 10) : 0;
  });

  const chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['STR', 'INT', 'CHA', 'DIP', 'LOY'],
      datasets: [{
        label: 'Profile',
        data,
        backgroundColor: 'rgba(56, 189, 248, 0.22)',
        borderColor: 'rgba(56, 189, 248, 0.95)',
        pointBackgroundColor: '#7dd3fc',
        pointBorderColor: '#e2e8f0',
        pointHoverBackgroundColor: '#f8fafc',
        borderWidth: 2,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed.r}`,
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: {
            display: false,
            stepSize: 2,
          },
          pointLabels: {
            color: '#cbd5e1',
            font: {
              size: 10,
            },
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.25)',
          },
          angleLines: {
            color: 'rgba(148, 163, 184, 0.25)',
          },
        },
      },
    },
  });

  chartInstances.set(String(character.id_hex || ''), chart);
}

export function createCharactersUI() {
  const tableBody = document.getElementById('characterTableBody');

  function bind(handlers) {
    document.getElementById('searchInput').addEventListener(
      'input',
      (event) => handlers.onSearch(event.target.value),
    );
    document.getElementById('countryFilter').addEventListener(
      'change',
      (event) => handlers.onCountryChange(event.target.value),
    );
    document.getElementById('specialSkillFilter').addEventListener(
      'click',
      () => handlers.onSkillToggle(),
    );
    document.querySelectorAll('.sort-button').forEach((button) => {
      button.addEventListener('click', () => handlers.onSort(button.dataset.sort));
    });

    tableBody.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) {
        handlers.onOpen(row.dataset.characterId);
      }
    });
    tableBody.addEventListener('mouseover', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) {
        handlers.onPreview(row.dataset.characterId);
      }
    });
    tableBody.addEventListener('mousemove', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row) {
        handlers.onPreview(row.dataset.characterId);
      }
    });
    tableBody.addEventListener('mouseout', (event) => {
      const row = event.target.closest('tr[data-character-id]');
      if (row && !row.contains(event.relatedTarget)) {
        handlers.onHidePreview();
      }
    });
    tableBody.addEventListener('mouseleave', handlers.onHidePreview);

    const modal = document.getElementById('detailModal');
    modal.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      if (
        target.dataset.action === 'close-modal'
        || target.dataset.action === 'cancel-edit'
      ) {
        handlers.onCloseEditor();
      }
      if (target.dataset.action === 'save-edit') {
        handlers.onSaveEdit();
      }
      if (target.dataset.action === 'set-stat-value') {
        handlers.onStatValue(
          target.dataset.statKey,
          Number(target.dataset.statValue),
        );
      }
      if (target.dataset.action === 'clear-stat-value') {
        handlers.onClearStat(target.dataset.statKey);
      }
    });
    modal.addEventListener('input', (event) => {
      if (event.target.id === 'editNameEnglish') {
        handlers.onNameInput(event.target.value);
      }
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
    const sorted = [...countries].sort((left, right) => (
      getCountryName(left).localeCompare(getCountryName(right))
    ));
    const countryOptions = sorted.map((country) => `
      <option value="${escapeHtml(country.id_hex || '')}">
        ${escapeHtml(getCountryName(country))}
      </option>
    `).join('');
    select.innerHTML = `<option value="all">All countries</option>${countryOptions}`;
    select.value = String(selectedCountry);
  }

  function renderTable(characters, helpers, sortCriteria) {
    const characterLabel = characters.length === 1 ? 'character' : 'characters';
    document.getElementById('characterCount').textContent = (
      `${characters.length} ${characterLabel}`
    );
    chartInstances.forEach((chart) => chart.destroy());
    chartInstances.clear();
    if (!characters.length) {
      tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">No characters match the current search.</td>
        </tr>
      `;
      updateSortIndicators(sortCriteria);
      return;
    }
    tableBody.innerHTML = characters.map((character) => {
      const stats = helpers.getStats(character);

      return `
        <tr data-character-id="${escapeHtml(String(character.id_hex || ''))}" tabindex="0">
          <td class="portrait-cell">
            <img
              src="${portraitUrl(character.portrait)}"
              alt="${escapeHtml(helpers.getName(character))} portrait"
              data-portrait="true"
              loading="lazy"
            />
          </td>
          <td class="character-id">
            ${escapeHtml(String(character.id_hex || '—'))}
          </td>
          <td class="name-cell">
            <span class="name-primary">${escapeHtml(helpers.getName(character))}</span>
            <span class="name-secondary">
              ${escapeHtml(helpers.getJapaneseName(character))}
            </span>
          </td>
          <td class="country-name">
            ${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}
          </td>
          <td class="profile-chart-cell">
            <div class="profile-chart-wrap">
              <canvas
                data-character-chart-id="${escapeHtml(String(character.id_hex || ''))}"
                aria-label="${escapeHtml(helpers.getName(character))} profile"
              ></canvas>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    tableBody.querySelectorAll('img[data-portrait]').forEach(attachPortraitFallback);
    tableBody.querySelectorAll('canvas[data-character-chart-id]').forEach((canvas) => {
      const characterId = canvas.dataset.characterChartId;
      const character = characters.find((entry) => String(entry.id_hex) === String(characterId));
      if (!character) return;
      renderRadialChart(canvas, character, helpers.getStats(character));
    });
    updateSortIndicators(sortCriteria);
  }

  function updateSortIndicators(sortCriteria) {
    document.querySelectorAll('.sort-button').forEach((button) => {
      const indicator = button.querySelector('.sort-indicator');
      if (!indicator) return;
      const index = sortCriteria.findIndex(
        (criterion) => criterion.field === button.dataset.sort,
      );
      const criterion = sortCriteria[index];
      const label = button.firstChild.textContent.trim();
      if (!criterion) {
        indicator.textContent = '';
        button.setAttribute(
          'aria-label',
          `Sort by ${label}, currently not sorted. Click to sort ascending.`,
        );
        return;
      }
      const direction = criterion.direction === 'asc' ? 'ascending' : 'descending';
      indicator.textContent = `${index + 1}${criterion.direction === 'asc' ? '▲' : '▼'}`;
      button.setAttribute(
        'aria-label',
        `Sort by ${label}, ${direction}, priority ${index + 1}. Click to cycle sort state.`,
      );
    });
  }

  function showPreview(character, helpers) {
    const preview = document.getElementById('previewCard');
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const name = helpers.getName(character);
      const japaneseSkill = character.special_skill?.name_japanese
        ? `
            <span class="detail-special-skill-japanese">
              ${escapeHtml(character.special_skill.name_japanese)}
            </span>
          `
        : '';
      const statRows = ATTRIBUTE_KEYS.map((key) => (
        renderStatRow(key, helpers.getStats(character)[key])
      )).join('');

      preview.innerHTML = `
        <div class="detail-header">
          <img
            class="detail-portrait"
            src="${portraitUrl(character.portrait)}"
            alt="${escapeHtml(name)}"
          />
          <div class="detail-title-wrap">
            <h2 class="detail-title">${escapeHtml(name)}</h2>
            <div class="detail-subtitle">
              ${escapeHtml(helpers.getJapaneseName(character))}
            </div>
            <div class="detail-meta">
              <span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span>
              <span>•</span>
              <span>
                ${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-special-skill">
          <span class="detail-special-skill-label">SS:</span>
          <span class="detail-special-skill-name">
            ${escapeHtml(character.special_skill?.name_english || '—')}
          </span>
          ${japaneseSkill}
        </div>

        <div class="detail-stats">${statRows}</div>
      `;
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
    const invalid = ATTRIBUTE_KEYS.filter(
      (key) => !isValidStatValue(originalStats[key]),
    );
    if (invalid.length) {
      const invalidLabels = invalid.map(capitalizeLabel).join(', ');
      helpers.notify(
        `Stored value(s) for ${invalidLabels} are invalid and need correction before saving.`,
        'warning',
      );
    }
    const title = helpers.getName(character);
    const statRows = ATTRIBUTE_KEYS.map((key) => (
      renderStatRow(key, stats[key], true)
    )).join('');

    content.innerHTML = `
      <div class="detail-header">
        <img
          class="detail-portrait"
          src="${portraitUrl(character.portrait)}"
          alt="${escapeHtml(title)}"
        />
        <div class="detail-title-wrap">
          <h2 id="detailTitle" class="detail-title">${escapeHtml(title)}</h2>
          <div class="detail-subtitle">
            ${escapeHtml(helpers.getJapaneseName(character))}
          </div>
          <div class="detail-meta">
            <span>ID: ${escapeHtml(String(character.id_hex || '—'))}</span>
            <span>•</span>
            <span>
              ${escapeHtml(helpers.getCountryNameById(character.country_id_hex))}
            </span>
          </div>
        </div>
      </div>

      <div class="field-group">
        <label for="editNameEnglish">English Name</label>
        <input
          id="editNameEnglish"
          type="text"
          value="${escapeHtml(name)}"
          autocomplete="off"
        />
      </div>

      <div class="detail-stats detail-stats-edit">${statRows}</div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel-edit">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" data-action="save-edit">
          Save
        </button>
      </div>
    `;
    attachPortraitFallback(content.querySelector('.detail-portrait'));
  }

  return {
    bind,
    renderCountries,
    renderTable,
    showPreview,
    hidePreview,
    openEditor,
    closeEditor,
    renderEditor,
  };
}
