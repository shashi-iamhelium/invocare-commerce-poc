import decorateForms from '../forms/forms.js';

export default function decorate(block) {
  block.classList.add('forms');
  decorateForms(block);
}
