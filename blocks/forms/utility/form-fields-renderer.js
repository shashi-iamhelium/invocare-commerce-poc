import normalizeDAForm, { normalizeName } from './form-fields-normalizer.js';

const HTML_INPUT_TYPES = new Set([
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
const FIELD_CONTROL_SELECTOR = 'input, textarea, select';
const CHOICE_WRAPPER_SELECTOR = '.radio-wrapper, .checkbox-wrapper';

function getReadableName(value = '') {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createElement(tagName, options = {}) {
  const {
    attrs,
    className,
    html,
    text,
  } = options;
  const element = document.createElement(tagName);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  if (html !== undefined) element.innerHTML = html;

  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false || value === '') return;
    if (value === true) {
      element.setAttribute(key, '');
      return;
    }
    element.setAttribute(key, value);
  });

  return element;
}

function getJsonLink(block) {
  return block?.querySelector('a[href$=".json"], a[href*=".json?"]')?.href || '';
}

function getSheetUrl(sourceUrl, sheetName) {
  const url = new URL(sourceUrl, window.location.href);
  url.searchParams.set('sheet', sheetName);

  return url.href;
}

function getAuthoredContentRows(block) {
  return [...(block?.children || [])]
    .filter((row) => !row.querySelector('a[href$=".json"], a[href*=".json?"]'))
    .filter((row) => hasText(row.textContent));
}

function getScopedId(context, ...parts) {
  const baseId = normalizeName(parts.filter(Boolean).join('-'));
  const count = context.ids.get(baseId) || 0;
  context.ids.set(baseId, count + 1);

  return count ? `${baseId}-${count + 1}` : baseId;
}

function createRenderContext(sheetName) {
  return {
    ids: new Map(),
    sheetName,
    repeatIndex: 0,
  };
}

function getAttributeName(prefix, value) {
  return `data-${prefix}-${normalizeName(value)}`;
}

function getFieldId(context, field, suffix = '') {
  const fieldName = field.name === context.sheetName || field.name.startsWith(`${context.sheetName}-`)
    ? field.name
    : `${context.sheetName}-${field.name}`;

  return getScopedId(context, fieldName, suffix);
}

function getInputType(field) {
  if (HTML_INPUT_TYPES.has(field.type)) return field.type;
  if (field.type === 'submit' || field.type === 'reset') return field.type;
  return 'text';
}

function getAutocomplete(field) {
  if (field.type === 'email' || field.name.includes('email')) return 'email';
  if (field.type === 'tel' || field.name.includes('phone')) return 'tel';
  if (field.name.includes('postal') || field.name.includes('postcode')) return 'postal-code';
  if (field.name.includes('country')) return 'country-name';
  return 'off';
}

function setContent(element, value = '') {
  if (/<[^>]+>/.test(String(value))) {
    element.innerHTML = value;
  } else {
    element.textContent = value;
  }
}

function hasText(value = '') {
  return String(value || '').trim() !== '';
}

function appendIf(parent, child) {
  if (child) parent.appendChild(child);
}

function setHidden(element, hidden) {
  element.classList.toggle('display-none', hidden);
  element.toggleAttribute('hidden', hidden);
}

function getFieldWrapperClasses(field, typeClass) {
  return [
    'field-wrapper',
    `${typeClass}-wrapper`,
    `col-${field.columnSpan || 12}`,
    field.className,
  ].filter(Boolean).join(' ');
}

function setDataAttributes(element, values = {}) {
  Object.entries(values).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false || value === '') return;
    element.dataset[name] = String(value);
  });
}

function applyRuntimeAttributes(wrapper, field) {
  setDataAttributes(wrapper, {
    fieldName: field.name,
    fieldType: field.type,
    visible: field.visible ? 'true' : 'false',
    required: field.required ? 'true' : '',
    readOnly: field.readOnly ? 'true' : '',
    visibleExpression: field.visibleExpression,
  });
  setHidden(wrapper, !field.visible);
}

function createFieldWrapper(field, typeClass) {
  const wrapper = createElement('div', {
    className: getFieldWrapperClasses(field, typeClass),
  });

  applyRuntimeAttributes(wrapper, field);
  return wrapper;
}

