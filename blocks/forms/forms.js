import initForms from './utility/form-fields-renderer.js';

const IFRAME_PARAMS_MESSAGE_TYPE = 'iframe-form-params';

/**
 * Convert a parameter value into a safe CSS class value.
 *
 * Example:
 * "Barlow Font" -> "barlow-font"
 */
function normalizeClassValue(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Apply parameters as body classes.
 *
 * Example:
 *
 * {
 *   theme: 'inv',
 *   font: 'barlow'
 * }
 *
 * becomes:
 *
 * <body class="theme-inv font-barlow">
 */
function applyParamsToBody(params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    const normalizedKey = normalizeClassValue(key);
    const normalizedValue = normalizeClassValue(value);

    if (!normalizedKey || !normalizedValue) {
      return;
    }

    document.body.classList.add(
      `${normalizedKey}-${normalizedValue}`,
    );
  });
}

/**
 * Read parameters from the form page URL.
 *
 * This supports direct URLs such as:
 *
 */
function applyUrlParamsToBody() {
  const params = new URLSearchParams(window.location.search);

  if (!params.size) {
    return;
  }

  applyParamsToBody(Object.fromEntries(params.entries()));
}

/**
 * Listen for parameters sent by the parent iframe.
 *
 * The parent iframe.js sends:
 *
 * {
 *   type: 'iframe-form-params',
 *   params: {
 *     theme: 'inv',
 *     font: 'barlow'
 *   }
 * }
 */
function bindIframeParamsListener() {
  window.addEventListener('message', (event) => {
    const { type, params } = event.data || {};

    if (type !== IFRAME_PARAMS_MESSAGE_TYPE) {
      return;
    }

    if (!params || typeof params !== 'object') {
      return;
    }

    applyParamsToBody(params);
  });
}

export default async function decorate(block) {
  try {
    /**
     * 1. Support direct/local URL parameters.
     */
    applyUrlParamsToBody();

    /**
     * 2. Support parameters passed from the iframe parent.
     */
    bindIframeParamsListener();

    /**
     * 3. Render the form.
     */
    await initForms(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
