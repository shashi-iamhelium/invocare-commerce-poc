import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { getMetadata } from '../../../../scripts/aem.js';
import { showFieldError } from '../forms-helper/form-fields-renderer.js';
import { updateSubmitState } from '../validations/form-validations.js';

const SUBMIT_SELECTOR = '.cmp-form-button';
const FORM_BODY_SELECTOR = '.cmp-form__body';
const FEEDBACK_SELECTOR = '.cmp-form-feedback';
const FEEDBACK_BODY_SELECTOR = '.cmp-form-feedback__body';
const FEEDBACK_CONTENT_SELECTOR = '.cmp-form-feedback__content';
const FEEDBACK_ACTION_SELECTOR = '.cmp-form-feedback__action .cmp-button';
const MESSAGE_SELECTOR = '[data-form-submit-message]';
const GENERATED_INPUT_ATTR = 'data-form-generated-input';
const ERROR_BUTTON_ICON_SELECTOR = '[data-form-submit-error-icon]';
const ERROR_BUTTON_ICON_CLASS = 'cmp-button__icon icon icon-outline-exclamation right';
const ERROR_BUTTON_CLASS = 'cmp-form-button--error';
const FEEDBACK_SCROLL_OFFSET = 100;

function getSubmitButton(form) {
  return form.querySelector(SUBMIT_SELECTOR);
}

function getFormConfig(form) {
  return form.formConfig || {};
}

function getSubmitButtonLabelElement(form) {
  return form.querySelector(`${SUBMIT_SELECTOR} .cmp-button__text`);
}

function setSubmitButtonLabel(form, label) {
  const labelElement = getSubmitButtonLabelElement(form);

  if (labelElement && label) {
    labelElement.textContent = label;
  }
}

function removeErrorButtonIcon(button) {
  button?.querySelector(ERROR_BUTTON_ICON_SELECTOR)?.remove();
}

function appendErrorButtonIcon(button) {
  if (!button || button.querySelector(ERROR_BUTTON_ICON_SELECTOR)) {
    return;
  }

  const icon = document.createElement('i');
  icon.className = ERROR_BUTTON_ICON_CLASS;
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('data-form-submit-error-icon', 'true');
  button.append(icon);
}

function resetErrorButtonState(form) {
  const button = getSubmitButton(form);

  if (!button) {
    return;
  }

  button.classList.remove('field-error');
  button.classList.remove(ERROR_BUTTON_CLASS);
  removeErrorButtonIcon(button);
  setSubmitButtonLabel(form, button.dataset.defaultLabel || 'Submit');
}

function getPageCountry() {
  return (getMetadata('country') || 'au').trim().toLowerCase();
}

function getPayloadCountry(country) {
  return country === 'nz' ? 'NZ' : 'AU';
}

function getPhoneFieldName(country) {
  return `${country === 'nz' ? 'nz' : 'au'}-phone`;
}

function normalizeBackendFieldName(fieldName = '') {
  const normalized = String(fieldName).trim().toLowerCase();

  if (normalized === 'au-phone' || normalized === 'nz-phone') {
    return 'phone';
  }

  if (normalized === 'postcode') {
    return 'postCode';
  }

  return fieldName;
}

function markBackendFieldError(fieldElement, message = '') {
  if (!fieldElement) {
    return;
  }

  if (message) {
    fieldElement.dataset.backendErrorMessage = message;
  } else {
    delete fieldElement.dataset.backendErrorMessage;
  }
}