function createControlWrapper(control) {
  const wrapper = createElement('div', { className: 'field-control' });
  wrapper.appendChild(control);

  return wrapper;
}

function appendFieldParts(wrapper, field, fieldId, control) {
  appendIf(wrapper, createLabel(field, fieldId));
  if (control) wrapper.appendChild(createControlWrapper(control));
  appendIf(wrapper, createHelpText(field, fieldId));
  if (field.required) wrapper.appendChild(createErrorMessage(field, fieldId));
  appendIf(wrapper, createDescription(field, fieldId));

  return wrapper;
}

function appendFieldsetHeader(fieldset, field, fieldId) {
  appendIf(fieldset, createLabel(field, fieldId, 'legend'));
  appendIf(fieldset, createDescription(field, fieldId));
}

function createLabel(field, fieldId, tagName = 'label') {
  if (!field.label) return null;

  const label = createElement(tagName, {
    className: 'field-label',
    attrs: {
      id: `${fieldId}-label`,
      for: tagName === 'label' ? fieldId : null,
    },
  });

  setContent(label, field.label);
  if (field.required) {
    label.appendChild(createElement('span', {
      className: 'field-required',
      text: '*',
      attrs: {
        'aria-hidden': 'true',
      },
    }));
    label.appendChild(createElement('span', {
      className: 'visually-hidden',
      text: ' required',
    }));
  }
  return label;
}

function createDescription(field, fieldId) {
  const description = field.description || field.subLabel || '';
  if (!hasText(description)) return null;

  return createElement('div', {
    className: 'field-description',
    html: description,
    attrs: {
      id: `${fieldId}-description`,
      'aria-live': 'polite',
    },
  });
}

function createHelpText(field, fieldId) {
  if (!hasText(field.helpText)) return null;

  return createElement('div', {
    className: 'field-help',
    html: field.helpText,
    attrs: {
      id: `${fieldId}-help`,
    },
  });
}

function createErrorMessage(field, fieldId) {
  return createElement('div', {
    className: 'field-error',
    text: field.errorMessage || 'This is a required field.',
    attrs: {
      id: `${fieldId}-error`,
      role: 'alert',
      hidden: true,
    },
  });
}

function getDescribedBy(field, fieldId) {
  return [
    hasText(field.description || field.subLabel) ? `${fieldId}-description` : '',
    hasText(field.helpText) ? `${fieldId}-help` : '',
    field.required ? `${fieldId}-error` : '',
  ].filter(Boolean).join(' ');
}

function getFieldAria(field, fieldId, context = {}) {
  return {
    'aria-label': field.label ? null : field.placeholder || getReadableName(field.name),
    'aria-describedby': getDescribedBy(field, fieldId) || context.parentDescriptionId || null,
  };
}

function createInput(field, fieldId) {
  return createElement('input', {
    className: 'field-input',
    attrs: {
      id: fieldId,
      name: field.name,
      type: getInputType(field),
      placeholder: field.placeholder,
      readonly: field.readOnly,
      min: field.min,
      max: field.max,
      step: field.step,
      maxlength: field.maxLength || null,
      autocomplete: getAutocomplete(field),
      required: field.required,
      ...getFieldAria(field, fieldId),
    },
  });
}

function renderInput(field, context) {
  if (field.type === 'hidden') {
    return createElement('input', {
      attrs: {
        type: 'hidden',
        name: field.name,
        value: field.value || '',
      },
    });
  }

  const fieldId = getFieldId(context, field);
  const wrapper = createFieldWrapper(field, field.type);
  return appendFieldParts(wrapper, field, fieldId, createInput(field, fieldId));
}

function renderTextarea(field, context) {
  const fieldId = getFieldId(context, field);
  const wrapper = createFieldWrapper(field, 'textarea');
  const textarea = createElement('textarea', {
    className: 'field-textarea',
    attrs: {
      id: fieldId,
      name: field.name,
      placeholder: field.placeholder,
      readonly: field.readOnly,
      minlength: field.min,
      maxlength: field.maxLength,
      rows: field.rows || 3,
      required: field.required,
      ...getFieldAria(field, fieldId),
    },
  });
  return appendFieldParts(wrapper, field, fieldId, textarea);
}

