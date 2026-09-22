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

async function isParentDomainAllowed() {
  // If not inside an iframe, allowed by 'self'
  if (window.self === window.top) {
    return true;
  }

  try {
    const resp = await fetch('/config.json');
    if (!resp.ok) return false;
    const config = await resp.json();

    const allowedOrigins = new Set();
    const headers = config?.headers || {};

    // Extract all frame-ancestors domains from config.json headers
    Object.values(headers).forEach((headerList) => {
      if (Array.isArray(headerList)) {
        headerList.forEach((header) => {
          if (header?.key?.toLowerCase() === 'content-security-policy' && header.value) {
            const match = header.value.match(/frame-ancestors\s+([^;]+)/i);
            if (match && match[1]) {
              match[1].trim().split(/\s+/).forEach((token) => {
                const cleaned = token.replace(/['"]/g, '').trim();
                if (cleaned === 'self') {
                  allowedOrigins.add(window.location.origin.toLowerCase());
                } else if (cleaned && cleaned !== 'none') {
                  allowedOrigins.add(normalizeOrigin(cleaned));
                }
              });
            }
          }
        });
      }
    });

    const allowedList = Array.from(allowedOrigins);
    if (allowedList.length === 0) {
      // If inside an iframe and no allowed frame-ancestors are configured, block by default
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
     * Render the form.
     */
    await initForms(block);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to render DA form', error);
  }
}
