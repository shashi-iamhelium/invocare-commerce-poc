const COMPONENT_KEYS = new Set([
  'form-text-field',
  'form-options',
  'form-button',
  'form-hidden',
  'information',
  'postcode',
]);

const VALIDATION_TYPES = new Set([
  'none',
  'varchar',
  'only-alphabets',
  'only-numbers',
  'email',
  'phone',
  'au-mobile',
  'nz-mobile',
  'custom',
]);

const OPTIONS_LAYOUTS = new Set(['horizontal', 'vertical']);
const COMPONENT_LAYOUTS = new Set(['defaultLayout', 'twoColumn']);
const OPTION_FIELD_META_VALUES = new Set(['drop-down', 'checkboxes', 'options']);
const RICH_TEXT_CONFIG_KEYS = new Set([
  'successMessage',
  'errorMessage',
  'assistanceMessage',
  'warningMessage',
]);
const FORM_CONFIG_KEYS = new Set([
  'block-name',
  'classes',
  'formsTheme',
  'layout',
  'title',
  'hideTitle',
  'fromsHidetitle',
  'mail-subject',
  'mail-from',
  'mail-to',
  'mail-cc',
  'mail-bcc',
  'mail-template-path',
  'forms-endpoint',
  'action-type-yamaha-mail-subject',
  'action-type-yamaha-mail-from',
  'action-type-yamaha-mail-to',
  'action-type-yamaha-mail-cc',
  'action-type-yamaha-mail-bcc',
  'action-type-yamaha-mail-template-path',
  'form-id',
  'image',
  'imageAlt',
  'successMessage',
  'thankYouButtonLabel',
  'submittingButtonLabel',
  'successButtonLabel',
  'errorMessage',
  'assistanceMessage',
  'errorButtonLabel',
  'warningMessage',
]);
const LIST_CONFIG_KEYS = new Set([
  'mail-to',
  'mail-cc',
  'mail-bcc',
  'action-type-yamaha-mail-to',
  'action-type-yamaha-mail-cc',
  'action-type-yamaha-mail-bcc',
]);

const CONFIG_ALIASES = {
  fromsHidetitle: 'hideTitle',
  'action-type-yamaha-mail-subject': 'mail-subject',
  'action-type-yamaha-mail-from': 'mail-from',
  'action-type-yamaha-mail-to': 'mail-to',
  'action-type-yamaha-mail-cc': 'mail-cc',
  'action-type-yamaha-mail-bcc': 'mail-bcc',
  'action-type-yamaha-mail-template-path': 'mail-template-path',
};

function getText(el) {
  return el?.textContent?.replace(/\u00a0/g, ' ')?.trim() || '';
}

function getHTML(el) {
  return el?.innerHTML?.trim() || '';
}

function isHrMarkup(html) {
  return /^<hr\b/i.test((html || '').trim());
}

function hasRichMarkup(html) {
  return /<(a|strong|em|b|i|br|ul|ol|li|img|h[1-6]|table|blockquote)\b/i.test(html || '');
}

