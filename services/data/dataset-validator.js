export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateDataset(dataset, { requireCharacters = false, strictRecords = false } = {}) {
  if (!isPlainObject(dataset) || !Array.isArray(dataset.countries) || !Array.isArray(dataset.characters)) {
    throw new Error('Dataset is invalid: expected countries and characters arrays.');
  }

  if (requireCharacters && dataset.characters.length === 0) {
    throw new Error('Dataset is empty: no characters are available to sync.');
  }

  if (strictRecords && (!dataset.countries.every(isPlainObject) || !dataset.characters.every(isPlainObject))) {
    throw new Error('Dataset is invalid: country and character records must be objects.');
  }

  return dataset;
}