function renderSelect(field, context) {
  const fieldId = getFieldId(context, field);
  const wrapper = createFieldWrapper(field, 'drop-down');
  const select = createElement('select', {
    className: 'field-select',
    attrs: {
      id: fieldId,
      name: field.name,
      disabled: field.readOnly,
      required: field.required,
      ...getFieldAria(field, fieldId),
    },
  });

  if (field.placeholder) {
    select.appendChild(createElement('option', {
      text: field.placeholder,
      attrs: { value: '' },
    }));
  }

  field.options.forEach((option) => {
    select.appendChild(createElement('option', {
      text: option.label,
      attrs: {
        value: option.value,
        selected: option.checked || option.value === field.value,
      },
    }));
  });

  return appendFieldParts(wrapper, field, fieldId, select);
}

function renderChoice(field, option, context, index) {
  const optionId = option.value || option.label || `option-${index + 1}`;
  const fieldId = getFieldId(context, field, optionId);
  const type = field.type === 'radio-group' ? 'radio' : 'checkbox';
  const wrapper = createElement('label', {
    className: `${type}-wrapper${option.checked ? ' is-selected' : ''}`,
    attrs: {
      for: fieldId,
      'data-option-value': option.value,
      'data-option-selected': option.checked ? 'true' : 'false',
      'data-read-only': option.readOnly ? 'true' : null,
    },
  });
  const input = createElement('input', {
    attrs: {
      id: fieldId,
      type,
      name: field.name,
      value: option.value,
      checked: option.checked,
      disabled: option.readOnly,
      required: type === 'radio' && field.required,
      'data-field-type': field.type,
    },
  });
  const label = createElement('span', {
    className: 'field-choice-label',
    text: option.label,
  });

  wrapper.append(input, label);
  return wrapper;
}

function renderChoiceGroup(field, context) {
  const typeClass = field.type;
  const fieldId = getFieldId(context, field);
  const isSummaryEnabled = field.type === 'radio-group';
  const descriptionId = getDescribedBy(field, fieldId) || context.parentDescriptionId;
  const labelId = field.label ? `${fieldId}-label` : context.parentLegendId;
  const optionsId = `${fieldId}-options`;
  const wrapper = createElement('fieldset', {
    className: [
      'field-wrapper',
      `${typeClass}-wrapper`,
      `col-${field.columnSpan || 12}`,
      field.className,
    ].filter(Boolean).join(' '),
    attrs: {
      id: fieldId,
      name: field.name,
      'data-selection-state': 'editing',
      'aria-labelledby': labelId || null,
      'aria-describedby': descriptionId || null,
    },
  });

  applyRuntimeAttributes(wrapper, field);

  appendFieldsetHeader(wrapper, field, fieldId);

  const optionsWrapper = createElement('div', {
    className: 'field-options',
    attrs: {
      id: optionsId,
    },
  });
  field.options.forEach((option, index) => {
    optionsWrapper.appendChild(renderChoice(field, option, context, index));
  });
  wrapper.appendChild(optionsWrapper);

  if (isSummaryEnabled) {
    wrapper.appendChild(createSelectionSummary(field, fieldId, optionsId));
  }
  appendIf(wrapper, createHelpText(field, fieldId));
  if (field.required) wrapper.appendChild(createErrorMessage(field, fieldId));

  return wrapper;
}

function createSelectionSummary(field, fieldId, optionsId) {
  const summary = createElement('div', {
    className: 'field-selection-summary',
    attrs: {
      id: `${fieldId}-summary`,
      role: 'group',
      'aria-label': 'Selected option',
      hidden: true,
    },
  });

  summary.append(
    createElement('span', {
      className: 'field-selection-icon',
      text: '✓',
      attrs: {
        'aria-hidden': 'true',
      },
    }),
    createElement('span', {
      className: 'field-selection-label',
      attrs: {
        'aria-live': 'polite',
      },
    }),
    createElement('button', {
      className: 'field-selection-change',
      text: field.changeLabel || 'Change selection',
      attrs: {
        type: 'button',
        'aria-controls': optionsId,
        'aria-expanded': 'false',
      },
    }),
  );

  return summary;
}

