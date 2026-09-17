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

/**
 * Get the iframe source URL.
 *
 * IMPORTANT:
 * Use href rather than textContent.
 */
function getSourceUrl(block) {
  const link = getFirstLink(block);

  return link?.href?.trim() || link?.textContent?.trim() || '';
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
    .pop() || 'content';

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

  return normalizeName(
    ['iframe', sourceName, blockIndex].join('-'),
  );
}

function setIframeHeight(iframe) {
  const viewportHeight = window.innerHeight;

  iframe.style.height = `${Math.round(viewportHeight * 0.8)}px`;
}

function createIframe({ id, sourceUrl, title }) {
  const iframe = document.createElement('iframe');

  iframe.className = 'iframe-frame';
  iframe.id = id;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.allow = 'payment *; fullscreen';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.src = sourceUrl;

  setIframeHeight(iframe);

  window.addEventListener('resize', () => {
    setIframeHeight(iframe);
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
