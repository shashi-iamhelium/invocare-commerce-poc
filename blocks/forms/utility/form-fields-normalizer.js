const FIELDSET_TYPES = new Set(['fieldset', 'panel']);
const OPTION_TYPES = new Set(['radio', 'radio-group', 'checkbox', 'checkbox-group', 'checkboxes']);
const SELECT_TYPES = new Set(['select', 'dropdown', 'drop-down']);
const TEXTAREA_TYPES = new Set(['textarea', 'text-area', 'multiline', 'multiline-input']);
const BUTTON_TYPES = new Set(['button', 'submit', 'reset']);
const INPUT_TYPES = new Set([
  'color',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'month',
  'number',
  'password',
  'range',
  'tel',
  'text',
  'time',
  'url',
  'week',
]);

export function normalizeName(value = '') {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function getValue(row, key, fallback = '') {
  const value = row[normalizeName(key)];
  return value === undefined || value === null ? fallback : value;
}

function toBoolean(value, fallback = false) {
  if (value === true || value === false) return value;

  const normalized = normalizeName(value);
  if (!normalized) return fallback;

  return ['true', 'x', 'yes', 'y', '1'].includes(normalized);
}

function splitList(value = '') {
  if (Array.isArray(value)) return value.flatMap(splitList);

  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeClassList(value = '') {
  return [...new Set(splitList(value).map(normalizeName).filter(Boolean))].join(' ');
}

function mergeClassNames(...classNames) {
  return [...new Set(classNames
    .flatMap((className) => String(className || '').split(/\s+/))
    .flatMap(splitList)
    .map(normalizeName)
    .filter(Boolean))].join(' ');
}

function normalizeRawRow(rawRow = {}) {
  return Object.entries(rawRow).reduce((row, [key, value]) => {
    row[normalizeName(key)] = typeof value === 'string' ? value.trim() : value;
    return row;
  }, {});
}

function hasRowContent(row) {
  return row && Object.values(row).some((value) => String(value || '').trim());
}

function getSheetName(sourceUrl = '') {
  try {
    return normalizeName(new URL(sourceUrl, window.location.href).searchParams.get('sheet'));
  } catch (error) {
    return '';
  }
}

function getFormId(sourceUrl = '') {
  try {
    const url = new URL(sourceUrl, window.location.href);
    const baseName = url.pathname.split('/').pop()?.replace(/\.json$/, '') || 'da-form';
    const sheetName = getSheetName(sourceUrl);

    return normalizeName(sheetName ? `${baseName}-${sheetName}` : baseName);
  } catch (error) {
    return normalizeName(sourceUrl.split('/').pop()?.replace(/\.json.*$/, '') || 'da-form');
  }
}

function getSheetNames(json) {
  return Array.isArray(json?.[':names'])
    ? json[':names']
    : Object.keys(json || {}).filter((key) => Array.isArray(json[key]?.data));
}

function getSheetRows(json, sheetName) {
  if (Array.isArray(json?.data)) return json.data.filter(hasRowContent);

  return (json?.[sheetName]?.data || []).filter(hasRowContent);
}

function getSelectedSheetName(json, sourceUrl = '') {
  if (Array.isArray(json?.data)) return '';

  const sheetNames = getSheetNames(json);

  const requestedSheetName = getSheetName(sourceUrl);
  return sheetNames.find((sheetName) => (
    normalizeName(sheetName) === requestedSheetName
  ))
    || sheetNames.find((sheetName) => getSheetRows(json, sheetName).length);
}

function getJsonRows(json, sourceUrl = '') {
  if (Array.isArray(json?.data)) return getSheetRows(json);

  return getSheetRows(json, getSelectedSheetName(json, sourceUrl));
}

function getSheetFieldsetName(rows = []) {
  const fieldsetRow = rows
    .map(normalizeRawRow)
    .find((row) => getRenderType(getValue(row, 'type')) === 'panel');

  return fieldsetRow ? normalizeName(getValue(fieldsetRow, 'name')) : '';
}

function getSheetMeta(json, sourceUrl = '') {
  if (Array.isArray(json?.data)) return [];

  const selectedSheetName = normalizeName(getSelectedSheetName(json, sourceUrl));

  return getSheetNames(json).map((sheetName) => {
    const rows = getSheetRows(json, sheetName);
    const name = normalizeName(sheetName);
    const fieldsetName = getSheetFieldsetName(rows);

    return {
      name,
      fieldsetName,
      isActive: name === selectedSheetName,
      isRenderable: rows.length > 0 && name === fieldsetName,
    };
  });
}

function getRenderType(type = '') {
  const normalizedType = normalizeName(type || 'text');

  if (normalizedType === 'hr' || normalizedType === 'separator') return 'separator';
  if (FIELDSET_TYPES.has(normalizedType)) return 'panel';
  if (SELECT_TYPES.has(normalizedType)) return 'drop-down';
  if (TEXTAREA_TYPES.has(normalizedType)) return 'textarea';
  if (normalizedType === 'radio' || normalizedType === 'radio-group') return 'radio-group';
  if (['checkbox', 'checkbox-group', 'checkboxes'].includes(normalizedType)) return 'checkbox-group';
  if (BUTTON_TYPES.has(normalizedType)) return normalizedType;
  if (INPUT_TYPES.has(normalizedType)) return normalizedType;

  return 'text';
}

function normalizeColumnSpan(value) {
  const span = Number(value) || 12;
  return Math.min(Math.max(span, 1), 12);
}

function normalizeOptionValue(value, label) {
  return normalizeName(value || label);
}

function isSeparatorField(name, type) {
  return type === 'separator' || /(^|-)hr($|-)/.test(name);
}

function getIndexedBoolean(values, index, fallback = false) {
  return values[index] !== undefined ? toBoolean(values[index]) : fallback;
}

function createOption(row) {
  const label = getValue(row, 'label') || getValue(row, 'value');
  const value = normalizeOptionValue(getValue(row, 'value'), label);

  return {
    label,
    value,
    checked: toBoolean(getValue(row, 'checked')),
    readOnly: toBoolean(getValue(row, 'read-only')),
  };
}

function createOptions(row) {
  const values = splitList(getValue(row, 'options'));
  const labels = splitList(getValue(row, 'option-names'));
  const checkedValues = splitList(getValue(row, 'checked'));
  const readOnlyValues = splitList(getValue(row, 'read-only'));
  const selectedValue = getValue(row, 'value');
  const isRowReadOnly = toBoolean(getValue(row, 'read-only'));
  const optionCount = Math.max(values.length, labels.length);

  if (!optionCount) return [createOption(row)].filter((option) => option.label || option.value);

  return Array.from({ length: optionCount }, (_, index) => {
    const label = labels[index] || values[index];
    const value = normalizeOptionValue(values[index], label);

    return {
      label,
      value,
      checked: getIndexedBoolean(checkedValues, index, value === normalizeName(selectedValue)),
      readOnly: getIndexedBoolean(readOnlyValues, index, isRowReadOnly),
    };
  });
}

function createField(rawRow, index) {
  const row = normalizeRawRow(rawRow);
  const sourceType = normalizeName(getValue(row, 'type', 'text'));
  const label = getValue(row, 'label');
  const name = normalizeName(getValue(row, 'name') || label || `field-${index + 1}`);
  const type = isSeparatorField(name, getRenderType(sourceType))
    ? 'separator'
    : getRenderType(sourceType);

  return {
    name,
    type,
    sourceType,
    label,
    className: normalizeClassList(getValue(row, 'class')),
    placeholder: getValue(row, 'placeholder'),
    description: getValue(row, 'description') || getValue(row, 'sub-label'),
    helpText: getValue(row, 'help-text'),
    constraintMessage: getValue(row, 'constraint-message'),
    errorMessage: getValue(row, 'error-message'),
    value: getValue(row, 'value'),
    fieldset: normalizeName(getValue(row, 'fieldset')),
    required: toBoolean(getValue(row, 'required')),
    visible: getValue(row, 'visible') === '' ? true : toBoolean(getValue(row, 'visible'), true),
    repeatable: toBoolean(getValue(row, 'repeatable')),
    readOnly: toBoolean(getValue(row, 'read-only')),
    min: getValue(row, 'min'),
    max: getValue(row, 'max'),
    maxLength: getValue(row, 'maxlength') || getValue(row, 'max-length'),
    step: getValue(row, 'step'),
    rows: getValue(row, 'rows'),
    valueExpression: getValue(row, 'value-expression'),
    visibleExpression: getValue(row, 'visible-expression'),
    columnSpan: normalizeColumnSpan(getValue(row, 'column-span')),
    options: OPTION_TYPES.has(sourceType) || type === 'drop-down' ? createOptions(row) : [],
    fields: [],
    rowIndex: index,
  };
}

function getOptionGroupKey(field) {
  return ['radio-group', 'checkbox-group'].includes(field.type)
    ? `${field.fieldset || 'root'}:${field.name}:${field.type}`
    : '';
}

function groupOptions(fields) {
  const groups = new Map();
  const groupedFields = [];

  fields.forEach((field) => {
    const groupKey = getOptionGroupKey(field);

    if (!groupKey) {
      groupedFields.push(field);
      return;
    }

    if (!groups.has(groupKey)) {
      const group = {
        ...field,
        label: field.fieldset ? '' : field.label,
        readOnly: false,
        options: [],
      };
      groups.set(groupKey, group);
      groupedFields.push(group);
    }

    const group = groups.get(groupKey);
    group.className = mergeClassNames(group.className, field.className);
    group.options.push(...field.options);
  });

  return groupedFields;
}

function attachHiddenButtons(fields) {
  const buttons = fields.filter((field) => field.type === 'button' && !field.visible);
  const visibleFields = fields.filter((field) => !(field.type === 'button' && !field.visible));

  buttons.forEach((button) => {
    const target = visibleFields.find((field) => button.name.startsWith(field.name));
    if (target) {
      target.changeLabel = button.label || 'Change selection';
    }
  });

  return visibleFields;
}

function nestPanels(fields) {
  const panels = new Map();
  const topLevel = [];

  fields.forEach((field) => {
    if (field.type === 'panel') {
      panels.set(field.name, field);
      topLevel.push(field);
    }
  });

  fields.forEach((field) => {
    if (field.type === 'panel') return;

    const panel = panels.get(field.fieldset);
    if (panel) {
      field.changeLabel = field.changeLabel || panel.changeLabel;
      panel.fields.push(field);
    } else {
      topLevel.push(field);
    }
  });

  return topLevel;
}

export default function normalizeForm(json, sourceUrl = '') {
  const sheets = getSheetMeta(json, sourceUrl);
  const fields = nestPanels(attachHiddenButtons(groupOptions(
    getJsonRows(json, sourceUrl).map(createField),
  )));
  const activeSheet = sheets.find((sheet) => sheet.isActive)?.name
    || fields.find((field) => field.type === 'panel')?.name
    || getFormId(sourceUrl);

  return {
    id: getFormId(sourceUrl),
    activeSheet,
    fields,
    dependentSheets: sheets
      .filter((sheet) => sheet.isRenderable && !sheet.isActive)
      .map((sheet) => sheet.name),
    sourceUrl,
  };
}