function createFormSheet(sheetName, options = {}) {
  const { hidden = false } = options;

  return createElement('div', {
    className: `form-sheet${hidden ? ' form-dependent-sheet' : ''}`,
    attrs: {
      hidden,
      'aria-hidden': hidden ? 'true' : null,
      'data-form-sheet': sheetName,
      'data-sheet-state': hidden ? 'hidden' : 'active',
    },
  });
}

function resetControls(container) {
  container.querySelectorAll(FIELD_CONTROL_SELECTOR).forEach((control) => {
    if (control.type === 'checkbox' || control.type === 'radio') {
      control.checked = false;
    } else if (control.tagName === 'SELECT') {
      control.selectedIndex = 0;
    } else if (control.type !== 'hidden') {
      control.value = '';
    }
  });
}

async function renderDependentSheet(sheet, sourceUrl) {
  if (!sheet || sheet.dataset.loaded === 'true') return;

  sheet.setAttribute('aria-busy', 'true');
  const formDefinition = await loadFormDefinitionFromUrl(
    getSheetUrl(sourceUrl, sheet.dataset.formSheet),
  );
  const context = createRenderContext(formDefinition.activeSheet);
  sheet.appendChild(createFieldContainer(formDefinition.fields, context));
  sheet.dataset.loaded = 'true';
  sheet.removeAttribute('aria-busy');
}

async function showDependentSheets(sheets, sourceUrl, form) {
  if (!sheets?.length) return;

  sheets.forEach((sheet) => {
    sheet.dataset.visibleRequested = 'true';
  });
  await Promise.all(sheets.map((sheet) => renderDependentSheet(sheet, sourceUrl)));

  sheets.forEach((sheet) => {
    if (sheet.dataset.visibleRequested !== 'true') return;

    sheet.hidden = false;
    sheet.dataset.sheetState = 'active';
    sheet.setAttribute('aria-hidden', 'false');
  });
  applyVisibilityRules(form);
  updateSubmitButtons(form);
}

function hideDependentSheets(sheets) {
  if (!sheets?.length) return;

  sheets.forEach((sheet) => {
    sheet.dataset.visibleRequested = 'false';
    resetControls(sheet);
    sheet.hidden = true;
    sheet.dataset.sheetState = 'hidden';
    sheet.setAttribute('aria-hidden', 'true');
  });
}

function splitExpressionValues(value = '') {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => normalizeName(item))
    .filter(Boolean);
}

function parseVisibilityExpression(expression = '') {
  const match = String(expression).match(/^\s*([^!=<>]+?)\s*(=|==|!=)\s*(.+?)\s*$/);
  if (!match) return null;

  return {
    fieldName: normalizeName(match[1]),
    operator: match[2],
    values: splitExpressionValues(match[3]),
  };
}

function getFieldValues(form, fieldName) {
  const controls = [...form.querySelectorAll(FIELD_CONTROL_SELECTOR)]
    .filter((control) => normalizeName(control.name) === fieldName);

  return controls.reduce((values, control) => {
    if ((control.type === 'radio' || control.type === 'checkbox') && !control.checked) {
      return values;
    }

    values.push(normalizeName(control.value));
    return values;
  }, []);
}

function isVisibilityExpressionMatched(form, expression) {
  const rule = parseVisibilityExpression(expression);
  if (!rule) return true;

  const fieldValues = getFieldValues(form, rule.fieldName);
  const isMatched = fieldValues.some((value) => rule.values.includes(value));

  return rule.operator === '!=' ? !isMatched : isMatched;
}

function setFieldVisibility(field, visible) {
  const wasVisible = field.dataset.visible !== 'false';

  if (!visible && wasVisible) resetControls(field);

  field.dataset.visible = visible ? 'true' : 'false';
  field.classList.toggle('display-none', !visible);
  field.toggleAttribute('hidden', !visible);
}

function applyVisibilityRules(form) {
  if (!form) return;

  form.querySelectorAll('[data-visible-expression]').forEach((field) => {
    setFieldVisibility(field, isVisibilityExpressionMatched(
      form,
      field.dataset.visibleExpression,
    ));
  });
}

function isVisibleField(field) {
  return field && !field.hidden && field.dataset.visible !== 'false' && !field.closest('[hidden]');
}

function getFieldControls(field) {
  return [...field.querySelectorAll(FIELD_CONTROL_SELECTOR)]
    .filter((control) => control.type !== 'hidden' && !control.disabled);
}