function isSimpleTextMarkup(html) {
  if (!html || typeof document === 'undefined') {
    return false;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const elements = Array.from(container.querySelectorAll('*'));
  if (!elements.length) {
    return true;
  }

  return elements.every((element) => ['DIV', 'P'].includes(element.tagName));
}

function isPlainParagraphMarkup(html) {
  const normalized = (html || '').replace(/\s+/g, ' ').trim();
  return /^<p>[^<]*<\/p>$/.test(normalized);
}

function getCellRichValue(el) {
  const html = getHTML(el);

  if (!html || isHrMarkup(html)) {
    return '';
  }

  return html;
}

function getCellValue(el) {
  const html = getHTML(el);

  if (!html || isHrMarkup(html)) {
    return '';
  }

  if (!hasRichMarkup(html) && (isPlainParagraphMarkup(html) || isSimpleTextMarkup(html))) {
    return getText(el);
  }

  if (hasRichMarkup(html)) {
    return html;
  }

  return html;
}

function extractListItemsFromCell(el) {
  if (!el || typeof document === 'undefined') {
    return [];
  }

  const listItems = Array.from(el.querySelectorAll('li'))
    .map((item) => item.textContent?.replace(/\u00a0/g, ' ')?.trim())
    .filter(Boolean);

  if (listItems.length) {
    return listItems;
  }

  const leafValues = Array.from(el.querySelectorAll('*'))
    .filter((node) => node.children.length === 0)
    .map((node) => node.textContent?.replace(/\u00a0/g, ' ')?.trim())
    .filter((value) => value && value !== '[object Object]');

  return [...new Set(leafValues)];
}

function normalizeScalarConfigValue(value) {
  if (value === '[object Object]') {
    return '';
  }

  return value;
}

function getConfigCellValue(key, cell) {
  if (LIST_CONFIG_KEYS.has(key)) {
    const listItems = extractListItemsFromCell(cell);

    if (listItems.length) {
      return listItems;
    }
  }

  const value = RICH_TEXT_CONFIG_KEYS.has(key)
    ? (getCellRichValue(cell) || getCellValue(cell))
    : getCellValue(cell);

  return normalizeScalarConfigValue(value);
}

function createToken(cell, rowIndex, cellIndex) {
  const text = getText(cell);
  const html = getHTML(cell);
  const value = getCellValue(cell);

  return {
    rowIndex,
    cellIndex,
    text,
    html,
    value,
  };
}

function getTokenText(token) {
  return token?.text || '';
}

function getTokenValue(token) {
  return token?.value || token?.text || '';
}

function isComponentToken(token) {
  return COMPONENT_KEYS.has(getTokenText(token));
}

function isBooleanToken(token) {
  const value = getTokenText(token).toLowerCase();
  return value === 'true' || value === 'false';
}

function toBoolean(token) {
  return getTokenText(token).toLowerCase() === 'true';
}

function isNumericToken(token) {
  const value = getTokenText(token);
  return /^\d+$/.test(value);
}

function isEmptyToken(token) {
  return !getTokenText(token) && !getTokenValue(token);
}

function stripHTML(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasRenderableText(value) {
  const normalized = stripHTML(String(value || ''));
  return normalized !== '' && normalized !== 'true' && normalized !== 'false';
}

function looksLikeValidationMessage(value) {
  return /please\b|valid\b|required\b|select\b|fill\b|enter\b/.test(stripHTML(value).toLowerCase());
}

function isTextToken(token) {
  return !isEmptyToken(token)
    && !isBooleanToken(token)
    && !VALIDATION_TYPES.has(getTokenText(token));
}

function isHelpMessageToken(token) {
  const text = getTokenText(token).toLowerCase();
  return isTextToken(token)
    && !OPTIONS_LAYOUTS.has(text)
    && !OPTION_FIELD_META_VALUES.has(text);
}

function findHelpMessageToken(tokens) {
  const candidates = tokens.filter((token) => isHelpMessageToken(token));
  return candidates[candidates.length - 1];
}

function getNodeText(node) {
  return node?.textContent?.replace(/\u00a0/g, ' ')?.trim() || '';
}

function getNodeValue(node) {
  const html = node?.innerHTML?.trim() || '';

  if (!html || /^<hr\b/i.test(html)) {
    return '';
  }

  if (!hasRichMarkup(html) && (isPlainParagraphMarkup(html) || isSimpleTextMarkup(html))) {
    return getNodeText(node);
  }

  if (hasRichMarkup(html)) {
    return html;
  }

  return html;
}

function extractOptionGroupsFromHtml(html) {
  if (!html || !/<hr\b/i.test(html) || typeof document === 'undefined') {
    return [];
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const groups = [];
  let current = [];

  Array.from(container.children).forEach((child) => {
    if (child.tagName === 'HR') {
      if (current.length) {
        groups.push(current);
      }
      current = [];
      return;
    }

    const value = getNodeValue(child);
    const text = getNodeText(child);

    if (value || text) {
      current.push({
        text,
        value: value || text,
      });
    }
  });

  if (current.length) {
    groups.push(current);
  }

  return groups;
}

function createOptionEntry(group) {
  if (group.length < 4) {
    return null;
  }

  const [selectedToken, disabledToken, labelToken, valueToken] = group;
  const selected = String(selectedToken.text || selectedToken.value).toLowerCase() === 'true';
  const disabled = String(disabledToken.text || disabledToken.value).toLowerCase() === 'true';

  return {
    selected,
    disabled,
    label: labelToken.value || labelToken.text || '',
    value: valueToken.text || valueToken.value || '',
  };
}

function parseOptionGroups(groups) {
  return groups.map(createOptionEntry).filter(Boolean);
}

function getRowTokens(row, rowIndex) {
  return Array
    .from(row.children || [])
    .map((cell, cellIndex) => createToken(cell, rowIndex, cellIndex));
}

function isConfigRow(tokens) {
  return tokens.length >= 2 && FORM_CONFIG_KEYS.has(getTokenText(tokens[0]));
}

function flattenConfigCells(rows) {
  return rows.flatMap((row) => Array.from(row.children || [])
    .filter((cell) => cell?.tagName === 'DIV')
    .map((cell) => ({
      cell,
      text: getText(cell),
    })));
}

function mergeConfigValues(key, cells = []) {
  const values = cells
    .map((cell) => getConfigCellValue(key, cell))
    .filter((value) => value !== '' && value !== null && value !== undefined);

  if (!values.length) {
    return '';
  }

  if (LIST_CONFIG_KEYS.has(key)) {
    return values.flatMap((value) => (Array.isArray(value) ? value : [value])).filter(Boolean);
  }

  if (RICH_TEXT_CONFIG_KEYS.has(key)) {
    return values.join('');
  }

  return values[0];
}

function parseConfig(rows) {
  const config = {};
  const cells = flattenConfigCells(rows);
  let index = 0;

  while (index < cells.length) {
    const key = cells[index]?.text;

    if (!key || COMPONENT_KEYS.has(key) || !FORM_CONFIG_KEYS.has(key)) {
      index += 1;
    } else {
      const valueCells = [];
      let cursor = index + 1;

      while (cursor < cells.length) {
        const nextKey = cells[cursor]?.text;

        if (FORM_CONFIG_KEYS.has(nextKey) || COMPONENT_KEYS.has(nextKey)) {
          break;
        }

        valueCells.push(cells[cursor].cell);
        cursor += 1;
      }

      config[key] = mergeConfigValues(key, valueCells);
      index = cursor;
    }
  }

  return config;
}

function normalizeConfig(config) {
  Object.entries(CONFIG_ALIASES).forEach(([legacyKey, genericKey]) => {
    if (
      config[genericKey] === undefined
      && config[legacyKey] !== undefined
    ) {
      config[genericKey] = config[legacyKey];
    }
  });

  return config;
}

function getTokenAt(tokens, index) {
  return tokens[index] || null;
}

function getBooleanAt(tokens, index) {
  const token = getTokenAt(tokens, index);
  return isBooleanToken(token) ? toBoolean(token) : false;
}

function createTextField(inputType) {
  return {
    type: 'field',
    component: 'form-text-field',
    fieldType: inputType,
    inputType,
    label: '',
    hideLabel: false,
    name: '',
    value: '',
    validation: 'none',
    helpMessage: '',
    helpMessageBelow: '',
    displayHelpMessageAsPlaceholder: false,
    placeholder: '',
    required: false,
    readOnly: false,
    errors: {
      required: '',
      pattern: '',
    },
  };
}

function deriveFieldName(label = '') {
  const plainLabel = stripHTML(label).trim();

  if (!plainLabel) {
    return '';
  }

  const words = plainLabel
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return '';
  }

  return words
    .map((word, index) => (index === 0
      ? word.charAt(0).toLowerCase() + word.slice(1)
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

function isInvalidFieldName(name = '') {
  const normalizedName = name.toLowerCase();

  return !name
    || /^\d+$/.test(name)
    || (VALIDATION_TYPES.has(name) && !['phone', 'email'].includes(normalizedName))
    || COMPONENT_KEYS.has(name)
    || COMPONENT_LAYOUTS.has(name)
    || OPTIONS_LAYOUTS.has(name)
    || OPTION_FIELD_META_VALUES.has(name)
    || ['true', 'false'].includes(normalizedName);
}

function finalizeTextField(field) {
  if (isInvalidFieldName(field.name)) {
    field.name = deriveFieldName(field.label);
  }

  if (field.displayHelpMessageAsPlaceholder && field.helpMessage) {
    field.placeholder = field.helpMessage;
  }

  if (field.inputType === 'tel' && field.validation === 'none') {
    const phoneHint = `${field.placeholder} ${field.helpMessage}`.trim();
    if (phoneHint.startsWith('+64')) {
      field.validation = 'nz-mobile';
    } else if (phoneHint.startsWith('+61')) {
      field.validation = 'au-mobile';
    } else {
      field.validation = 'phone';
    }
  }

  if (field.inputType === 'number' && field.validation === 'none') {
    field.validation = 'only-numbers';
  }

  if (field.readOnly) {
    field.required = false;
    field.errors.required = '';
  }

  return field;
}

function isComponentSlotTextField(tokens) {
  return tokens.length >= 16
    && isBooleanToken(tokens[4])
    && VALIDATION_TYPES.has(getTokenText(tokens[8]));
}

function parseTextFieldComponentSlots(tokens) {
  const inputType = getTokenText(tokens[1]) || 'text';
  const field = createTextField(inputType);

  const textLinesToken = getTokenAt(tokens, 2);
  const labelToken = getTokenAt(tokens, 3);
  const nameToken = getTokenAt(tokens, 5);
  const valueToken = getTokenAt(tokens, 6);
  const maxLengthToken = getTokenAt(tokens, 7);
  const validationToken = getTokenAt(tokens, 8);
  const helpMessageToken = getTokenAt(tokens, 9);
  const helpMessageBelowToken = getTokenAt(tokens, 11);
  const patternErrorToken = getTokenAt(tokens, 12);
  const requiredMessageToken = getTokenAt(tokens, 14);

  if (inputType === 'textarea' && isNumericToken(textLinesToken)) {
    field.rows = Number(getTokenText(textLinesToken));
  }

  field.label = getTokenValue(labelToken);
  field.hideLabel = getBooleanAt(tokens, 4);
  field.name = getTokenText(nameToken) || '';
  field.value = getTokenValue(valueToken);
  field.helpMessage = getTokenValue(helpMessageToken);
  field.displayHelpMessageAsPlaceholder = getBooleanAt(tokens, 10);
  field.helpMessageBelow = getTokenValue(helpMessageBelowToken);
  field.required = getBooleanAt(tokens, 13);
  field.readOnly = getBooleanAt(tokens, 15);

  if (inputType === 'textarea' && isNumericToken(maxLengthToken)) {
    field.maxLength = Number(getTokenText(maxLengthToken));
  }

  if (VALIDATION_TYPES.has(getTokenText(validationToken))) {
    field.validation = getTokenText(validationToken);
  } else if (inputType === 'email') {
    field.validation = 'email';
  }

  if (looksLikeValidationMessage(getTokenValue(patternErrorToken))) {
    field.errors.pattern = getTokenValue(patternErrorToken);
  }

  if (field.required && !isEmptyToken(requiredMessageToken)) {
    field.errors.required = getTokenValue(requiredMessageToken);
  }

  return finalizeTextField(field);
}

function parseTextFieldLegacy(tokens) {
  const inputType = getTokenText(tokens[1]) || 'text';
  const field = createTextField(inputType);

  let cursor = 2;

  if (isNumericToken(tokens[cursor])) {
    if (inputType === 'textarea') {
      field.rows = Number(getTokenText(tokens[cursor]));
    }
    cursor += 1;
  }

  field.label = getTokenValue(tokens[cursor]);
  cursor += 1;

  if (isBooleanToken(tokens[cursor])) {
    field.hideLabel = toBoolean(tokens[cursor]);
    cursor += 1;
  }

  const nameToken = tokens[cursor];
  field.name = getTokenText(nameToken) || '';
  cursor += 1;

  let remaining = tokens.slice(cursor).filter((token) => !isEmptyToken(token));

  if (isInvalidFieldName(field.name) && !isEmptyToken(nameToken)) {
    remaining = [nameToken, ...remaining];
    field.name = '';
  }

  if (remaining.length && isBooleanToken(remaining[remaining.length - 1])) {
    field.readOnly = toBoolean(remaining[remaining.length - 1]);
    remaining = remaining.slice(0, -1);
  }

  if (
    remaining.length >= 2
    && isBooleanToken(remaining[remaining.length - 2])
    && !isBooleanToken(remaining[remaining.length - 1])
  ) {
    field.required = toBoolean(remaining[remaining.length - 2]);
    field.errors.required = getTokenValue(remaining[remaining.length - 1]);
    remaining = remaining.slice(0, -2);
  } else if (remaining.length && isBooleanToken(remaining[remaining.length - 1])) {
    field.required = toBoolean(remaining[remaining.length - 1]);
    remaining = remaining.slice(0, -1);
  }

  const validationIndex = remaining.findIndex((token) => VALIDATION_TYPES.has(getTokenText(token)));
  if (validationIndex !== -1) {
    field.validation = getTokenText(remaining[validationIndex]);
    remaining.splice(validationIndex, 1);
  } else if (inputType === 'email' && field.validation === 'none') {
    field.validation = 'email';
  }

  if (inputType === 'textarea') {
    const maxLengthIndex = remaining.findIndex((token) => isNumericToken(token));
    if (maxLengthIndex !== -1) {
      field.maxLength = Number(getTokenText(remaining[maxLengthIndex]));
      remaining.splice(maxLengthIndex, 1);
    }
  } else {
    const leakedTextareaMaxIndex = remaining
      .findIndex((token, index) => isNumericToken(token) && index === 0);
    if (leakedTextareaMaxIndex !== -1) {
      remaining.splice(leakedTextareaMaxIndex, 1);
    }
  }

  if (
    remaining.length
    && isTextToken(remaining[remaining.length - 1])
    && looksLikeValidationMessage(getTokenValue(remaining[remaining.length - 1]))
  ) {
    field.errors.pattern = getTokenValue(remaining[remaining.length - 1]);
    remaining = remaining.slice(0, -1);
  }

  const placeholderToggleIndex = remaining.findIndex((token) => isBooleanToken(token));
  if (placeholderToggleIndex !== -1) {
    field.displayHelpMessageAsPlaceholder = toBoolean(remaining[placeholderToggleIndex]);

    const beforeToggle = remaining.slice(0, placeholderToggleIndex);
    const afterToggle = remaining.slice(placeholderToggleIndex + 1);

    if (beforeToggle.length) {
      field.helpMessage = getTokenValue(beforeToggle[beforeToggle.length - 1]);
    }

    if (beforeToggle.length > 1) {
      field.value = getTokenValue(beforeToggle[0]);
    }

    if (afterToggle.length) {
      field.helpMessageBelow = afterToggle.filter(isTextToken).map(getTokenValue).join('');
    }
  } else if (remaining.length === 1) {
    const value = getTokenValue(remaining[0]);

    if (
      field.validation !== 'none'
      && (
        looksLikeValidationMessage(value)
        || ['email', 'tel', 'number'].includes(inputType)
      )
    ) {
      field.errors.pattern = value;
    } else if (field.inputType !== 'textarea' && !field.displayHelpMessageAsPlaceholder && !/\s|</.test(value)) {
      field.value = value;
    } else {
      field.helpMessageBelow = value;
    }
  } else if (remaining.length > 1) {
    field.value = getTokenValue(remaining[0]);
    field.helpMessageBelow = remaining.slice(1).filter(isTextToken).map(getTokenValue).join('');
  }

  return finalizeTextField(field);
}

function parseTextField(tokens) {
  return isComponentSlotTextField(tokens)
    ? parseTextFieldComponentSlots(tokens)
    : parseTextFieldLegacy(tokens);
}

function createOptionsField(optionType) {
  return {
    type: 'field',
    component: 'form-options',
    fieldType: optionType === 'checkboxes' ? 'checkbox' : 'dropdown',
    optionType,
    layout: 'horizontal',
    isBooleanValue: false,
    label: '',
    hideLabel: false,
    name: '',
    required: false,
    helpMessage: '',
    options: [],
    errors: {
      required: '',
    },
  };
}

function isStructuredOptionsToken(token) {
  return extractOptionGroupsFromHtml(token?.html).length > 0;
}

function isOptionValueToken(token) {
  const text = getTokenText(token);
  const value = getTokenValue(token);

  return (text || value)
    && !COMPONENT_KEYS.has(text)
    && !COMPONENT_LAYOUTS.has(text);
}

function isOptionSeparatorToken(token) {
  return isEmptyToken(token);
}

function isOptionTupleStart(tokens, index) {
  return index + 3 < tokens.length
    && (index === 0 || isOptionSeparatorToken(tokens[index - 1]))
    && isBooleanToken(tokens[index])
    && isBooleanToken(tokens[index + 1])
    && hasRenderableText(getTokenValue(tokens[index + 2]))
    && isOptionValueToken(tokens[index + 3]);
}

function findOptionsStartIndex(tokens) {
  const structuredIndex = tokens.findIndex(isStructuredOptionsToken);
  const tupleIndex = tokens.findIndex((token, index) => isOptionTupleStart(tokens, index));

  if (structuredIndex === -1) {
    return tupleIndex;
  }

  if (tupleIndex === -1) {
    return structuredIndex;
  }

  return Math.min(structuredIndex, tupleIndex);
}

function extractFieldHelpMessage(tokens = []) {
  const helpMessage = getTokenValue(findHelpMessageToken(
    tokens.filter((token) => !isEmptyToken(token)),
  ));
  return looksLikeValidationMessage(helpMessage) ? '' : helpMessage;
}

function parseStructuredOptions(optionTokens = []) {
  const parsedOptions = optionTokens
    .filter(isStructuredOptionsToken)
    .map((token) => parseOptionGroups(extractOptionGroupsFromHtml(token.html)))
    .find((options) => options.length);

  return parsedOptions || [];
}

function parseTupleOptions(optionTokens = []) {
  const options = [];
  let lastTupleEnd = -1;

  for (let index = 0; index < optionTokens.length; index += 1) {
    if (isOptionTupleStart(optionTokens, index)) {
      options.push({
        selected: toBoolean(optionTokens[index]),
        disabled: toBoolean(optionTokens[index + 1]),
        label: getTokenValue(optionTokens[index + 2]),
        value: getTokenText(optionTokens[index + 3]) || getTokenValue(optionTokens[index + 3]),
      });

      lastTupleEnd = index + 4;
      index += 3;
    }
  }

  return {
    options,
    trailingTokens: lastTupleEnd === -1 ? optionTokens : optionTokens.slice(lastTupleEnd),
  };
}

function assignOptionsFromContainers(field, optionTokens = []) {
  const normalizedTokens = optionTokens.filter((token) => !isEmptyToken(token));
  const structuredOptions = parseStructuredOptions(normalizedTokens);

  if (structuredOptions.length) {
    field.options = structuredOptions;
    field.helpMessage = extractFieldHelpMessage(
      normalizedTokens.filter((token) => !isStructuredOptionsToken(token)),
    );
    return field;
  }

  const { options, trailingTokens } = parseTupleOptions(optionTokens);
  field.options = options;
  field.helpMessage = extractFieldHelpMessage(trailingTokens);
  return field;
}

function clearLeakedOptionHelp(field) {
  const normalizedHelp = stripHTML(field.helpMessage || '');

  if (!normalizedHelp) {
    return;
  }

  const matchesFieldMeta = normalizedHelp === stripHTML(field.label || '')
    || normalizedHelp === stripHTML(field.name || '')
    || normalizedHelp === stripHTML(field.errors.required || '');
  const matchesOption = field.options.some((option) => {
    const normalizedLabel = stripHTML(option.label || '');
    const normalizedValue = stripHTML(option.value || '');
    return normalizedLabel === normalizedHelp || normalizedValue === normalizedHelp;
  });

  if (matchesFieldMeta || matchesOption) {
    field.helpMessage = '';
  }
}

function normalizeParsedOptions(field) {
  const seenDropdownValues = new Set();
  const normalizedRequiredMessage = stripHTML(field.errors?.required || '');

  field.options = field.options.map((option, index) => {
    const label = option.label || '';
    const rawValue = stripHTML(option.value || '').trim();
    const normalizedLabel = stripHTML(label);
    let value = rawValue;

    if (!value && field.optionType === 'checkboxes') {
      value = field.isBooleanValue
        ? String(index === 0)
        : deriveFieldName(normalizedLabel) || field.name || `option-${index + 1}`;
    }

    return {
      selected: !!option.selected,
      disabled: !!option.disabled,
      label,
      value,
    };
  }).filter((option) => {
    const normalizedLabel = stripHTML(option.label || '');
    const normalizedValue = stripHTML(option.value || '');

    if (
      !normalizedLabel
      || (normalizedRequiredMessage && normalizedLabel === normalizedRequiredMessage)
    ) {
      return false;
    }

    if (field.optionType === 'drop-down') {
      if (!normalizedValue) {
        return false;
      }

      if (seenDropdownValues.has(normalizedValue)) {
        return false;
      }

      seenDropdownValues.add(normalizedValue);
    }

    return true;
  });

  if (field.optionType === 'drop-down' && field.options.length) {
    const selectedOptions = field.options.filter((option) => option.selected);

    if (selectedOptions.length > 1) {
      let hasSelected = false;

      field.options = field.options.map((option) => {
        if (option.selected && !hasSelected) {
          hasSelected = true;
          return option;
        }

        return {
          ...option,
          selected: false,
        };
      });
    }
  }
}

function extractOptionFieldCore(tokens, optionType) {
  const field = createOptionsField(optionType);
  let cursor = 2;

  if (OPTIONS_LAYOUTS.has(getTokenText(tokens[cursor]))) {
    field.layout = getTokenText(tokens[cursor]);
    cursor += 1;
  }

  const optionsStartIndex = findOptionsStartIndex(tokens.slice(cursor));
  const metadataTokens = (optionsStartIndex === -1
    ? tokens.slice(cursor)
    : tokens.slice(cursor, cursor + optionsStartIndex))
    .filter((token) => !isEmptyToken(token));
  const optionTokens = optionsStartIndex === -1 ? [] : tokens.slice(cursor + optionsStartIndex);

  let metadata = [...metadataTokens];

  if (
    optionType === 'checkboxes'
    && metadata.length >= 2
    && isBooleanToken(metadata[0])
    && !isBooleanToken(metadata[1])
  ) {
    field.isBooleanValue = toBoolean(metadata[0]);
    metadata = metadata.slice(1);
  }

  if (
    metadata.length >= 2
    && isBooleanToken(metadata[metadata.length - 2])
    && looksLikeValidationMessage(getTokenValue(metadata[metadata.length - 1]))
  ) {
    field.required = toBoolean(metadata[metadata.length - 2]);
    if (field.required) {
      field.errors.required = getTokenValue(metadata[metadata.length - 1]);
    }
    metadata = metadata.slice(0, -2);
  } else if (metadata.length && isBooleanToken(metadata[metadata.length - 1])) {
    field.required = toBoolean(metadata[metadata.length - 1]);
    metadata = metadata.slice(0, -1);
  }

  if (metadata.length) {
    field.name = getTokenText(metadata[metadata.length - 1]) || getTokenValue(metadata[metadata.length - 1]) || '';
    metadata = metadata.slice(0, -1);
  }

  if (metadata.length && isBooleanToken(metadata[metadata.length - 1])) {
    field.hideLabel = toBoolean(metadata[metadata.length - 1]);
    metadata = metadata.slice(0, -1);
  }

  field.label = metadata.map(getTokenValue).filter(Boolean).join('');

  assignOptionsFromContainers(field, optionTokens);
  normalizeParsedOptions(field);
  clearLeakedOptionHelp(field);
  return field;
}

function parseOptionsField(tokens) {
  const optionType = getTokenText(tokens[1]) || 'drop-down';
  return extractOptionFieldCore(tokens, optionType);
}

function parseButton(tokens) {
  const action = getTokenText(tokens[1]) || 'submit';
  const label = getTokenValue(tokens[2]);

  return {
    type: 'button',
    component: 'form-button',
    action,
    label: label && label !== action ? label : action.charAt(0).toUpperCase() + action.slice(1),
    name: getTokenText(tokens[3]) || '',
    value: getTokenText(tokens[4]) || '',
  };
}

function parseInfo(tokens) {
  return {
    type: 'info',
    component: 'information',
    icon: getTokenText(tokens[1]) || '',
    content: tokens.slice(2).map(getTokenValue).filter(Boolean).join(''),
  };
}

function parseHidden(tokens) {
  return {
    type: 'hidden',
    component: 'form-hidden',
    name: getTokenText(tokens[1]) || '',
    value: getTokenText(tokens[2]) || '',
  };
}

function parsePostcode(tokens) {
  const labelToken = tokens
    .slice(1)
    .find((token) => {
      const value = getTokenValue(token);
      return value
        && !COMPONENT_KEYS.has(getTokenText(token))
        && !COMPONENT_LAYOUTS.has(getTokenText(token));
    });
  const value = getTokenValue(labelToken);

  return {
    type: 'field',
    component: 'postcode',
    fieldType: 'postcode',
    label: value || 'Postcode',
    name: 'postCode',
    required: true,
    validation: 'postcode',
    errors: {
      required: 'Please provide the postcode',
      pattern: 'Please enter a valid postcode',
    },
  };
}

function parseFieldTokens(tokens) {
  const layoutClass = COMPONENT_LAYOUTS.has(getTokenText(tokens[1])) ? getTokenText(tokens[1]) : '';
  const normalizedTokens = layoutClass ? [tokens[0], ...tokens.slice(2)] : tokens;
  const key = getTokenText(normalizedTokens[0]);
  let field = null;

  if (key === 'form-text-field') {
    field = parseTextField(normalizedTokens);
  } else if (key === 'form-options') {
    field = parseOptionsField(normalizedTokens);
  } else if (key === 'form-button') {
    field = parseButton(normalizedTokens);
  } else if (key === 'form-hidden') {
    field = parseHidden(normalizedTokens);
  } else if (key === 'information') {
    field = parseInfo(normalizedTokens);
  } else if (key === 'postcode') {
    field = parsePostcode(normalizedTokens);
  }

  if (field && layoutClass) {
    field.layoutClass = layoutClass;
  }

  return field;
}

export default function parseUEForm(block, targetBlockName = 'forms') {
  const rows = Array.from(block?.children || []).filter((row) => row?.tagName === 'DIV');
  const configRows = [];
  const fieldGroups = [];
  let currentFieldGroup = null;
  let hasSeenComponent = false;

  rows.forEach((row, rowIndex) => {
    const tokens = getRowTokens(row, rowIndex);
    const componentIndex = tokens.findIndex(isComponentToken);

    if (componentIndex !== -1) {
      if (!hasSeenComponent && componentIndex > 0) {
        configRows.push({
          children: Array.from(row.children || []).slice(0, componentIndex),
        });
      } else if (currentFieldGroup?.tokens?.length && componentIndex > 0) {
        currentFieldGroup.tokens.push(...tokens.slice(0, componentIndex));
      }

      hasSeenComponent = true;

      if (currentFieldGroup?.tokens?.length) {
        fieldGroups.push(currentFieldGroup);
      }

      currentFieldGroup = {
        tokens: tokens.slice(componentIndex),
        sourceElement: row,
        sourceElements: [row],
      };
      return;
    }

    if (!hasSeenComponent || isConfigRow(tokens)) {
      configRows.push(row);
      return;
    }

    if (currentFieldGroup?.tokens?.length) {
      currentFieldGroup.tokens.push(...tokens);
      currentFieldGroup.sourceElements.push(row);
    }
  });

  if (currentFieldGroup?.tokens?.length) {
    fieldGroups.push(currentFieldGroup);
  }

  const parsed = {
    blockName: targetBlockName,
    config: normalizeConfig(parseConfig(configRows)),
    fields: [],
  };

  fieldGroups.forEach(({ tokens, sourceElement, sourceElements }) => {
    const field = parseFieldTokens(tokens);

    if (field) {
      field.sourceElement = sourceElement;
      field.sourceElements = sourceElements || [sourceElement].filter(Boolean);
      parsed.fields.push(field);
    }
  });

  return parsed;
}
