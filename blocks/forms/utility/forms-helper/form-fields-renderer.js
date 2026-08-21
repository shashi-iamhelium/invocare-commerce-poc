import { moveInstrumentation } from '../../../../scripts/ue-utils.js';
import { getMaxLengthForValidation } from '../validations/validation-patterns.js';
import parseUEForm from './forms-parser.js';

const FORM_THEME_CLASSES = ['bg-white', 'bg-light-cool-grey'];
const UE_AUTHORED_ROW_HIDDEN_CLASS = 'display-none';
const UE_AUTHORED_ROW_ATTR = 'data-form-authored-row';
const FEEDBACK_HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

function createUniqueId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

function sanitizeName(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getElementId(prefix, name = '') {
  const safeName = sanitizeName(name) || 'field';
  return `${prefix}-${safeName}`;
}

function getFieldId(context, prefix, field) {
  if (!field.renderSuffix) {
    field.renderSuffix = `${context.uniqueId}-${context.nextIndex}`;
    context.nextIndex += 1;
  }

  return getElementId(prefix, `${field.name || field.label || field.component}-${field.renderSuffix}`);
}

function createElement(tagName, options = {}) {
  const {
    className,
    text,
    html,
    attrs,
  } = options;

  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  if (html !== undefined) {
    element.innerHTML = html;
  }

  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === false || value === null || value === undefined) {
        return;
      }

      if (value === true) {
        element.setAttribute(key, '');
        return;
      }

      element.setAttribute(key, value);
    });
  }

  return element;
}

function createFragmentFromHTML(html) {
  if (!html) {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const firstElement = template.content.firstElementChild;

  if (
    firstElement?.tagName === 'P'
    && firstElement.childElementCount === 1
    && firstElement.firstElementChild?.tagName === 'PICTURE'
  ) {
    return firstElement.firstElementChild;
  }

  return firstElement;
}

function normalizeText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function removeDuplicateLeadingFeedbackContent(contentElement, headingText = '') {
  const normalizedHeading = normalizeText(headingText);

  if (!contentElement || !normalizedHeading) {
    return;
  }

  let firstMeaningfulNode = Array.from(contentElement.childNodes).find((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeText(node.textContent || '') !== '';
    }

    return node.nodeType === Node.ELEMENT_NODE && normalizeText(node.textContent || '') !== '';
  });

  while (firstMeaningfulNode) {
    const normalizedNodeText = normalizeText(firstMeaningfulNode.textContent || '');

    if (normalizedNodeText !== normalizedHeading) {
      break;
    }

    const nextNode = firstMeaningfulNode.nextSibling;
    firstMeaningfulNode.remove();
    firstMeaningfulNode = nextNode;

    while (firstMeaningfulNode && normalizeText(firstMeaningfulNode.textContent || '') === '') {
      firstMeaningfulNode = firstMeaningfulNode.nextSibling;
    }
  }
}

function cleanFeedbackContent(contentElement, headingText = '') {
  if (!contentElement) {
    return;
  }

  const normalizedHeading = normalizeText(headingText);

  if (normalizedHeading) {
    contentElement.querySelectorAll(FEEDBACK_HEADING_SELECTOR).forEach((headingNode) => {
      if (normalizeText(headingNode.textContent || '') === normalizedHeading) {
        headingNode.remove();
      }
    });
  } else {
    contentElement
      .querySelectorAll(FEEDBACK_HEADING_SELECTOR)
      .forEach((headingNode) => headingNode.remove());
  }

  removeDuplicateLeadingFeedbackContent(contentElement, normalizedHeading);
}