function isChoiceField(field) {
  return ['radio-group', 'checkbox-group'].includes(field.dataset.fieldType);
}

function hasRequiredValue(field) {
  if (!isVisibleField(field) || field.dataset.required !== 'true') return true;

  const controls = getFieldControls(field);
  if (!controls.length) return true;

  if (isChoiceField(field)) {
    return controls.some((control) => control.checked);
  }

  return controls.every((control) => String(control.value || '').trim());
}

function setFieldValidity(field, showError = false) {
  const isValid = hasRequiredValue(field);
  const error = field.querySelector(':scope > .field-error');

  field.classList.toggle('is-invalid', !isValid && showError);
  field.querySelectorAll(FIELD_CONTROL_SELECTOR).forEach((control) => {
    control.setAttribute('aria-invalid', !isValid && showError ? 'true' : 'false');
  });
  if (error) error.hidden = isValid || !showError;

  return isValid;
}

function getRequiredFields(form) {
  return [...form.querySelectorAll('[data-required="true"]')].filter(isVisibleField);
}

function isFormReady(form) {
  return getRequiredFields(form).every((field) => hasRequiredValue(field));
}

function updateSubmitButtons(form) {
  form.querySelectorAll('button[type="submit"]').forEach((button) => {
    button.disabled = !isFormReady(form);
  });
}

function validateTouchedField(event) {
  const field = event.target.closest('[data-required="true"]');
  if (!field || field.contains(event.relatedTarget)) return;

  setFieldValidity(field, true);
}

function refreshVisibleError(event) {
  const field = event.target.closest('[data-required="true"]');
  if (field?.classList.contains('is-invalid')) {
    setFieldValidity(field, true);
  }
}

function validateForm(form) {
  const requiredFields = getRequiredFields(form);
  const firstInvalidField = requiredFields.find((field) => !setFieldValidity(field, true));

  updateSubmitButtons(form);
  firstInvalidField?.querySelector(FIELD_CONTROL_SELECTOR)?.focus();

  return !firstInvalidField;
}

function submitToButtonValue(form, submitter) {
  const targetUrl = submitter?.value;
  if (!targetUrl) return;

  window.location.href = new URL(targetUrl, window.location.href).href;
}

function bindValidation(form) {
  form.addEventListener('focusout', validateTouchedField);
  form.addEventListener('input', (event) => {
    refreshVisibleError(event);
    updateSubmitButtons(form);
  });
  form.addEventListener('change', (event) => {
    refreshVisibleError(event);
    applyVisibilityRules(form);
    updateSubmitButtons(form);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm(form)) return;

    submitToButtonValue(form, event.submitter);
  });

  updateSubmitButtons(form);
}

function createAuthoredAccordion(block, context) {
  const rows = getAuthoredContentRows(block);
  if (!rows.length) return null;

  const panel = createElement('div', { className: 'form-accordion-panel' });

  rows.forEach((row) => {
    const content = row.firstElementChild || row;
    [...content.childNodes].forEach((node) => panel.appendChild(node.cloneNode(true)));
  });

  const heading = [...panel.children]
    .find((child) => child.matches('h1, h2, h3, h4, h5, h6, p') && hasText(child.textContent));
  const title = heading?.textContent?.trim() || 'More information';

  if (heading) heading.remove();
  if (!hasText(panel.textContent)) return null;

  const accordionId = getScopedId(context, context.sheetName, 'info');
  const summaryId = `${accordionId}-summary`;
  const contentId = `${accordionId}-content`;

  panel.id = contentId;
  panel.setAttribute('aria-labelledby', summaryId);

  const accordion = createElement('details', {
    className: 'form-accordion',
    attrs: {
      id: accordionId,
      'data-accordion-for': context.sheetName,
      'data-accordion-title': normalizeName(title),
    },
  });
  const summary = createElement('summary', {
    className: 'form-accordion-summary',
    attrs: {
      id: summaryId,
      'aria-controls': contentId,
    },
  });

  summary.appendChild(createElement('span', {
    className: 'form-accordion-title',
    text: title,
  }));
  accordion.append(summary, panel);

  return accordion;
}

function getButtonType(field) {
  if (field.type === 'reset') return 'reset';
  if (field.type === 'submit' || field.name === 'submit') return 'submit';
  return 'button';
}

