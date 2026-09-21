import initForms from './utility/form-fields-renderer.js';

function applyUrlParamsToBody() {
  const params = new URLSearchParams(window.location.search);

  if (!params.size || !document.body) {
    return;
  }

  params.forEach((value, key) => {
    if (!key || !value) {
      return;
    }

    document.body.setAttribute(
      `data-${key}`,
      value,
    );
  });
}

export default async function decorate(block) {
  try {
    /**
     * Apply parameters directly from the iframe URL.
     *
     * Example:
     * /forms/enquire-now?theme=inv&font=barlow
     *
     * Result:
     * body - theme["inv"] font["barlow"]
     */
    applyUrlParamsToBody();

    /**
     * Render the form.
     */
    await initForms(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
function applyBrandDesign() {
  const urlParams = new URLSearchParams(window.location.search);
  const brand = urlParams.get('brand') || urlParams.get('theme') || 'default';

  const checkMain = setInterval(() => {
    const formElement = document.querySelector('.forms-container');
    if (formElement) {
      // Sets <main data-brand="inv"> or <main data-brand="brand-b">
      formElement.setAttribute('data-theme', brand);
      clearInterval(checkMain);
    }
  }, 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyBrandDesign);
} else {
  applyBrandDesign();
}
window.addEventListener('message', (event) => {
  // Validate origin for security
  if (!event.origin.includes('localhost:3001')) return;

  if (event.data && event.data.type === 'SET_THEME') {
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.setAttribute('data-theme', event.data.theme);
  }
});