function observeFeedbackContent(contentElement, headingText = '') {
  if (!contentElement || typeof MutationObserver === 'undefined') {
    return;
  }

  const observer = new MutationObserver(() => {
    observer.disconnect();
    cleanFeedbackContent(contentElement, headingText);
    observer.observe(contentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  observer.observe(contentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function moveFeedbackHeading(feedbackContent, feedbackHeader) {
  const heading = feedbackContent.querySelector(FEEDBACK_HEADING_SELECTOR)?.cloneNode(true) || null;

  if (!heading) {
    cleanFeedbackContent(feedbackContent);
    observeFeedbackContent(feedbackContent);
    return;
  }

  heading.classList.add('cmp-form-feedback__title');
  feedbackHeader.appendChild(heading);
  cleanFeedbackContent(feedbackContent, heading.textContent || '');
  observeFeedbackContent(feedbackContent, heading.textContent || '');
}

function appendRequiredMarker(element, className) {
  const marker = createElement('span', {
    className,
    text: '*',
  });
  element.appendChild(marker);
}

function isHTMLContent(value) {
  return /<[^>]+>/.test(value || '');
}

function setContent(element, value) {
  if (!value) {
    return;
  }

  if (isHTMLContent(value)) {
    element.innerHTML = value;
    return;
  }

  element.textContent = value;
}

function hasRenderableText(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'true' && normalized !== 'false';
}

function getAutocomplete(field) {
  const normalizedName = sanitizeName(field.name || field.label || '');

  if (field.inputType === 'email' || normalizedName.includes('email')) {
    return 'email';
  }

  if (field.inputType === 'tel' || normalizedName.includes('phone') || normalizedName.includes('mobile')) {
    return 'tel';
  }

  if (normalizedName === 'firstname' || normalizedName === 'first-name' || normalizedName === 'first-name-field') {
    return 'given-name';
  }

  if (normalizedName === 'lastname' || normalizedName === 'last-name' || normalizedName === 'last-name-field') {
    return 'family-name';
  }

  if (normalizedName.includes('postcode') || normalizedName.includes('postal')) {
    return 'postal-code';
  }

  if (normalizedName.includes('country')) {
    return 'country-name';
  }

  return 'off';
}

function getConfigClass(value, allowedClasses) {
  const values = String(value || '').split(/[\s,]+/);
  return allowedClasses.find((className) => values.includes(className)) || '';
}

function applyFormConfigClasses(block, parsed) {
  const themeValue = parsed.config.formsTheme || parsed.config.classes;
  const themeClass = getConfigClass(themeValue, FORM_THEME_CLASSES);

  if (themeValue) {
    block.classList.remove(...FORM_THEME_CLASSES);
  }

  if (themeClass) {
    block.classList.add(themeClass);
  }
}

function createGridFieldWrapper(typeClass, context) {
  const layoutClass = context?.layoutClass || '';

  return createElement('div', {
    className: `cmp-form__field ${typeClass}${layoutClass ? ` ${layoutClass}` : ''}`,
  });
}

function hasInstrumentationAttributes(element) {
  return !!element && [...element.attributes].some(({ name }) => name.startsWith('data-aue-') || name.startsWith('data-richtext-'));
}

function getInstrumentationSource(field) {
  const sourceElements = field?.sourceElements?.length
    ? field.sourceElements
    : [field?.sourceElement].filter(Boolean);

  if (!sourceElements.length) {
    return null;
  }

  const directSource = sourceElements.find(hasInstrumentationAttributes);
  if (directSource) {
    return directSource;
  }

  return sourceElements
    .map((sourceElement) => sourceElement.querySelector('[data-aue-resource], [data-aue-type], [data-aue-component], [data-richtext-resource]'))
    .find(Boolean) || null;
}

function applyFieldInstrumentation(field, element) {
  if (!element) {
    return element;
  }

  const source = getInstrumentationSource(field);
  if (source) {
    moveInstrumentation(source, element);
  }

  return element;
}

function getFormId(parsed) {
  return sanitizeName(parsed.config['form-id'] || parsed.config.title || parsed.blockName || 'form');
}

function isEnabled(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function createCTAElement(options) {
  const {
    parentClass = '',
    ctaClass = '',
    label = '',
    type = 'primary',
  } = options;
  const container = createElement('p', {
    className: `${parentClass} button-container`.trim(),
  });
  const button = createElement('button', {
    className: `button ${type} cmp-button ${ctaClass}`.trim(),
  });
  const text = createElement('span', {
    className: 'cmp-button__text',
    text: label,
  });

  button.append(text);
  container.append(button);
  return container;
}

function setDropdownExpanded(select, expanded) {
  const optionList = select.querySelector('.yamaha-select__menu-list');
  select.classList.toggle('expanded', expanded);
  select.setAttribute('aria-expanded', expanded ? 'true' : 'false');

  if (optionList) {
    optionList.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function setDropdownSelectedOption(select, option) {
  if (!select || !option) {
    return;
  }

  const valueLabel = select.querySelector('.yamaha-select__value-label');
  const options = select.querySelectorAll('.yamaha-select__menu-list-option');
  const label = option.textContent.trim();
  const value = option.getAttribute('value') || label;

  options.forEach((item) => {
    const isSelected = item === option;
    item.classList.toggle('selected', isSelected);
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  select.setAttribute('value', value);

  if (valueLabel) {
    valueLabel.textContent = label;
  }

  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function initializeDropdown(select) {
  const selectedOption = select.querySelector('.yamaha-select__menu-list-option.selected')
    || select.querySelector('.yamaha-select__menu-list-option[aria-selected="true"]')
    || select.querySelector('.yamaha-select__menu-list-option');

  if (selectedOption) {
    setDropdownSelectedOption(select, selectedOption);
  }

  setDropdownExpanded(select, false);
}

function initDropdowns(root) {
  const selects = [...root.querySelectorAll('.yamaha-select')];

  if (!selects.length) {
    return;
  }

  const closeAll = (exceptSelect = null) => {
    selects.forEach((select) => {
      if (select !== exceptSelect) {
        setDropdownExpanded(select, false);
      }
    });
  };

  selects.forEach((select) => {
    initializeDropdown(select);

    const trigger = select.querySelector('.yamaha-select__value');
    const options = select.querySelectorAll('.yamaha-select__menu-list-option');

    trigger?.addEventListener('click', (event) => {
      event.stopPropagation();
      const shouldExpand = !select.classList.contains('expanded');
      closeAll(select);
      setDropdownExpanded(select, shouldExpand);
    });

    select.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const shouldExpand = !select.classList.contains('expanded');
        closeAll(select);
        setDropdownExpanded(select, shouldExpand);
      }

      if (event.key === 'Escape') {
        setDropdownExpanded(select, false);
      }
    });

    options.forEach((option) => {
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        setDropdownSelectedOption(select, option);
        setDropdownExpanded(select, false);
      });
    });
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      closeAll();
      return;
    }

    if (!event.target.closest('.yamaha-select')) {
      closeAll();
    }
  });
}

function syncSelectableFieldState(input) {
  const field = input.closest('.yamaha-checkbox__field');
  const checkmark = field?.querySelector('.yamaha-checkbox__field-checkmark');
  const isActive = !!input.checked;

  checkmark?.classList.toggle('active', isActive);
}

function toggleSelectableInput(input) {
  if (!input || input.disabled) {
    return;
  }

  if (input.type === 'radio') {
    input.checked = true;
  } else {
    input.checked = !input.checked;
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function initSelectableFields(root) {
  root.querySelectorAll('.yamaha-checkbox__field-checkbox').forEach((input) => {
    syncSelectableFieldState(input);

    input.addEventListener('change', () => {
      if (input.type === 'radio') {
        root.querySelectorAll(`.yamaha-checkbox__field-checkbox[name="${input.name}"]`).forEach(syncSelectableFieldState);
        return;
      }

      syncSelectableFieldState(input);
    });

    const field = input.closest('.yamaha-checkbox__field');
    const checkmark = field?.querySelector('.yamaha-checkbox__field-checkmark');

    checkmark?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSelectableInput(input);
    });

    checkmark?.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        toggleSelectableInput(input);
      }
    });
  });
}

function syncTextareaCounter(textarea) {
  const wrapper = textarea.closest('.cmp-form-text__wrapper');
  const counter = wrapper?.querySelector('.word-count');

  if (!counter) {
    return;
  }

  counter.textContent = String(textarea.value.length);
}

function initTextareaCounters(root) {
  root.querySelectorAll('.cmp-form-text__wrapper textarea').forEach((textarea) => {
    syncTextareaCounter(textarea);

    textarea.addEventListener('input', () => {
      syncTextareaCounter(textarea);
    });
  });
}

function applyErrorMessageAttributes(element, field) {
  const requiredMessage = field.errors?.required || '';
  const patternMessage = field.errors?.pattern || '';
  const defaultMessage = requiredMessage || patternMessage;

  if (requiredMessage) {
    element.setAttribute('data-required-message', requiredMessage);
  }

  if (patternMessage) {
    element.setAttribute('data-pattern-message', patternMessage);
  }

  if (defaultMessage) {
    element.textContent = defaultMessage;
  }
}

function getFieldErrorElement(fieldElement) {
  if (!fieldElement) {
    return null;
  }

  return fieldElement.querySelector('.cmp-form-text__error, .cmp-form-option__error, .yamaha-checkbox__error');
}

function getInteractiveControl(fieldElement) {
  return fieldElement.querySelector('input:not([type="hidden"]), textarea, .yamaha-select, .yamaha-checkbox__content');
}

function updateCheckboxErrorState(fieldElement, hasError) {
  const checkboxFields = [...fieldElement.querySelectorAll('.yamaha-checkbox__field')];

  if (!checkboxFields.length) {
    return;
  }

  checkboxFields.forEach((checkboxField) => {
    const input = checkboxField.querySelector('.yamaha-checkbox__field-checkbox');
    const checkmark = checkboxField.querySelector('.yamaha-checkbox__field-checkmark');
    const shouldHighlight = hasError && input && !input.checked && !input.disabled;

    checkmark?.classList.toggle('field-error', !!shouldHighlight);
  });
}

export function showFieldError(fieldElement, message = '') {
  const errorElement = getFieldErrorElement(fieldElement);

  if (!errorElement) {
    return;
  }

  const fallbackMessage = errorElement.getAttribute('data-required-message')
    || errorElement.getAttribute('data-pattern-message')
    || errorElement.textContent
    || '';

  errorElement.textContent = message || fallbackMessage;
  errorElement.classList.remove('visibility-none');
  getInteractiveControl(fieldElement)?.setAttribute('aria-invalid', 'true');
  fieldElement.classList.add('field-error');
  fieldElement.querySelector('.cmp-form-text__wrapper')?.classList.add('field-error');
  fieldElement.querySelector('.cmp-form-text__label')?.classList.add('field-error');
  fieldElement.querySelector('.cmp-form-options__label')?.classList.add('field-error');
  fieldElement.querySelector('.yamaha-checkbox__title')?.classList.add('field-error');
  updateCheckboxErrorState(fieldElement, true);
  fieldElement.querySelector('.yamaha-select__value')?.classList.add('field-error');
  fieldElement.querySelector('.postcode-search__title')?.classList.add('field-error');
  fieldElement.querySelector('.postcode-search__value')?.classList.add('field-error');
}

export function clearFieldError(fieldElement) {
  const errorElement = getFieldErrorElement(fieldElement);

  if (!errorElement) {
    return;
  }

  errorElement.classList.add('visibility-none');
  getInteractiveControl(fieldElement)?.setAttribute('aria-invalid', 'false');
  fieldElement.classList.remove('field-error');
  fieldElement.querySelector('.cmp-form-text__wrapper')?.classList.remove('field-error');
  fieldElement.querySelector('.cmp-form-text__label')?.classList.remove('field-error');
  fieldElement.querySelector('.cmp-form-options__label')?.classList.remove('field-error');
  fieldElement.querySelector('.yamaha-checkbox__title')?.classList.remove('field-error');
  updateCheckboxErrorState(fieldElement, false);
  fieldElement.querySelector('.yamaha-select__value')?.classList.remove('field-error');
  fieldElement.querySelector('.postcode-search__title')?.classList.remove('field-error');
  fieldElement.querySelector('.postcode-search__value')?.classList.remove('field-error');
}

function createErrorElement(tagName, className, field, attrs = {}) {
  const errorElement = createElement(tagName, {
    className: `${className} visibility-none`,
    attrs,
  });

  applyErrorMessageAttributes(errorElement, field);
  return errorElement;
}

function createTextLabel(field, id) {
  if (field.hideLabel) {
    return null;
  }

  const label = createElement('label', {
    className: 'cmp-form-text__label',
    attrs: {
      for: id,
    },
  });

  setContent(label, field.label || '');

  if (field.required) {
    appendRequiredMarker(label, 'cmp-form-text__label-required');
  }

  return label;
}

function createHelpMessage(id, message) {
  if (!hasRenderableText(message)) {
    return null;
  }

  return createElement('div', {
    className: 'cmp-form-text__help-message-below',
    html: message,
    attrs: {
      id: `${id}-helpMessage`,
    },
  });
}

function getTextFieldHelpMessage(field) {
  return field.helpMessageBelow || (!field.displayHelpMessageAsPlaceholder ? field.helpMessage : '');
}

function getInputMode(field) {
  if (field.inputType === 'tel' || ['phone', 'au-mobile', 'nz-mobile'].includes(field.validation)) {
    return 'tel';
  }

  if (['number', 'only-numbers', 'postcode'].includes(field.inputType) || ['only-numbers', 'postcode'].includes(field.validation)) {
    return 'numeric';
  }

  if (field.inputType === 'email' || field.validation === 'email') {
    return 'email';
  }

  return null;
}

function createTextInput(field, id, errorId) {
  const maxLength = field.maxLength || getMaxLengthForValidation(field.validation);
  const helpMessage = getTextFieldHelpMessage(field);
  const describedBy = [hasRenderableText(helpMessage) ? `${id}-helpMessage` : '', errorId].filter(Boolean).join(' ');

  return createElement('input', {
    className: 'cmp-form-text__wrapper-text form-input',
    attrs: {
      type: field.inputType || field.fieldType || 'text',
      id,
      name: field.name,
      'aria-label': field.hideLabel ? field.label : null,
      placeholder: field.placeholder || '',
      value: field.value || '',
      readonly: field.readOnly,
      required: field.required,
      maxlength: maxLength,
      inputmode: getInputMode(field),
      autocomplete: getAutocomplete(field),
      spellcheck: 'true',
      'aria-describedby': describedBy || null,
      'aria-invalid': 'false',
      'data-required': field.required ? 'true' : null,
      'data-validation-type': field.validation && field.validation !== 'none' ? field.validation : null,
    },
  });
}

function renderTextField(field, context) {
  const wrapper = createGridFieldWrapper('text', context);
  const content = createElement('div', {
    className: 'cmp-form-text',
  });
  const id = getFieldId(context, 'form-text', field);
  const errorId = `${id}-error`;
  const inputWrapper = createElement('div', {
    className: 'cmp-form-text__wrapper',
  });
  const label = createTextLabel(field, id);

  if (label) {
    content.appendChild(label);
  }

  inputWrapper.appendChild(createTextInput(field, id, errorId));
  content.appendChild(inputWrapper);

  const helpMessageBelow = createHelpMessage(id, getTextFieldHelpMessage(field));
  if (helpMessageBelow) {
    content.appendChild(helpMessageBelow);
  }

  content.appendChild(createErrorElement('p', 'cmp-form-text__error', field, { id: errorId, 'aria-live': 'polite' }));
  wrapper.appendChild(content);

  return wrapper;
}

function renderTextarea(field, context) {
  const wrapper = createGridFieldWrapper('text', context);
  const content = createElement('div', {
    className: 'cmp-form-text',
  });
  const id = getFieldId(context, 'form-text', field);
  const errorId = `${id}-error`;
  const helpMessage = getTextFieldHelpMessage(field);
  const inputWrapper = createElement('div', {
    className: 'cmp-form-text__wrapper',
  });
  const textarea = createElement('textarea', {
    className: 'cmp-form-text__wrapper-textarea form-textarea',
    attrs: {
      id,
      name: field.name,
      'aria-label': field.hideLabel ? field.label : null,
      readonly: field.readOnly,
      required: field.required,
      rows: field.rows || 2,
      maxlength: field.maxLength || null,
      placeholder: field.placeholder || '',
      autocomplete: 'off',
      spellcheck: 'true',
      'aria-describedby': [hasRenderableText(helpMessage) ? `${id}-helpMessage` : '', errorId].filter(Boolean).join(' ') || null,
      'aria-invalid': 'false',
      'data-required': field.required ? 'true' : null,
      'data-validation-type': field.validation && field.validation !== 'none' ? field.validation : null,
    },
  });

  textarea.value = field.value || '';

  const label = createTextLabel(field, id);
  if (label) {
    content.appendChild(label);
  }

  inputWrapper.appendChild(textarea);

  if (field.maxLength) {
    const limit = createElement('div', {
      className: 'cmp-form-text__wrapper-limit',
      html: `<span class="word-count">0</span>/${field.maxLength}`,
    });
    inputWrapper.appendChild(limit);
  }

  content.appendChild(inputWrapper);

  const helpMessageBelow = createHelpMessage(id, helpMessage);
  if (helpMessageBelow) {
    content.appendChild(helpMessageBelow);
  }

  content.appendChild(createErrorElement('p', 'cmp-form-text__error', field, { id: errorId, 'aria-live': 'polite' }));
  wrapper.appendChild(content);

  return wrapper;
}

function getDropdownDisplayLabel(field) {
  const selectedOption = field.options?.find((option) => option.selected);
  const disabledOption = field.options?.find((option) => option.disabled);
  const firstOption = field.options?.[0];
  const fallback = selectedOption || disabledOption || firstOption;

  return fallback?.label || 'Select option';
}

function renderDropdown(field, context) {
  if (!(field.options || []).length) {
    return null;
  }

  const wrapper = createGridFieldWrapper('options', context);
  const fieldsetId = getFieldId(context, 'form-options', field);
  const labelId = `${fieldsetId}-label`;
  const helpId = hasRenderableText(field.helpMessage) ? `${fieldsetId}-helpMessage` : '';
  const errorId = `${fieldsetId}-error`;
  const listId = `${fieldsetId}-listbox`;
  const selectedOption = field.options?.find((option) => option.selected);
  const initialValue = selectedOption?.value || selectedOption?.label || '';
  const fieldset = createElement('fieldset', {
    className: 'cmp-form-options cmp-form-options--drop-down',
    attrs: {
      id: fieldsetId,
    },
  });

  const label = field.hideLabel ? null : createElement('span', {
    className: 'cmp-form-options__label',
    attrs: {
      id: labelId,
    },
  });

  if (label) {
    setContent(label, field.label || '');

    if (field.required) {
      appendRequiredMarker(label, 'cmp-form-options__label-required');
    }
  }

  const select = createElement('div', {
    className: 'yamaha-select',
    attrs: {
      name: field.name,
      id: `${fieldsetId}-control`,
      tabindex: '0',
      role: 'combobox',
      'aria-haspopup': 'listbox',
      'aria-controls': listId,
      'aria-expanded': 'false',
      'aria-labelledby': field.hideLabel ? null : labelId,
      value: initialValue || null,
      'aria-label': field.hideLabel ? field.label : null,
      'aria-describedby': [helpId, errorId].filter(Boolean).join(' ') || null,
      'aria-invalid': 'false',
      'data-required': field.required ? 'true' : null,
    },
  });

  const value = createElement('div', {
    className: 'yamaha-select__value',
  });
  value.appendChild(createElement('span', {
    className: 'yamaha-select__value-label',
    text: getDropdownDisplayLabel(field),
  }));
  value.appendChild(createElement('i', {
    className: 'yamaha-select__value-icon icon icon-outline-chevron-down',
  }));

  const menu = createElement('div', {
    className: 'yamaha-select__menu',
  });
  const list = createElement('ul', {
    className: 'yamaha-select__menu-list',
    attrs: {
      role: 'listbox',
      id: listId,
      'aria-label': 'Select option',
      'aria-expanded': 'false',
      tabindex: '-1',
    },
  });

  (field.options || []).forEach((option) => {
    const item = createElement('li', {
      className: `yamaha-select__menu-list-option${option.selected ? ' selected' : ''}`,
      attrs: {
        role: 'option',
        tabindex: '-1',
        value: option.value || option.label,
        'aria-selected': option.selected ? 'true' : 'false',
        'data-disabled': option.disabled ? 'true' : 'false',
        'data-default-selected': option.selected ? 'true' : 'false',
      },
    });
    setContent(item, option.label || option.value || '');
    list.appendChild(item);
  });

  menu.appendChild(list);
  select.append(value, menu);
  if (label) {
    fieldset.appendChild(label);
  }
  fieldset.appendChild(select);

  const helpMessage = createHelpMessage(fieldsetId, field.helpMessage);
  if (helpMessage) {
    fieldset.appendChild(helpMessage);
  }

  fieldset.appendChild(createErrorElement('p', 'cmp-form-option__error', field, { id: errorId, 'aria-live': 'polite' }));
  wrapper.appendChild(fieldset);

  return wrapper;
}

function isSingleCheckboxField(field) {
  return field.fieldType === 'checkbox' && (field.options || []).length <= 1;
}

function createRadioOrCheckboxInput(option, field, inputType, id = '') {
  return createElement('input', {
    className: 'yamaha-checkbox__field-checkbox',
    attrs: {
      id: id || null,
      name: field.name,
      value: option.value || option.label || 'true',
      type: inputType,
      checked: option.selected,
      disabled: option.disabled,
    },
  });
}

function createCheckboxCheckmark() {
  return createElement('span', {
    className: 'yamaha-checkbox__field-checkmark checkbox',
    attrs: {
      tabindex: '0',
    },
  });
}

function appendCheckboxLabelContent(label, field, option = {}) {
  if (field.required) {
    appendRequiredMarker(label, 'yamaha-checkbox__title-required');
  }

  const labelText = option.label || (field.label && field.label !== field.name ? field.label : '');
  if (!labelText) {
    return;
  }

  const labelContent = createElement('span');
  setContent(labelContent, labelText);
  label.appendChild(labelContent);
}

function createCheckboxFieldRow(field, option, inputId) {
  const fieldRow = createElement('div', {
    className: `yamaha-checkbox__field${option.disabled ? ' yamaha-react-checkbox__field-disabled' : ''}`,
  });
  const label = createElement('span', {
    className: 'yamaha-checkbox__field-label',
  });

  fieldRow.appendChild(createRadioOrCheckboxInput(option, field, 'checkbox', inputId));
  fieldRow.appendChild(createCheckboxCheckmark());
  appendCheckboxLabelContent(label, field, option);
  fieldRow.appendChild(label);

  return fieldRow;
}

function renderSingleCheckboxField(field, context) {
  if (!(field.options || []).length) {
    return null;
  }

  const wrapper = createGridFieldWrapper('options', context);
  const fieldsetId = getFieldId(context, 'form-options', field);
  const helpId = hasRenderableText(field.helpMessage) ? `${fieldsetId}-helpMessage` : '';
  const errorId = `${fieldsetId}-error`;
  const fieldset = createElement('fieldset', {
    className: 'cmp-form-options cmp-form-options--checkbox',
    attrs: {
      id: fieldsetId,
      'data-required': field.required ? 'true' : null,
    },
  });
  const checkbox = createElement('div', {
    className: 'yamaha-checkbox',
  });
  const content = createElement('div', {
    className: 'yamaha-checkbox__content core-form-checkbox',
    attrs: {
      'aria-required': field.required ? 'true' : null,
      'aria-label': field.name || field.label || null,
      'aria-describedby': [helpId, errorId].filter(Boolean).join(' ') || null,
      'aria-invalid': 'false',
    },
  });
  const option = field.options[0];
  const inputId = `${fieldsetId}-option-0`;
  content.appendChild(createCheckboxFieldRow(field, option, inputId));
  checkbox.append(content);

  const helpMessage = createHelpMessage(fieldsetId, field.helpMessage);
  if (helpMessage) {
    checkbox.appendChild(helpMessage);
  }

  checkbox.appendChild(createErrorElement('p', 'yamaha-checkbox__error', field, { id: errorId, 'aria-live': 'polite' }));
  fieldset.appendChild(checkbox);
  wrapper.appendChild(fieldset);

  return wrapper;
}

function renderCheckboxGroup(field, context) {
  if (!(field.options || []).length) {
    return null;
  }

  const wrapper = createGridFieldWrapper('options', context);
  const fieldsetId = getFieldId(context, 'form-options', field);
  const helpId = hasRenderableText(field.helpMessage) ? `${fieldsetId}-helpMessage` : '';
  const errorId = `${fieldsetId}-error`;
  const fieldset = createElement('fieldset', {
    className: 'cmp-form-options cmp-form-options--checkbox',
    attrs: {
      id: fieldsetId,
      'data-required': field.required ? 'true' : null,
    },
  });
  const checkbox = createElement('div', {
    className: 'yamaha-checkbox',
  });
  const legend = field.hideLabel ? null : createElement('legend', {
    className: 'yamaha-checkbox__title',
  });

  if (legend) {
    setContent(legend, field.label || '');

    if (field.required) {
      appendRequiredMarker(legend, 'yamaha-checkbox__title-required');
    }

    checkbox.appendChild(legend);
  }

  const content = createElement('div', {
    className: 'yamaha-checkbox__content core-form-checkbox',
    attrs: {
      'aria-required': field.required ? 'true' : null,
      'aria-label': field.name || field.label || null,
      'aria-describedby': [helpId, errorId].filter(Boolean).join(' ') || null,
      'aria-invalid': 'false',
    },
  });

  (field.options || []).forEach((option, index) => {
    const inputId = `${fieldsetId}-option-${index}`;
    content.appendChild(createCheckboxFieldRow(field, option, inputId));
  });

  checkbox.appendChild(content);

  const helpMessage = createHelpMessage(fieldsetId, field.helpMessage);
  if (helpMessage) {
    checkbox.appendChild(helpMessage);
  }

  checkbox.appendChild(createErrorElement('p', 'yamaha-checkbox__error', field, { id: errorId, 'aria-live': 'polite' }));
  fieldset.appendChild(checkbox);
  wrapper.appendChild(fieldset);

  return wrapper;
}

function renderOptionsField(field, context) {
  if (field.optionType === 'checkboxes') {
    if (isSingleCheckboxField(field)) {
      return renderSingleCheckboxField(field, context);
    }

    return renderCheckboxGroup(field, context);
  }

  return renderDropdown(field, context);
}

function renderPostcode(field, context) {
  const wrapper = createGridFieldWrapper('postcodesearch', context);
  const inputId = getFieldId(context, 'postcode-search', field);
  const errorId = `${inputId}-error`;
  const postcode = createElement('div', {
    className: 'postcode-search',
  });
  const title = createElement('label', {
    className: 'postcode-search__title',
    attrs: {
      for: inputId,
    },
  });

  setContent(title, field.label || 'Postcode');
  appendRequiredMarker(title, 'postcode-search__title-required');

  const valueWrapper = createElement('div', {
    className: 'cmp-form-text__wrapper postcode-search__value',
  });
  const input = createElement('input', {
    className: 'cmp-form-text__wrapper-text postcode-search__input',
    attrs: {
      type: 'text',
      id: inputId,
      name: field.name || 'postCode',
      required: field.required,
      maxlength: getMaxLengthForValidation(field.validation || 'postcode'),
      inputmode: 'numeric',
      autocomplete: getAutocomplete(field),
      'aria-describedby': errorId,
      'aria-invalid': 'false',
      'data-required': field.required ? 'true' : null,
      'data-validation-type': field.validation || 'postcode',
    },
  });

  valueWrapper.append(input);
  postcode.append(
    title,
    valueWrapper,
    createErrorElement('span', 'cmp-form-text__error', field, { id: errorId, 'aria-live': 'polite' }),
  );
  wrapper.appendChild(postcode);

  return wrapper;
}

function renderInfo(field, context) {
  const wrapper = createGridFieldWrapper('information', context);
  const content = createElement('div', {
    className: 'cmp-information__wrapper',
  });

  if (field.icon) {
    const icon = createElement('div', {
      className: 'cmp-information__icon',
    });
    icon.appendChild(createElement('i', {
      className: 'icon icon-outline-information-circle',
      attrs: {
        'aria-hidden': 'true',
      },
    }));
    content.appendChild(icon);
  }

  content.appendChild(createElement('div', {
    className: 'cmp-information__text',
    html: field.content || '',
  }));
  wrapper.appendChild(content);

  return wrapper;
}

function renderHidden(field, context) {
  const inputId = getFieldId(context, 'form-hidden', field);
  return createElement('input', {
    attrs: {
      type: 'hidden',
      id: inputId,
      name: field.name,
      value: field.value || '',
    },
  });
}

function renderButton(field, context) {
  const cta = createCTAElement({
    type: 'primary',
    theme: 'brand',
    size: 'medium',
    parentClass: 'cmp-form__button',
    ctaClass: 'cmp-form-button',
    label: field.label || 'Submit',
  });
  const button = cta?.querySelector('.cmp-button');

  if (button) {
    button.type = (field.action || 'submit').toUpperCase();
    button.id = getFieldId(context, 'form-button', field);
    button.disabled = true;
    button.dataset.defaultLabel = field.label || 'Submit';
    if (field.name) {
      button.name = field.name;
    }
    if (field.value) {
      button.value = field.value;
    }
  }

  return cta;
}

function renderField(field, context) {
  if (!field || !field.type) {
    return null;
  }

  const finalizeFieldElement = (element) => {
    if (field.layoutClass && element?.classList?.contains('cmp-form__field')) {
      element.classList.add(field.layoutClass);
    }

    return applyFieldInstrumentation(field, element);
  };

  if (field.type === 'button') {
    return finalizeFieldElement(renderButton(field, context));
  }

  if (field.type === 'hidden') {
    return finalizeFieldElement(renderHidden(field, context));
  }

  if (field.type === 'info') {
    return finalizeFieldElement(renderInfo(field, context));
  }

  if (field.type !== 'field') {
    return null;
  }

  const rendererByFieldType = {
    textarea: renderTextarea,
    dropdown: renderDropdown,
    checkbox: renderOptionsField,
    postcode: renderPostcode,
  };

  const renderer = rendererByFieldType[field.fieldType] || renderTextField;
  return finalizeFieldElement(renderer(field, context));
}

function createFeedback(parsed) {
  const feedback = createElement('div', {
    className: 'cmp-form-feedback display-none',
  });
  const feedbackBody = createElement('div', {
    className: 'cmp-form-feedback__body',
  });
  const feedbackHeader = createElement('div', {
    className: 'cmp-form-feedback__header',
  });
  const imagePath = parsed.config.image;
  const altText = parsed.config.imageAlt || 'Thank you image';
  const successMessage = parsed.config.successMessage || '';
  const buttonLabel = parsed.config.thankYouButtonLabel || 'Submit Again';

  if (imagePath) {
    const imageContent = createFragmentFromHTML(imagePath);

    if (imageContent) {
      imageContent.classList.add('cmp-form-feedback__img');
      imageContent.querySelector('img')?.setAttribute('alt', altText);
      feedbackHeader.appendChild(imageContent);
    } else {
      feedbackHeader.appendChild(createElement('img', {
        className: 'cmp-form-feedback__img',
        attrs: {
          src: imagePath,
          alt: altText,
        },
      }));
    }
  }

  const feedbackContent = createElement('div', {
    className: 'cmp-form-feedback__content',
    html: successMessage,
  });
  moveFeedbackHeading(feedbackContent, feedbackHeader);

  if (feedbackHeader.childElementCount) {
    feedbackBody.appendChild(feedbackHeader);
  }

  feedbackBody.appendChild(feedbackContent);
  feedback.appendChild(feedbackBody);

  const action = createCTAElement({
    parentClass: 'cmp-form-feedback__action',
    type: 'secondary',
    theme: 'brand',
    size: 'medium',
    label: buttonLabel,
  });

  action?.querySelector('.cmp-button')?.setAttribute('type', 'button');
  if (action) {
    feedback.appendChild(action);
  }

  return feedback;
}

function createGridLayout(fields, context) {
  const fragment = document.createDocumentFragment();
  const layout = createElement('div', {
    className: 'cmp-form__layout',
  });
  const column = createElement('div', {
    className: 'cmp-form__column cmp-form__column--primary',
  });

  fields.forEach((field) => {
    const element = renderField(field, context);
    if (element) {
      column.appendChild(element);
    }
  });

  layout.appendChild(column);
  fragment.appendChild(layout);

  return fragment;
}

function createForm(parsed) {
  const formId = getFormId(parsed);
  const title = parsed.config.title || '';
  const form = createElement('form', {
    className: 'cmp-form',
    attrs: {
      id: formId || null,
      name: formId || null,
      'data-title': title || null,
      'data-generated-form': 'true',
    },
  });

  form.noValidate = true;
  form.formConfig = parsed.config;

  return { form, formId, title };
}

function renderForm(block) {
  block.querySelector(':scope > form[data-generated-form="true"]')?.remove();
  const isUE = block.hasAttribute('data-aue-resource');
  const authoredRows = Array.from(block.children || []).filter((child) => child?.tagName === 'DIV');

  const setAuthoredRowsPreviewState = (isPreview) => {
    authoredRows.forEach((row) => {
      row.classList.toggle(UE_AUTHORED_ROW_HIDDEN_CLASS, isPreview);

      if (isPreview) {
        row.setAttribute(UE_AUTHORED_ROW_ATTR, 'true');
      } else {
        row.removeAttribute(UE_AUTHORED_ROW_ATTR);
      }
    });
  };

  setAuthoredRowsPreviewState(false);

  const parsed = parseUEForm(block, 'forms');

  if (!parsed || !Array.isArray(parsed.fields) || !parsed.fields.length) {
    return null;
  }

  applyFormConfigClasses(block, parsed);

  const { form, title } = createForm(parsed);
  const context = {
    uniqueId: createUniqueId(),
    nextIndex: 1,
  };
  const feedback = createFeedback(parsed);
  const body = createElement('div', {
    className: 'cmp-form__body',
  });

  if (title && !isEnabled(parsed.config.hideTitle || parsed.config.fromsHidetitle)) {
    body.appendChild(createElement('h5', {
      className: 'cmp-form__title',
      text: title,
    }));
  }

  body.appendChild(createGridLayout(parsed.fields, context));

  form.append(feedback, body);
  initDropdowns(form);
  initSelectableFields(form);
  initTextareaCounters(form);

  if (isUE) {
    setAuthoredRowsPreviewState(true);
    block.append(form);
  } else {
    block.replaceChildren(form);
  }

  return form;
}

export default function initForms(block) {
  if (!block) {
    return null;
  }

  return renderForm(block);
}