function renderButton(field) {
  const wrapper = createElement('p', {
    className: [
      'button-wrapper',
      `col-${field.columnSpan || 12}`,
      field.className,
    ].filter(Boolean).join(' '),
  });
  const button = createElement('button', {
    className: 'button',
    attrs: {
      type: getButtonType(field),
      name: field.name === 'submit' ? null : field.name,
      value: field.value || null,
    },
  });

  button.dataset.defaultLabel = field.label || 'Submit';
  button.appendChild(createElement('span', {
    className: 'button-label',
    text: field.label || 'Submit',
  }));
  wrapper.appendChild(button);
  wrapper.classList.toggle('display-none', !field.visible);
  wrapper.toggleAttribute('hidden', !field.visible);

  return wrapper;
}

function renderPanel(field, context) {
  const fieldId = getFieldId(context, field);
  const descriptionId = hasText(field.description || field.subLabel) ? `${fieldId}-description` : null;
  const labelId = field.label ? `${fieldId}-label` : null;
  const panel = createElement('fieldset', {
    className: [
      'field-wrapper',
      'panel-wrapper',
      `col-${field.columnSpan || 12}`,
      field.className,
    ].filter(Boolean).join(' '),
    attrs: {
      name: field.name,
      'data-min-occur': field.min || 1,
      'data-max-occur': field.max || null,
      'data-repeatable': field.repeatable ? 'true' : null,
      'data-selection-state': 'editing',
      'aria-labelledby': labelId,
      'aria-describedby': descriptionId,
    },
  });

  applyRuntimeAttributes(panel, field);

  appendFieldsetHeader(panel, field, fieldId);

  const previousParentDescriptionId = context.parentDescriptionId;
  const previousParentLegendId = context.parentLegendId;
  context.parentDescriptionId = descriptionId;
  context.parentLegendId = labelId;
  panel.appendChild(createFieldContainer(field.fields || [], context));
  context.parentDescriptionId = previousParentDescriptionId;
  context.parentLegendId = previousParentLegendId;

  if (field.repeatable) {
    panel.appendChild(createRepeatActions());
    bindRepeatablePanel(panel, context);
  }

  return panel;
}

function createRepeatActions() {
  const actions = createElement('div', { className: 'repeat-actions' });
  actions.append(
    createElement('button', {
      className: 'repeat-add',
      text: 'Add',
      attrs: { type: 'button', 'data-repeat-add': 'true' },
    }),
    createElement('button', {
      className: 'repeat-remove',
      text: 'Remove',
      attrs: { type: 'button', 'data-repeat-remove': 'true' },
    }),
  );
  return actions;
}

function updateRepeatActions(panel) {
  const siblings = [...panel.parentElement.querySelectorAll(
    `:scope > [data-field-name="${panel.dataset.fieldName}"]`,
  )];
  const min = Number(panel.dataset.minOccur) || 1;
  const max = Number(panel.dataset.maxOccur) || 0;

  siblings.forEach((item) => {
    item.querySelector('[data-repeat-add]')?.toggleAttribute('disabled', max && siblings.length >= max);
    item.querySelector('[data-repeat-remove]')?.toggleAttribute('disabled', siblings.length <= min);
  });
}

function resetRepeatedControls(panel) {
  panel.querySelectorAll(FIELD_CONTROL_SELECTOR).forEach((control) => {
    if (control.type === 'checkbox' || control.type === 'radio') {
      control.checked = false;
    } else if (control.type !== 'hidden') {
      control.value = '';
    }
  });
}

function refreshRepeatedIds(panel, context) {
  context.repeatIndex += 1;
  const suffix = `repeat-${context.repeatIndex}`;

  panel.querySelectorAll('[id]').forEach((element) => {
    const oldId = element.id;
    const newId = `${oldId}-${suffix}`;
    element.id = newId;
    panel.querySelectorAll(`[for="${oldId}"]`).forEach((label) => label.setAttribute('for', newId));
  });

  panel.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.name = `${input.name}-${suffix}`;
  });
}

