import initForms from './utility/form-fields-renderer.js';

function getUrlParameters() {
  const params = new URLSearchParams(window.location.search);

  return Object.fromEntries(params.entries());
}

function applyUrlParametersToBody(params) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    document.body.setAttribute(`data-${key}`, value);
  });
}

function applyUrlParametersToMeta(params) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    let meta = document.head.querySelector(
      `meta[name="${CSS.escape(key)}"]`,
    );

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', key);
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', value);
  });
}

export default async function decorate(block) {
  try {
    // Read parameters from the iframe URL
    const params = getUrlParameters();

    // Add parameters to iframe body
    applyUrlParametersToBody(params);

    // Add parameters as meta tags
    applyUrlParametersToMeta(params);

    // Initialize the form
    await initForms(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
