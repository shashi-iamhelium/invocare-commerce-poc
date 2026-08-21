import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';

const ENABLE_RECAPTCHA_CONFIG = 'enable-recaptcha';
const RECAPTCHA_SITE_KEY_CONFIG = 'recaptcha-site-key';
const RECAPTCHA_SCRIPT_ATTR = 'data-recaptcha-script';
const RECAPTCHA_SCRIPT_LOADED_ATTR = 'data-recaptcha-loaded';
const RECAPTCHA_READY_TIMEOUT = 10000;

let recaptchaConfigPromise;
let recaptchaReadyPromise;

async function getRecaptchaConfig() {
  if (!recaptchaConfigPromise) {
    recaptchaConfigPromise = (async () => {
      const enabled = String(await getConfigValue(ENABLE_RECAPTCHA_CONFIG)).toLowerCase() === 'true';

      if (!enabled) {
        return { enabled: false, siteKey: '' };
      }

      const siteKey = await getConfigValue(RECAPTCHA_SITE_KEY_CONFIG);

      if (!siteKey) {
        throw new Error('reCAPTCHA site key is missing');
      }

      return { enabled: true, siteKey };
    })();
  }

  return recaptchaConfigPromise;
}

function waitForRecaptcha() {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Timed out waiting for reCAPTCHA'));
    }, RECAPTCHA_READY_TIMEOUT);

    if (!window.grecaptcha?.ready) {
      window.clearTimeout(timeoutId);
      reject(new Error('reCAPTCHA is not available'));
      return;
    }

    window.grecaptcha.ready(() => {
      window.clearTimeout(timeoutId);
      resolve();
    });
  });
}

function markRecaptchaScriptLoaded(script) {
  script?.setAttribute(RECAPTCHA_SCRIPT_LOADED_ATTR, 'true');
}

function createRecaptchaScript(siteKey) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
  script.setAttribute(RECAPTCHA_SCRIPT_ATTR, 'true');
  return script;
}

function loadRecaptchaScript(script) {
  return new Promise((resolve, reject) => {
    if (!script) {
      reject(new Error('reCAPTCHA script element is missing'));
      return;
    }

    if (window.grecaptcha?.execute) {
      waitForRecaptcha().then(resolve).catch(reject);
      return;
    }

    let cleanup = () => {};

    const onLoad = () => {
      markRecaptchaScriptLoaded(script);
      cleanup();
      waitForRecaptcha().then(resolve).catch(reject);
    };

    const onError = () => {
      cleanup();
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!script.isConnected) {
      document.head.appendChild(script);
      return;
    }

    if (script.getAttribute(RECAPTCHA_SCRIPT_LOADED_ATTR) === 'true') {
      onLoad();
    }
  });
}

async function ensureRecaptchaReady(siteKey) {
  if (window.grecaptcha?.execute) {
    await waitForRecaptcha();
    return siteKey;
  }

  if (!recaptchaReadyPromise) {
    const existingScript = document.querySelector(`script[${RECAPTCHA_SCRIPT_ATTR}]`);
    const script = existingScript || createRecaptchaScript(siteKey);

    recaptchaReadyPromise = loadRecaptchaScript(script).catch((error) => {
      recaptchaReadyPromise = null;
      throw error;
    });
  }

  await recaptchaReadyPromise;
  return siteKey;
}

export async function loadRecaptcha() {
  const { enabled, siteKey } = await getRecaptchaConfig();

  if (!enabled) {
    return '';
  }

  return ensureRecaptchaReady(siteKey);
}

export default async function executeRecaptcha(action = 'submit') {
  const siteKey = await loadRecaptcha();

  if (!siteKey) {
    return '';
  }

  const token = await window.grecaptcha.execute(siteKey, { action });

  if (!token) {
    throw new Error('Failed to get reCAPTCHA token');
  }

  return token;
}