function bindRepeatablePanel(panel, context) {
  panel.querySelector('[data-repeat-add]')?.addEventListener('click', () => {
    const clone = panel.cloneNode(true);
    resetRepeatedControls(clone);
    refreshRepeatedIds(clone, context);
    panel.after(clone);
    bindRepeatablePanel(clone, context);
    updateRepeatActions(clone);
    clone.dispatchEvent(new CustomEvent('form-repeat-added', { bubbles: true }));
  });

  panel.querySelector('[data-repeat-remove]')?.addEventListener('click', () => {
    const nextPanel = panel.previousElementSibling || panel.nextElementSibling;
    panel.remove();
    if (nextPanel) updateRepeatActions(nextPanel);
    nextPanel?.dispatchEvent(new CustomEvent('form-repeat-removed', { bubbles: true }));
  });

  updateRepeatActions(panel);
}

function renderSeparator(field) {
  const separator = createElement('hr', {
    className: getFieldWrapperClasses(field, 'separator'),
  });

  applyRuntimeAttributes(separator, field);
  return separator;
}

function renderField(field, context) {
  if (field.type === 'separator') return renderSeparator(field);
  if (field.type === 'panel') return renderPanel(field, context);
  if (field.type === 'textarea') return renderTextarea(field, context);
  if (field.type === 'drop-down') return renderSelect(field, context);
  if (field.type === 'radio-group' || field.type === 'checkbox-group') return renderChoiceGroup(field, context);
  if (field.type === 'button' || field.type === 'submit' || field.type === 'reset') return renderButton(field);
  return renderInput(field, context);
}

function createFieldContainer(fields, context) {
  const container = createElement('div', { className: 'form-fields' });

  fields.forEach((field) => {
    const element = renderField(field, context);
    if (element) container.appendChild(element);
  });

  return container;
}

function createForm(formDefinition) {
  const form = createElement('form', {
    className: 'da-form',
    attrs: {
      id: formDefinition.id,
      name: formDefinition.id,
      autocomplete: 'off',
      novalidate: true,
      'aria-label': getReadableName(formDefinition.id || 'form'),
      'data-form-id': formDefinition.id,
      'data-source': 'da-sheet',
      'data-source-url': formDefinition.sourceUrl,
    },
  });

  return form;
}

function getSelectedChoice(group) {
  return group.querySelector('input[type="radio"]:checked');
}

function setSelectedAttributes(element, fieldName, value, label) {
  if (!element || !fieldName) return;

  element.dataset.selectedValue = value;
  element.dataset.selectedLabel = label;
  element.setAttribute(getAttributeName('selected', fieldName), value);
}

function clearSelectedAttributes(element, fieldName) {
  if (!element || !fieldName) return;

  delete element.dataset.selectedValue;
  delete element.dataset.selectedLabel;
  element.removeAttribute(getAttributeName('selected', fieldName));
}

function getChoiceLabel(group, choice) {
  return group
    .querySelector(`label[for="${choice.id}"] .field-choice-label`)
    ?.textContent
    ?.trim() || choice.value;
}

function setChoiceOptionState(group, selectedChoice) {
  group.querySelectorAll(CHOICE_WRAPPER_SELECTOR).forEach((wrapper) => {
    const input = wrapper.querySelector('input');
    const isSelected = input && input === selectedChoice;

    wrapper.classList.toggle('is-selected', isSelected);
    wrapper.dataset.optionSelected = isSelected ? 'true' : 'false';
  });
}

function clearChoiceGroup(group) {
  const summary = group.querySelector('.field-selection-summary');
  const changeButton = group.querySelector('.field-selection-change');
  const panel = group.closest('.panel-wrapper');
  const form = group.closest('form');
  const { fieldName } = group.dataset;

  group.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.checked = false;
  });

  group.dataset.selectionState = 'editing';
  delete group.dataset.selectedValue;
  delete group.dataset.selectedLabel;
  group.removeAttribute(getAttributeName('selected', fieldName));
  if (panel) panel.dataset.selectionState = 'editing';
  clearSelectedAttributes(panel, fieldName);
  clearSelectedAttributes(form, fieldName);
  setChoiceOptionState(group, null);
  if (summary) summary.hidden = true;
  if (changeButton) {
    changeButton.disabled = false;
    changeButton.setAttribute('aria-expanded', 'true');
  }
}

