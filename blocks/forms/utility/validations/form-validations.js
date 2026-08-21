import { clearFieldError, showFieldError } from '../forms-helper/form-fields-renderer.js';
import validationPatterns, {
  getMaxLengthForValidation,
  INPUT_FILTER_REGEX,
} from './validation-patterns.js';

const VALIDATION_PATTERNS = { ...validationPatterns };
const FIELD_SELECTOR = '.cmp-form__field';
const SUBMIT_SELECTOR = '.cmp-form-button';
const NON_VALIDATED_FIELD_CLASSES = ['hidden', 'information'];
const DROPDOWN_SELECTOR = '.yamaha-select';
const OPTION_FIELD_SELECTOR = '.cmp-form-options--checkbox, .cmp-form-options--radio';
const TEXT_CONTROL_SELECTOR = `${FIELD_SELECTOR}.text input, ${FIELD_SELECTOR}.text textarea, ${FIELD_SELECTOR}.postcodesearch input`;
const SUBMIT_LABEL_SELECTOR = `${SUBMIT_SELECTOR} .cmp-button__text`;
const ERROR_BUTTON_ICON_SELECTOR = '[data-form-submit-error-icon]';
const ERROR_BUTTON_CLASS = 'cmp-form-button--error';

function hasFieldErrors(form) {
  return !!form.querySelector(`${FIELD_SELECTOR}.field-error`);
}

function hasBackendFieldError(fieldElement) {
  return !!fieldElement?.dataset?.backendErrorMessage;
}

function clearBackendFieldError(fieldElement) {
  if (fieldElement?.dataset) {
    delete fieldElement.dataset.backendErrorMessage;
  }
}

function clearValidationMessage(form) {
  form.querySelector('[data-form-submit-message]')?.remove();
}

function resetSubmitErrorState(form) {
  const submitButton = form.querySelector(SUBMIT_SELECTOR);

  if (!submitButton?.classList.contains('field-error')) {
    return;
  }

  submitButton.classList.remove('field-error');
  submitButton.classList.remove(ERROR_BUTTON_CLASS);
  submitButton.querySelector(ERROR_BUTTON_ICON_SELECTOR)?.remove();

  const defaultLabel = submitButton.dataset.defaultLabel || 'Submit';
  const labelElement = submitButton.querySelector(SUBMIT_LABEL_SELECTOR);

  if (labelElement) {
    labelElement.textContent = defaultLabel;
  }

  clearValidationMessage(form);
}

function clearValidationMessageIfNoFieldErrors(form) {
  if (!hasFieldErrors(form)) {
    clearValidationMessage(form);
  }
}

function normalizePattern(pattern) {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  return new RegExp(pattern);
}

export function registerValidationPatterns(patterns = {}) {
  Object.entries(patterns).forEach(([name, pattern]) => {
    if (!pattern) {
      return;
    }

    VALIDATION_PATTERNS[name] = normalizePattern(pattern);
  });
}

function getFormFields(form) {
  return [...form.querySelectorAll(FIELD_SELECTOR)]
    .filter((fieldElement) => !NON_VALIDATED_FIELD_CLASSES
      .some((className) => fieldElement.classList.contains(className)));
}

function isRequired(element) {
  return element?.dataset?.required === 'true';
}

function getValidationType(element) {
  return element?.dataset?.validationType || '';
}

function getTextControl(fieldElement) {
  return fieldElement.querySelector('input:not([type="hidden"]), textarea');
}

function getDropdownControl(fieldElement) {
  return fieldElement.querySelector(DROPDOWN_SELECTOR);
}

function getOptionFieldset(fieldElement) {
  return fieldElement.querySelector(OPTION_FIELD_SELECTOR);
}

function getSelectedDropdownOption(select) {
  return select?.querySelector('.yamaha-select__menu-list-option.selected')
    || select?.querySelector('.yamaha-select__menu-list-option[aria-selected="true"]');
}