function getFocusableFieldControl(fieldElement) {
  return fieldElement?.querySelector('.yamaha-select[tabindex], input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
}

function focusFirstFieldError(form, errors = []) {
  const orderedFields = errors
    .map(({ fieldName, name }) => normalizeBackendFieldName(fieldName || name))
    .map((resolvedFieldName) => form.querySelector(`[name="${resolvedFieldName}"]`)?.closest('.cmp-form__field'))
    .filter(Boolean);

  const firstField = orderedFields[0] || form.querySelector('.cmp-form__field.field-error');
  const control = getFocusableFieldControl(firstField);

  if (!firstField || !control) {
    return;
  }

  firstField.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  window.requestAnimationFrame(() => {
    control.focus({ preventScroll: true });
  });
}

function extractListValues(value, preferredKey = '') {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractListValues(item, preferredKey)).filter(Boolean);
  }

  if (typeof value === 'object') {
    if (preferredKey && value[preferredKey]) {
      return extractListValues(value[preferredKey], preferredKey);
    }

    const preferredValue = ['value', 'name', 'label', 'text', 'title', 'email']
      .map((key) => value[key])
      .find(Boolean);

    if (preferredValue) {
      return extractListValues(preferredValue, preferredKey);
    }

    return Object.values(value)
      .flatMap((item) => extractListValues(item, preferredKey))
      .filter(Boolean);
  }

  if (value.includes('<li') && typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = value;
    const items = [...container.querySelectorAll('li')]
      .map((item) => item.textContent?.trim())
      .filter(Boolean);

    if (items.length) {
      return items;
    }
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function removeGeneratedInputs(form, source) {
  form.querySelectorAll(`input[type="hidden"][${GENERATED_INPUT_ATTR}="${source}"]`).forEach((input) => input.remove());
}

function createMessageElement(message, assistanceMessage = '', variant = 'error') {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-form-submit-message', 'true');

  const iconClass = variant === 'error'
    ? 'icon icon-solid-x-circle'
    : 'icon icon-solid-warning';

  wrapper.className = `information cmp-form-submit-message cmp-form-submit-message--${variant}`;
  wrapper.innerHTML = `
    <div class="cmp-information__wrapper cmp-form-submit-message__wrapper">
      <i class="cmp-form-submit-message__icon ${iconClass}" aria-hidden="true"></i>
      <div class="cmp-information__text cmp-form-submit-message__content">
        <div class="cmp-form-submit-message__main"></div>
      </div>
    </div>

    ${assistanceMessage
    ? '<div class="cmp-form-submit-assistance cmp-form-submit-message__assistance"></div>'
    : ''}
  `;

  wrapper.querySelector('.cmp-form-submit-message__main').innerHTML = message;
  if (assistanceMessage) {
    wrapper.querySelector('.cmp-form-submit-assistance').innerHTML = assistanceMessage;
  }

  return wrapper;
}

function clearSubmitMessage(form) {
  form.querySelector(MESSAGE_SELECTOR)?.remove();
}

function hasRenderableFeedbackContent(element) {
  return !!element && !!element.textContent?.trim();
}

function getSuccessScrollTarget(form) {
  return form.querySelector(`${FEEDBACK_BODY_SELECTOR} > *`)
    || form.querySelector(`${FEEDBACK_CONTENT_SELECTOR} > *`)
    || form.querySelector(FEEDBACK_BODY_SELECTOR)
    || form.querySelector(FEEDBACK_CONTENT_SELECTOR)
    || form.querySelector(FEEDBACK_SELECTOR)
    || form;
}

function getSuccessFocusTarget(form) {
  return form.querySelector(FEEDBACK_CONTENT_SELECTOR)
    || form.querySelector(FEEDBACK_SELECTOR)
    || form;
}

function focusSuccessContent(form) {
  const scrollTarget = getSuccessScrollTarget(form);
  const focusTarget = getSuccessFocusTarget(form);

  if (!scrollTarget || !focusTarget) {
    return;
  }

  focusTarget.setAttribute('tabindex', '-1');

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const header = document.querySelector('header');
      const headerOffset = header ? header.getBoundingClientRect().height : 0;
      const targetTop = scrollTarget.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: Math.max(0, targetTop - headerOffset - FEEDBACK_SCROLL_OFFSET),
        behavior: 'smooth',
      });

      window.setTimeout(() => {
        focusTarget.focus({ preventScroll: true });
      }, 100);
    });
  });
}

function showSuccessFeedback(form, message) {
  const feedback = form.querySelector(FEEDBACK_SELECTOR);
  const body = form.querySelector(FORM_BODY_SELECTOR);
  const content = feedback?.querySelector(FEEDBACK_CONTENT_SELECTOR);
  const successMessage = getFormConfig(form).successMessage || message || '';

  clearSubmitMessage(form);
  resetErrorButtonState(form);

  if (content && successMessage && !hasRenderableFeedbackContent(content)) {
    content.innerHTML = successMessage;
  }

  feedback?.classList.remove('display-none');
  body?.classList.add('display-none');
  focusSuccessContent(form);
}

