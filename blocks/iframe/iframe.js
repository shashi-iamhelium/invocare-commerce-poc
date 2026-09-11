const RESIZE_MESSAGE_TYPE = 'iframe-block-resize';

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

function getFirstCellText(block) {
  const cell = block.querySelector('td, div div');
  return cell?.textContent?.trim() || '';
}

function getSourceUrl(block) {
  const link = getFirstLink(block);
  const source = link?.getAttribute('href') || getFirstCellText(block);

  if (!source) return '';

  const url = new URL(source, window.location.href);
  url.pathname = url.pathname.replace(/\.json$/, '');
  url.searchParams.set('embedded', 'true');

  return url.href;
}

function isUrlText(value = '') {
  return /^(https?:)?\/\//i.test(value) || /^\/?\S+\.json(?:[?#].*)?$/i.test(value);
}

function getIframeTitle(block, sourceUrl) {
  const link = getFirstLink(block);
  const linkText = link?.textContent?.trim();
  const sourceName = new URL(sourceUrl).pathname.split('/').filter(Boolean).pop();

  if (link?.title && !isUrlText(link.title)) return link.title;
  if (linkText && !isUrlText(linkText)) return linkText;

  return `${getReadableName(sourceName)} form`;
}

function getIframeId(block, sourceUrl) {
  const blockIndex = [...document.querySelectorAll('.iframe')].indexOf(block) + 1;
  const sourceName = new URL(sourceUrl).pathname.split('/').filter(Boolean).pop() || 'content';

  return normalizeName(['iframe', sourceName, blockIndex].join('-'));
}

function setIframeHeight(iframe) {
  try {
    const height = iframe.contentDocument?.documentElement?.scrollHeight;
    if (height) iframe.style.height = `${Math.ceil(height)}px`;
  } catch (error) {
    // Cross-origin frames cannot be measured by the parent.
  }
}

function bindIframeResize(iframe) {
  window.addEventListener('message', (event) => {
    if (event.origin !== new URL(iframe.src).origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (event.data?.type !== RESIZE_MESSAGE_TYPE) return;

    const height = Number(event.data.height);
    if (height > 0) iframe.style.height = `${Math.ceil(height)}px`;
  });
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
  iframe.addEventListener('load', () => setIframeHeight(iframe));
  bindIframeResize(iframe);

  return iframe;
}

export default function decorate(block) {
  const sourceUrl = getSourceUrl(block);

  if (!sourceUrl) {
    block.replaceChildren();
    return;
  }

  block.replaceChildren(createIframe({
    id: getIframeId(block, sourceUrl),
    sourceUrl,
    title: getIframeTitle(block, sourceUrl),
  }));
}
