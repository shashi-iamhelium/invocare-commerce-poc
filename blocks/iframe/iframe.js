const RESIZE_MESSAGE_TYPE = 'iframe-block-resize';
const IFRAME_PARAMS_MESSAGE_TYPE = 'iframe-form-params';
const IFRAME_READY_MESSAGE_TYPE = 'iframe-form-ready';

function normalizeName(value = '') {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function getReadableName(value = '') {
  return normalizeName(value)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFirstLink(block) {
  return block.querySelector('a[href]');
}

function getSourceUrl(block) {
  const link = getFirstLink(block);
  const source = link?.textContent;

  if (!source) return '';

  return source;
}

function isUrlText(value = '') {
  return (
    /^(https?:)?\/\//i.test(value)
    || /^\/?\S+\.json(?:[?#].*)?$/i.test(value)
  );
}

function getIframeTitle(block, sourceUrl) {
  const link = getFirstLink(block);
  const linkText = link?.textContent?.trim();

  const sourceName = new URL(sourceUrl).pathname
    .split('/')
    .filter(Boolean)
    .pop();

  if (link?.title && !isUrlText(link.title)) {
    return link.title;
  }

  if (linkText && !isUrlText(linkText)) {
    return linkText;
  }

  return `${getReadableName(sourceName)} form`;
}

function getIframeId(block, sourceUrl) {
  const blockIndex = [...document.querySelectorAll('.iframe')].indexOf(block) + 1;
  const sourceName = new URL(sourceUrl).pathname.split('/').filter(Boolean).pop() || 'content';

  return normalizeName(['iframe', sourceName, blockIndex].join('-'));
}

/**
 * Resize iframe based on same-origin content where possible.
 *
 * Cross-origin iframe height is handled using postMessage.
 */
function setIframeHeight(iframe) {
  try {
    const height = iframe.contentDocument?.documentElement?.scrollHeight;

    if (height) {
      iframe.style.height = `${Math.ceil(height)}px`;
    }
  } catch (error) {
    // Cross-origin frames cannot be measured directly.
  }
}

/**
 * Listen for messages coming from the iframe.
 */
function bindIframeMessages(iframe, sourceUrl) {
  const iframeOrigin = new URL(sourceUrl).origin;

  window.addEventListener('message', (event) => {
    if (event.origin !== iframeOrigin) {
      return;
    }

    if (event.source !== iframe.contentWindow) {
      return;
    }

    const { type } = event.data || {};

    /**
     * iframe tells parent that it is ready to receive parameters.
     */
    if (type === IFRAME_READY_MESSAGE_TYPE) {
      sendIframeParams(iframe, sourceUrl);
      return;
    }

    /**
     * iframe sends its calculated height.
     */
    if (type === RESIZE_MESSAGE_TYPE) {
      const height = Number(event.data.height);

      if (height > 0) {
        iframe.style.height = `${Math.ceil(height)}px`;
      }
    }
  });
}

/**
 * Extract query parameters from the iframe URL.
 *
 * Query parameters from the configured iframe URL are converted
 * into a key-value object and passed to the iframe.
 */
function getIframeParams(sourceUrl) {
  const url = new URL(sourceUrl);

  return Object.fromEntries(url.searchParams.entries());
}

/**
 * Send query parameters to the iframe.
 */
function sendIframeParams(iframe, sourceUrl) {
  const params = getIframeParams(sourceUrl);

  if (!Object.keys(params).length) {
    return;
  }

  const targetOrigin = new URL(sourceUrl).origin;

  iframe.contentWindow.postMessage(
    {
      type: IFRAME_PARAMS_MESSAGE_TYPE,
      params,
    },
    targetOrigin,
  );
}

function createIframe({ id, sourceUrl, title }) {
  const iframe = document.createElement('iframe');

  iframe.className = 'iframe-frame';
  iframe.id = id;
  iframe.src = sourceUrl;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allow = 'payment *; fullscreen';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';

  /**
   * Bind message listener before iframe loads.
   *
   * This is important so we don't miss the READY message.
   */
  bindIframeMessages(iframe, sourceUrl);

  iframe.addEventListener('load', () => {
    setIframeHeight(iframe);

    /**
     * Fallback:
     * If the iframe does not send a READY message,
     * send parameters after load as well.
     */
    sendIframeParams(iframe, sourceUrl);
  });

  return iframe;
}

export default function decorate(block) {
  const sourceUrl = getSourceUrl(block);

  if (!sourceUrl) {
    block.replaceChildren();
    return;
  }

  block.replaceChildren(
    createIframe({
      id: getIframeId(block, sourceUrl),
      sourceUrl,
      title: getIframeTitle(block, sourceUrl),
    }),
  );
}
