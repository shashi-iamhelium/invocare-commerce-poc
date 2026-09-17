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