function getPatternMessage(fieldElement) {
  return fieldElement.querySelector('[data-pattern-message]')?.getAttribute('data-pattern-message') || '';
}

function getRequiredMessage(fieldElement) {
  return fieldElement.querySelector('[data-required-message]')?.getAttribute('data-required-message') || '';
}

function getTextValue(control) {
  return control.value.trim();
}

function getUnrestrictedTextValue(control) {
  return control.value;
}

function normalizePhoneValue(value, validationType) {
  const startsWithPlus = value.trim().startsWith('+');
  let sanitizedValue = value.replace(INPUT_FILTER_REGEX[validationType], '');

  sanitizedValue = sanitizedValue.replace(/(?!^)\+/g, '');

  if (startsWithPlus && !sanitizedValue.startsWith('+')) {
    sanitizedValue = `+${sanitizedValue.replace(/\+/g, '')}`;
  }

  return sanitizedValue;
}

function normalizeControlValue(control) {
  const validationType = getValidationType(control);
  const filter = INPUT_FILTER_REGEX[validationType];
  let value = getUnrestrictedTextValue(control);

  if (['phone', 'au-mobile', 'nz-mobile'].includes(validationType)) {
    value = normalizePhoneValue(value, validationType);
  } else if (filter) {
    value = value.replace(filter, '');
  }

  const maxLength = ['phone', 'au-mobile', 'nz-mobile'].includes(validationType)
    ? getMaxLengthForValidation(validationType, value)
    : Number(control.getAttribute('maxlength')) || getMaxLengthForValidation(validationType, value);

  if (maxLength) {
    value = value.slice(0, maxLength);
  }

  if (control.value !== value) {
    control.value = value;
  }
}

function validateTextField(fieldElement, { showErrors = false } = {}) {
  const control = getTextControl(fieldElement);

  if (!control) {
    return true;
  }

  if (control.readOnly || control.disabled) {
    clearFieldError(fieldElement);
    return true;
  }

  const value = getTextValue(control);
  const required = isRequired(control);
  const validationType = getValidationType(control);
  const pattern = VALIDATION_PATTERNS[validationType];

  if (required && !value) {
    if (showErrors) {
      showFieldError(fieldElement, getRequiredMessage(fieldElement));
    }
    return false;
  }

  if (pattern) {
    pattern.lastIndex = 0;
  }

  if (value && pattern && !pattern.test(value)) {
    if (showErrors) {
      showFieldError(fieldElement, getPatternMessage(fieldElement));
    }
    return false;
  }

  if (hasBackendFieldError(fieldElement)) {
    return false;
  }

  clearFieldError(fieldElement);
  return true;
}

function validateDropdownField(fieldElement, { showErrors = false } = {}) {
  const control = getDropdownControl(fieldElement);

  if (!control) {
    return true;
  }

  if (!isRequired(control)) {
    clearFieldError(fieldElement);
    return true;
  }

  const selectedOption = getSelectedDropdownOption(control);
  const hasValidValue = !!control.getAttribute('value');
  const isDisabledOption = selectedOption?.dataset?.disabled === 'true';

  if (!hasValidValue || isDisabledOption) {
    if (showErrors) {
      showFieldError(fieldElement, getRequiredMessage(fieldElement));
    }
    return false;
  }

  if (hasBackendFieldError(fieldElement)) {
    return false;
  }

  clearFieldError(fieldElement);
  return true;
}