function syncChoiceGroup(group) {
  const selectedChoice = getSelectedChoice(group);
  const summary = group.querySelector('.field-selection-summary');
  const summaryLabel = group.querySelector('.field-selection-label');
  const panel = group.closest('.panel-wrapper');
  const form = group.closest('form');
  const { fieldName } = group.dataset;
  const changeButton = group.querySelector('.field-selection-change');

  if (!selectedChoice || !summary || !summaryLabel) {
    clearChoiceGroup(group);
    return null;
  }

  const label = getChoiceLabel(group, selectedChoice);
  const isReadOnly = group.dataset.readOnly === 'true';

  summaryLabel.textContent = label;
  group.dataset.selectionState = 'selected';
  setSelectedAttributes(group, fieldName, selectedChoice.value, label);
  if (panel) {
    panel.dataset.selectionState = 'selected';
    setSelectedAttributes(panel, fieldName, selectedChoice.value, label);
  }
  setSelectedAttributes(form, fieldName, selectedChoice.value, label);
  setChoiceOptionState(group, selectedChoice);
  if (isReadOnly) {
    group.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.disabled = true;
    });
  }
  if (changeButton) {
    changeButton.disabled = isReadOnly;
    changeButton.setAttribute('aria-expanded', 'false');
    changeButton.setAttribute('aria-disabled', isReadOnly ? 'true' : 'false');
  }
  summary.hidden = false;
  return selectedChoice;
}

function showChoiceOptions(group) {
  const summary = group.querySelector('.field-selection-summary');
  const changeButton = group.querySelector('.field-selection-change');
  const selectedChoice = getSelectedChoice(group);

  if (selectedChoice?.disabled || changeButton?.disabled) return;

  if (selectedChoice) selectedChoice.checked = false;
  clearChoiceGroup(group);
  if (summary) summary.hidden = true;
  changeButton?.setAttribute('aria-expanded', 'true');

  group.querySelector('input[type="radio"]')?.focus();
}

async function bindChoiceFields(form, options = {}) {
  const {
    dependentSheets,
    sourceUrl,
  } = options;

  await Promise.all([...form.querySelectorAll('.radio-group-wrapper')].map(async (group) => {
    const selectedChoice = syncChoiceGroup(group);
    if (selectedChoice) {
      await showDependentSheets(dependentSheets, sourceUrl, form);
    }

    group.addEventListener('change', async (event) => {
      if (event.target?.matches('input[type="radio"]')) {
        syncChoiceGroup(group);
        await showDependentSheets(dependentSheets, sourceUrl, form);
      }
    });

    group.querySelector('.field-selection-change')?.addEventListener('click', () => {
      showChoiceOptions(group);
      hideDependentSheets(dependentSheets);
      applyVisibilityRules(form);
      updateSubmitButtons(form);
    });
  }));
}

async function loadFormDefinitionFromUrl(sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to load form definition: ${response.status}`);
  }

  return normalizeDAForm(await response.json(), sourceUrl);
}

async function loadFormDefinition(block) {
  const jsonLink = getJsonLink(block);
  if (!jsonLink) return null;

  return loadFormDefinitionFromUrl(jsonLink);
}

export default async function initForms(block) {
  if (!block) return null;

  const formDefinition = await loadFormDefinition(block);
  if (!formDefinition) return null;

  const context = createRenderContext(formDefinition.activeSheet);
  const form = createForm(formDefinition);
  const mainSheet = createFormSheet(formDefinition.activeSheet);
  const fields = createFieldContainer(formDefinition.fields, context);
  const accordion = createAuthoredAccordion(block, context);
  const dependentSheetNames = formDefinition.dependentSheets || [];
  const dependentSheets = dependentSheetNames.map((sheetName) => (
    createFormSheet(sheetName, { hidden: true })
  ));

  mainSheet.appendChild(fields);
  if (accordion) {
    const panel = fields.querySelector('.panel-wrapper');
    (panel || mainSheet).appendChild(accordion);
  }
  form.append(mainSheet, ...dependentSheets);
  block.replaceChildren(form);
  bindValidation(form);
  await bindChoiceFields(form, {
    dependentSheets,
    sourceUrl: formDefinition.sourceUrl,
  });
  applyVisibilityRules(form);
  updateSubmitButtons(form);

  return form;
}