function hideSuccessFeedback(form) {
  const feedback = form.querySelector(FEEDBACK_SELECTOR);
  const body = form.querySelector(FORM_BODY_SELECTOR);

  feedback?.classList.add('display-none');
  body?.classList.remove('display-none');
}

function showSubmitMessage(form, message, assistanceMessage = '', variant = 'error') {
  if (!message) {
    return;
  }

  clearSubmitMessage(form);
  hideSuccessFeedback(form);
  const submitButton = getSubmitButton(form);
  const messageElement = createMessageElement(message, assistanceMessage, variant);

  submitButton?.parentElement?.insertAdjacentElement('afterend', messageElement);
}

function getWarningDisplayMessage(form, detail = {}) {
  const config = getFormConfig(form);
  return config.warningMessage || config.errorMessage || detail?.message || '';
}

function getErrorDisplayState(form) {
  const config = getFormConfig(form);

  return {
    message: config.errorMessage || '',
    assistanceMessage: config.assistanceMessage || '',
    buttonLabel: config.errorButtonLabel || '',
  };
}

function applyErrorButtonState(form, detail = {}) {
  const { buttonLabel } = getErrorDisplayState(form, detail);
  const button = getSubmitButton(form);

  if (!button || !buttonLabel) {
    return;
  }

  window.requestAnimationFrame(() => {
    button.classList.add('field-error');
    button.classList.add(ERROR_BUTTON_CLASS);
    appendErrorButtonIcon(button);
    setSubmitButtonLabel(form, buttonLabel);
  });
}

