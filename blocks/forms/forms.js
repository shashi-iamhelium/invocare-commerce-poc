import initForms from './utility/form-fields-renderer.js';

export default async function decorate(block) {
  try {
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
    const mainElement = document.querySelector('main');
    if (mainElement) {
      // Sets <main data-brand="inv"> or <main data-brand="brand-b">
      mainElement.setAttribute('data-brand', brand);
      clearInterval(checkMain);
    }
  }, 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyBrandDesign);
} else {
  applyBrandDesign();
}
