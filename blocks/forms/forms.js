import initForms from './utility/form-fields-renderer.js';

function removePageShell() {
  document.querySelector('header')?.remove();
  document.querySelector('footer')?.remove();
}

function applyUrlParamsToBody() {
  const params = new URLSearchParams(window.location.search);

  if (!params.size || !document.body) {
    return;
  }

  params.forEach((value, key) => {
    if (!key || !value) {
      return;
    }

    document.body.setAttribute(`data-${key}`, value);
  });
}

function normalizeOrigin(urlStr) {
  if (!urlStr) return '';
  try {
    const formatted = urlStr.includes('://') ? urlStr : `https://${urlStr}`;
    return new URL(formatted).origin.toLowerCase();
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

async function loadAllowedFrameAncestors() {
  const allowed = new Set();
  // Always allow the current origin ('self')
  allowed.add(window.location.origin.toLowerCase());

  // 1. Check document meta tags (e.g. <meta name="frame-ancestors" content="...">)
  const metaAncestors = document.querySelector('meta[name="allowed-frame-ancestors"]')?.content
    || document.querySelector('meta[name="frame-ancestors"]')?.content;
  if (metaAncestors) {
    metaAncestors.trim().split(/\s+/).forEach((token) => {
      const cleaned = token.replace(/['"]/g, '').trim();
      if (cleaned && cleaned !== 'none' && cleaned !== 'self') {
        allowed.add(normalizeOrigin(cleaned));
      }
    });
  }

  const extractFromHeaders = (headers) => {
    if (!headers || typeof headers !== 'object') return;
    Object.values(headers).forEach((headerList) => {
      if (Array.isArray(headerList)) {
        headerList.forEach((header) => {
          if (header?.key?.toLowerCase() === 'content-security-policy' && header.value) {
            const match = header.value.match(/frame-ancestors\s+([^;]+)/i);
            if (match && match[1]) {
              match[1].trim().split(/\s+/).forEach((token) => {
                const cleaned = token.replace(/['"]/g, '').trim();
                if (cleaned === 'self') {
                  allowed.add(window.location.origin.toLowerCase());
                } else if (cleaned && cleaned !== 'none') {
                  allowed.add(normalizeOrigin(cleaned));
                }
              });
            }
          }
        });
      }
    });
  };

  // 2. Check /config.json
  try {
    const resp = await fetch('/config.json');
    if (resp.ok) {
      const config = await resp.json();
      extractFromHeaders(config?.headers);
      extractFromHeaders(config?.public?.default?.headers);
    }
  } catch {
    // ignore
  }

  // 3. Fallback: Check /default-site.json if headers weren't found in config.json
  if (allowed.size <= 1) {
    try {
      const siteResp = await fetch('/default-site.json');
      if (siteResp.ok) {
        const siteConfig = await siteResp.json();
        extractFromHeaders(siteConfig?.headers);
        extractFromHeaders(siteConfig?.public?.default?.headers);
      }
    } catch {
      // ignore
    }
  }

  return Array.from(allowed);
}

async function isParentDomainAllowed() {
  // If not inside an iframe, allowed by 'self'
  if (window.self === window.top) {
    return true;
  }

  try {
    const allowedList = await loadAllowedFrameAncestors();

    // If only 'self' is in the allowed list and we're framed cross-origin, block
    if (allowedList.length === 0) {
      return false;
    }

    // 1. Check window.location.ancestorOrigins (Chrome, Safari, Edge, Chromium)
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      for (let i = 0; i < window.location.ancestorOrigins.length; i += 1) {
        const ancestorOrigin = normalizeOrigin(window.location.ancestorOrigins[i]);
        if (!allowedList.includes(ancestorOrigin)) {
          return false;
        }
      }
      return true;
    }

    // 2. Check document.referrer (Firefox and other browsers)
    if (document.referrer) {
      const referrerOrigin = normalizeOrigin(document.referrer);
      if (referrerOrigin && allowedList.includes(referrerOrigin)) {
        return true;
      }
      return false;
    }

    // 3. Fallback: check same-origin parent window
    try {
      if (window.parent && window.parent.location && window.parent.location.origin) {
        const parentOrigin = normalizeOrigin(window.parent.location.origin);
        return allowedList.includes(parentOrigin);
      }
    } catch {
      // Cross-origin access blocked
    }

    // Cannot verify parent domain
    return false;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Error checking parent iframe domain:', e);
    return false;
  }
}

/**
 * Derives a human-readable step label from a data-form-sheet value.
 * @param {string} raw - e.g. "contact-details" or "step-2"
 * @param {number} index - fallback ordinal
 * @returns {string}
 */
function sheetLabel(raw, index) {
  const clean = (raw || '').trim();
  if (!clean) return `Step ${index + 1}`;
  return clean
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds and injects a progress bar above the form that automatically updates
 * whenever the renderer shows or hides a sheet (e.g. due to radio selection).
 *
 * Strategy:
 *   - Step state is derived solely from each sheet's `hidden` / `data-sheet-state`
 *     attributes, which the renderer sets in showDependentSheets / hideDependentSheets.
 *   - A MutationObserver watches those attributes on every sheet so any transition
 *     (choice-driven or programmatic) keeps the bar in sync without extra coupling.
 *
 * @param {Element} block
 */
function buildProgressBar(block) {
  const form = block.querySelector('form.da-form');
  if (!form) return;

  const sheets = [...form.querySelectorAll('.form-sheet')];

  if (sheets.length < 2) return;

  const nav = document.createElement('nav');
  nav.className = 'form-progress';
  nav.setAttribute('aria-label', 'Form progress');

  const list = document.createElement('ol');
  list.className = 'form-progress-steps';

  const stepItems = [];
  const progressLines = [];

  sheets.forEach((sheet, index) => {
    const step = document.createElement('li');
    step.className = 'form-progress-step is-pending';
    step.dataset.stepIndex = index;

    const indicator = document.createElement('span');
    indicator.className = 'form-step-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = index + 1;

    const label = document.createElement('span');
    label.className = 'form-step-label';
    label.textContent = sheetLabel(sheet.dataset.formSheet, index);

    step.append(indicator, label);
    list.appendChild(step);

    stepItems.push(step);

    // Add a line between each step
    if (index < sheets.length - 1) {
      const line = document.createElement('div');
      line.className = 'form-progress-line';
      line.setAttribute('aria-hidden', 'true');

      list.appendChild(line);
      progressLines.push(line);
    }
  });

  nav.appendChild(list);
  form.insertAdjacentElement('beforebegin', nav);

  function syncProgress() {
    let activeIndex = 0;

    sheets.forEach((sheet, index) => {
      const isVisible = !sheet.hidden && sheet.dataset.sheetState !== 'hidden';

      if (isVisible) {
        activeIndex = index;
      }
    });

    // Update circles
    stepItems.forEach((step, index) => {
      step.classList.remove('is-active', 'is-completed', 'is-pending');

      if (index < activeIndex) {
        step.classList.add('is-completed');
      } else if (index === activeIndex) {
        step.classList.add('is-active');
      } else {
        step.classList.add('is-pending');
      }
    });

    // Update lines
    progressLines.forEach((line, index) => {
      line.classList.toggle('is-completed', index < activeIndex);
    });

    nav.setAttribute(
      'aria-label',
      `Form progress: step ${activeIndex + 1} of ${sheets.length}`,
    );
  }

  const observer = new MutationObserver(syncProgress);

  sheets.forEach((sheet) => {
    observer.observe(sheet, {
      attributes: true,
      attributeFilter: ['hidden', 'data-sheet-state'],
    });
  });

  syncProgress();
}

export default async function decorate(block) {
  try {
    const isAllowed = await isParentDomainAllowed();
    if (!isAllowed) {
      // eslint-disable-next-line no-console
      console.warn('Form loading blocked: Parent iframe domain is not allowed in config.json headers');
      block.innerHTML = '<div class="forms-blocked"><p>This form cannot be embedded on this domain.</p></div>';
      return;
    }

    removePageShell();

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
     * Render the form, then attach the progress bar which observes the
     * renderer's own sheet transitions (triggered by radio/choice selection).
     */
    const form = await initForms(block);
    if (form) {
      buildProgressBar(block);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