function resetDropdownValue(select) {
  const options = [...select.querySelectorAll('.yamaha-select__menu-list-option')];
  const defaultOption = options.find((option) => option.getAttribute('data-default-selected') === 'true')
    || options[0];
  const valueLabel = select.querySelector('.yamaha-select__value-label');

  options.forEach((option) => {
    const isSelected = option === defaultOption;
    option.classList.toggle('selected', isSelected);
    option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  if (!defaultOption) {
    select.removeAttribute('value');
    return;
  }

  select.setAttribute('value', defaultOption.getAttribute('value') || defaultOption.textContent.trim());
  if (valueLabel) {
    valueLabel.textContent = defaultOption.textContent.trim();
  }
}

function resetSelectableStates(form) {
  form.querySelectorAll('.yamaha-checkbox__field-checkbox').forEach((input) => {
    const field = input.closest('.yamaha-checkbox__field');
    const checkmark = field?.querySelector('.yamaha-checkbox__field-checkmark');
    const isActive = !!input.checked;

    checkmark?.classList.toggle('active', isActive);
  });
}

function resetTextareaCounters(form) {
  form.querySelectorAll('.cmp-form-text__wrapper textarea').forEach((textarea) => {
    const counter = textarea.closest('.cmp-form-text__wrapper')?.querySelector('.word-count');

    if (counter) {
      counter.textContent = String(textarea.value.length);
    }
  });
}

function resetCustomUi(form) {
  form.querySelectorAll('.yamaha-select').forEach((select) => resetDropdownValue(select));
  resetSelectableStates(form);
  resetTextareaCounters(form);
}

function bindFeedbackReset(form) {
  if (!form || form.dataset.feedbackResetInitialized === 'true') {
    return;
  }

  form.dataset.feedbackResetInitialized = 'true';

  form.querySelector(FEEDBACK_ACTION_SELECTOR)?.addEventListener('click', (event) => {
    event.preventDefault();
    form.reset();
    removeGeneratedInputs(form, 'dropdown');
    removeGeneratedInputs(form, 'recaptcha');
    clearSubmitMessage(form);
    hideSuccessFeedback(form);
    form.querySelectorAll('.field-error').forEach((element) => element.classList.remove('field-error'));
    form.querySelectorAll('[aria-invalid="true"]').forEach((element) => element.setAttribute('aria-invalid', 'false'));
    form.querySelectorAll('.cmp-form-text__error, .cmp-form-option__error, .yamaha-checkbox__error')
      .forEach((element) => element.classList.add('visibility-none'));
    getSubmitButton(form)?.classList.remove('loading');
    resetErrorButtonState(form);
    resetCustomUi(form);
    updateSubmitState(form);
  });
}

function appendConfigList(params, key, value, configKey = '') {
  extractListValues(value, configKey).forEach((item) => params.append(key, item));
}

function buildSubmissionParams(form, formData) {
  const config = getFormConfig(form);
  const country = getPageCountry();
  const payloadCountry = getPayloadCountry(country);
  const phoneFieldName = getPhoneFieldName(country);
  const params = new URLSearchParams();
  const formValues = [...formData.entries()].reduce((entries, [key, value]) => {
    const existing = entries.get(key) || [];
    existing.push(String(value));
    entries.set(key, existing);
    return entries;
  }, new Map());

  [...formValues.entries()].forEach(([key, values]) => {
    const value = values.length > 1 ? values.join(',') : values[0];

    if (key === 'phone') {
      params.append(phoneFieldName, value);
      return;
    }

    if (key.toLowerCase() === 'postcode') {
      params.append('postCode', value);
      return;
    }

    if (key === 'country') {
      params.append('country', payloadCountry);
      return;
    }

    params.append(key, value);
  });

  if (!params.has('country')) {
    params.append('country', payloadCountry);
  }

  params.append('subject', config['mail-subject'] || config['action-type-yamaha-mail-subject'] || '');
  params.append('id', form.id || config['form-id'] || 'whitelabel-form');
  appendConfigList(params, 'from', config['mail-from'] || config['action-type-yamaha-mail-from'], 'mail-from');
  appendConfigList(params, 'mailto', config['mail-to'] || config['action-type-yamaha-mail-to'], 'mail-to');
  appendConfigList(params, 'cc', config['mail-cc'] || config['action-type-yamaha-mail-cc'], 'mail-cc');
  appendConfigList(params, 'bcc', config['mail-bcc'] || config['action-type-yamaha-mail-bcc'], 'mail-bcc');

  return params;
}

async function getSubmissionUrl() {
  const formsEndpoint = await getConfigValue('forms-endpoint') || window.location.origin;
  return new URL('/whitelabel/forms/mail', formsEndpoint).toString();
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function applyFieldErrors(form, errors = []) {
  errors.forEach(({
    fieldName, errorMessage, name, message,
  }) => {
    const resolvedFieldName = normalizeBackendFieldName(fieldName || name);
    const field = form.querySelector(`[name="${resolvedFieldName}"]`)?.closest('.cmp-form__field');

    if (field) {
      const fieldMessage = errorMessage || message || '';
      markBackendFieldError(field, fieldMessage);
      showFieldError(field, fieldMessage);
    }
  });

  focusFirstFieldError(form, errors);
}

export async function submitForm(form, formData) {
  const params = buildSubmissionParams(form, formData);
  const response = await fetch(await getSubmissionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const responseData = await parseResponse(response);
  const resultStatus = Number(responseData?.status || response.status || 0);

  if (!response.ok) {
    applyFieldErrors(form, responseData?.errors);
    const error = new Error(
      responseData?.errors?.[0]?.errorMessage
        || responseData?.errors?.[0]?.message
        || '',
    );
    error.status = response.status;
    error.errorCode = responseData?.status || response.status || '';
    error.errorType = responseData?.message || '';
    error.responseData = responseData;
    throw error;
  }

  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    applyFieldErrors(form, responseData.errors);
  }

  return {
    status: response.status,
    resultStatus,
    message: getFormConfig(form).successMessage || responseData?.message || '',
    responseData,
  };
}

export default function initFormSubmission(form) {
  if (!form) {
    return;
  }

  bindFeedbackReset(form);

  form.addEventListener('submit', () => {
    clearSubmitMessage(form);
    resetErrorButtonState(form);
  });

  form.addEventListener('form-success', (event) => {
    showSuccessFeedback(form, event.detail?.message || '');
  });

  form.addEventListener('form-warning', (event) => {
    resetErrorButtonState(form);
    showSubmitMessage(form, getWarningDisplayMessage(form, event.detail), '', 'warning');
  });

  form.addEventListener('form-error', (event) => {
    const errorDisplay = getErrorDisplayState(form, event.detail);
    showSubmitMessage(form, errorDisplay.message, errorDisplay.assistanceMessage, 'error');
    applyErrorButtonState(form, event.detail);
  });
}