function validateOptionField(fieldElement, { showErrors = false } = {}) {
  const fieldset = getOptionFieldset(fieldElement);

  if (!fieldset) {
    return true;
  }

  if (!isRequired(fieldset)) {
    clearFieldError(fieldElement);
    return true;
  }

  const checkboxInputs = [...fieldset.querySelectorAll('input[type="checkbox"]')];
  const radioInputs = [...fieldset.querySelectorAll('input[type="radio"]')];
  const enabledCheckboxes = checkboxInputs.filter((input) => !input.disabled);
  let hasChecked = radioInputs.some((input) => input.checked);

  if (checkboxInputs.length) {
    hasChecked = enabledCheckboxes.length
      ? enabledCheckboxes.every((input) => input.checked)
      : checkboxInputs.every((input) => input.checked);
  }

  if (!hasChecked) {
    if (showErrors) {
      showFieldError(fieldElement, getRequiredMessage(fieldElement));
    }
    return false;
  }

  if (hasBackendFieldError(fieldElement)) {
    return false;
  }

  clearFieldError(fieldElement);
  return true;
}

export function validateField(fieldElement, options) {
  if (fieldElement.classList.contains('text') || fieldElement.classList.contains('postcodesearch')) {
    return validateTextField(fieldElement, options);
  }

  if (fieldElement.querySelector('.yamaha-select')) {
    return validateDropdownField(fieldElement, options);
  }

  if (fieldElement.querySelector('.cmp-form-options--checkbox, .cmp-form-options--radio')) {
    return validateOptionField(fieldElement, options);
  }

  return true;
}

export function validateForm(form, options = {}) {
  let isValid = true;

  getFormFields(form).forEach((fieldElement) => {
    if (!validateField(fieldElement, options)) {
      isValid = false;
    }
  });

  return isValid;
}

export function updateSubmitState(form) {
  const submitButton = form.querySelector(SUBMIT_SELECTOR);

  if (!submitButton) {
    return;
  }

  submitButton.disabled = !validateForm(form);
}

function getFieldFromEventTarget(target, form) {
  if (!(target instanceof Element)) {
    return null;
  }

  const fieldElement = target.closest(FIELD_SELECTOR);

  return fieldElement && form.contains(fieldElement) ? fieldElement : null;
}

function bindFieldEvents(form) {
  form.addEventListener('input', (event) => {
    const fieldElement = getFieldFromEventTarget(event.target, form);

    if (!fieldElement || !event.target.matches(TEXT_CONTROL_SELECTOR)) {
      return;
    }

    resetSubmitErrorState(form);
    clearBackendFieldError(fieldElement);
    normalizeControlValue(event.target);
    validateField(fieldElement);
    clearValidationMessageIfNoFieldErrors(form);
    updateSubmitState(form);
  });

  form.addEventListener('blur', (event) => {
    const fieldElement = getFieldFromEventTarget(event.target, form);

    if (!fieldElement || !event.target.matches(TEXT_CONTROL_SELECTOR)) {
      return;
    }

    validateField(fieldElement, { showErrors: true });
    updateSubmitState(form);
  }, true);

  form.addEventListener('change', (event) => {
    const fieldElement = getFieldFromEventTarget(event.target, form);

    if (!fieldElement) {
      return;
    }

    resetSubmitErrorState(form);
    clearBackendFieldError(fieldElement);
    validateField(fieldElement, { showErrors: true });
    clearValidationMessageIfNoFieldErrors(form);
    updateSubmitState(form);
  });

  form.addEventListener('click', (event) => {
    const dropdown = event.target instanceof Element
      ? event.target.closest(DROPDOWN_SELECTOR)
      : null;

    if (!dropdown || !form.contains(dropdown)) {
      return;
    }

    window.requestAnimationFrame(() => {
      const fieldElement = dropdown.closest(FIELD_SELECTOR);

      if (fieldElement) {
        resetSubmitErrorState(form);
        clearBackendFieldError(fieldElement);
        validateField(fieldElement);
        clearValidationMessageIfNoFieldErrors(form);
      }

      updateSubmitState(form);
    });
  });
}

export default function initFormValidations(form) {
  if (!form || form.dataset.validationInitialized === 'true') {
    return;
  }

  form.dataset.validationInitialized = 'true';
  bindFieldEvents(form);
  updateSubmitState(form);
}
