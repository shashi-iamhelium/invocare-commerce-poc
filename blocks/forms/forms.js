import initForms from './utility/form-fields-renderer.js';

export default async function decorate(block) {
  try {
    await initForms(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
