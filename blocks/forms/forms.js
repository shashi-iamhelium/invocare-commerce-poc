import initForms from './utility/forms-helper/form-fields-renderer.js';
import executeRecaptcha, { loadRecaptcha } from './utility/integrations/recaptcha.js';
import initFormSubmission, { submitForm } from './utility/forms-submission/form-submission.js';
import initFormValidations, {
  updateSubmitState,
  validateForm,
} from './utility/validations/form-validations.js';

const DROPDOWN_SELECTOR = '.yamaha-select[name]';
const GENERATED_INPUT_ATTR = 'data-form-generated-input';
const RECAPTCHA_FIELD_NAME = 'gRecaptchaResponse';
const SUBMIT_SELECTOR = '.cmp-form-button';
const DROPDOWN_INPUT_SOURCE = 'dropdown';
const RECAPTCHA_INPUT_SOURCE = 'recaptcha';
const FORM_SUCCESS_EVENT = 'form-success';
const FORM_WARNING_EVENT = 'form-warning';
const FORM_ERROR_EVENT = 'form-error';

function getFormConfig(form) {
  return form?.formConfig || {};
}

function getFormSubmitStatus(result) {
  return Number(result?.resultStatus || result?.responseData?.status || result?.status || 0);
}

function getResponseErrors(source) {
  return Array.isArray(source?.responseData?.errors) ? source.responseData.errors : [];
}

function hasResponseErrors(source) {
  return getResponseErrors(source).length > 0;
}

function isFormSubmitSuccess(result) {
  return getFormSubmitStatus(result) === 200 && !hasResponseErrors(result);
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

function dispatchFormEvent(form, eventName, detail = {}) {
  if (!form) {
    return;
  }

  form.dispatchEvent(new CustomEvent(eventName, {
    bubbles: true,
    detail: {
      target: form,
      ...detail,
    },
  }));
}

function dispatchFormSuccess(form, detail = {}) {
  dispatchFormEvent(form, FORM_SUCCESS_EVENT, {
    isSuccessful: true,
    message: detail.message || detail.responseData?.message || '',
  });
}

function dispatchFormWarning(form, detail = {}) {
  const warningMessage = getFormConfig(form).warningMessage
    || getFormConfig(form).errorMessage
    || '';

  dispatchFormEvent(form, FORM_WARNING_EVENT, {
    source: detail.source || 'backend-validation',
    isSuccessful: false,
    message: warningMessage,
  });
}

function getFormErrorDetail(form, detail = {}) {
  const responseData = detail?.result?.responseData || detail?.responseData || {};
  const error = detail?.error || {};
  return {
    errorMessage: getFormConfig(form).errorMessage || '',
    errorCode: error.errorCode
    || detail.errorCode
    || responseData?.status
    || detail?.result?.resultStatus
    || detail?.result?.status
    || '',
    errorType: error.errorType
    || detail.errorType
    || responseData?.message
    || '',
  };
}

function dispatchFormError(form, detail = {}) {
  dispatchFormEvent(form, FORM_ERROR_EVENT, {
    source: detail.source || 'backend-validation',
    isSuccessful: false,
    error: getFormErrorDetail(form, detail),
  });
}

function getGeneratedHiddenInput(form, name, source) {
  return [...form.querySelectorAll(`input[type="hidden"][${GENERATED_INPUT_ATTR}="${source}"]`)]
    .find((input) => input.name === name);
}

function setGeneratedHiddenInput(form, name, value, source) {
  if (!name) {
    return;
  }

  let input = getGeneratedHiddenInput(form, name, source);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.setAttribute(GENERATED_INPUT_ATTR, source);
    form.appendChild(input);
  }

  input.value = value;
}

function removeGeneratedHiddenInput(form, name, source) {
  getGeneratedHiddenInput(form, name, source)?.remove();
}

function syncCustomControlValues(form) {
  form.querySelectorAll(DROPDOWN_SELECTOR).forEach((dropdown) => {
    setGeneratedHiddenInput(
      form,
      dropdown.getAttribute('name'),
      dropdown.getAttribute('value') || '',
      DROPDOWN_INPUT_SOURCE,
    );
  });
}

function setSubmitBusy(form, isBusy) {
  const submitButton = form.querySelector(SUBMIT_SELECTOR);
  if (!submitButton) {
    return;
  }

  const config = getFormConfig(form);
  const defaultLabel = submitButton.dataset.defaultLabel || submitButton.textContent?.trim() || 'Submit';
  const nextLabel = isBusy
    ? (config.submittingButtonLabel || defaultLabel)
    : defaultLabel;

  submitButton.disabled = isBusy || !validateForm(form);
  submitButton.classList.toggle('loading', isBusy);
  setSubmitButtonLabel(form, nextLabel);
}

async function syncRecaptchaToken(form) {
  removeGeneratedHiddenInput(form, RECAPTCHA_FIELD_NAME, RECAPTCHA_INPUT_SOURCE);

  try {
    const token = await executeRecaptcha('submit');
    if (!token) {
      return true;
    }

    setGeneratedHiddenInput(form, RECAPTCHA_FIELD_NAME, token, RECAPTCHA_INPUT_SOURCE);
    return true;
  } catch {
    return false;
  }
}

function bindFormSubmit(form) {
  if (!form || form.dataset.submitInitialized === 'true') {
    return;
  }

  form.dataset.submitInitialized = 'true';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(form, { showErrors: true })) {
      updateSubmitState(form);
      dispatchFormWarning(form, {
        source: 'frontend-validation',
      });
      return;
    }

    setSubmitBusy(form, true);
    syncCustomControlValues(form);

    const isRecaptchaValid = await syncRecaptchaToken(form);
    if (!isRecaptchaValid) {
      dispatchFormError(form, {
        source: 'submit-error',
      });
      setSubmitBusy(form, false);
      updateSubmitState(form);
      return;
    }

    try {
      const result = await submitForm(form, new FormData(form));
      if (isFormSubmitSuccess(result)) {
        dispatchFormSuccess(form, result);
      } else if (hasResponseErrors(result)) {
        dispatchFormWarning(form, {
          source: 'backend-validation',
        });
      } else {
        dispatchFormError(form, { result });
      }
    } catch (error) {
      if (hasResponseErrors(error)) {
        dispatchFormWarning(form, {
          source: 'backend-validation',
        });
      } else {
        dispatchFormError(form, {
          source: 'submit-error',
          responseData: error?.responseData,
          error: {
            errorCode: error?.status || '',
            errorType: error?.errorType || '',
          },
        });
      }
    } finally {
      setSubmitBusy(form, false);
      updateSubmitState(form);
    }
  });
}

function initRecaptcha() {
  const load = () => loadRecaptcha().catch(() => {});
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 2000 });
    return;
  }

  window.setTimeout(load, 0);
}

export default function decorate(block) {
  const form = initForms(block);

  if (!form) {
    return;
  }

  initFormValidations(form);
  initFormSubmission(form);
  bindFormSubmit(form);
  initRecaptcha();
}
