export const VALIDATION_REGEX = {
  'only-alphabets': /^[A-Za-z ]+$/,
  varchar: /^[A-Za-z0-9 ]+$/,
  'only-numbers': /^\d+$/,
  email: /^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
  phone: /^(?:(?:\+614|04)\d{8}|(?:\+642|02)\d{7,9})$/,
  'au-mobile': /^(?:\+614|04)\d{8}$/,
  'nz-mobile': /^(?:\+642|02)\d{7,9}$/,
  postcode: /^\d{4}$/,
};

export const INPUT_FILTER_REGEX = {
  'only-alphabets': /[^A-Za-z ]+/g,
  varchar: /[^A-Za-z0-9 ]+/g,
  'only-numbers': /\D+/g,
  postcode: /\D+/g,
  phone: /[^\d+]+/g,
  'au-mobile': /[^\d+]+/g,
  'nz-mobile': /[^\d+]+/g,
};

export const MAX_LENGTHS = {
  postcode: 4,
  phone: 13,
  'au-mobile-local': 10,
  'au-mobile-international': 12,
  'nz-mobile-local': 11,
  'nz-mobile-international': 13,
};

export function getPhoneMaxLength(value = '', validationType = 'phone') {
  const normalizedValue = value.trim();

  if (validationType === 'au-mobile') {
    if (!normalizedValue) {
      return MAX_LENGTHS['au-mobile-international'];
    }

    return normalizedValue.startsWith('+') ? MAX_LENGTHS['au-mobile-international'] : MAX_LENGTHS['au-mobile-local'];
  }

  if (validationType === 'nz-mobile') {
    if (!normalizedValue) {
      return MAX_LENGTHS['nz-mobile-international'];
    }

    return normalizedValue.startsWith('+') ? MAX_LENGTHS['nz-mobile-international'] : MAX_LENGTHS['nz-mobile-local'];
  }

  if (normalizedValue.startsWith('+61')) {
    return MAX_LENGTHS['au-mobile-international'];
  }

  if (normalizedValue.startsWith('04')) {
    return MAX_LENGTHS['au-mobile-local'];
  }

  if (normalizedValue.startsWith('+64')) {
    return MAX_LENGTHS['nz-mobile-international'];
  }

  if (normalizedValue.startsWith('02')) {
    return MAX_LENGTHS['nz-mobile-local'];
  }

  return MAX_LENGTHS.phone;
}

export function getMaxLengthForValidation(validationType = '', value = '') {
  if (validationType === 'postcode') {
    return MAX_LENGTHS.postcode;
  }

  if (['phone', 'au-mobile', 'nz-mobile'].includes(validationType)) {
    return getPhoneMaxLength(value, validationType);
  }

  return null;
}

export default VALIDATION_REGEX;
