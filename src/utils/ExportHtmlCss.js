import { stripWrappingQuotes, toCanvasRect } from './nuiData';

function reencodeAsWebp(dataUrl) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);

      const webpDataUrl = canvas.toDataURL('image/webp', 0.9);
      resolve(webpDataUrl.length < dataUrl.length ? webpDataUrl : dataUrl);
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function fetchAsDataUrl(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith('data:')) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const getAssetCssClass = (urlToClass, url) => urlToClass.get(url) || '';

async function buildImageRegistry(assets) {
  const uniqueUrls = new Set();

  Object.values(assets).forEach(assetData => {
    if (!assetData) {
      return;
    }

    if (typeof assetData === 'string') {
      uniqueUrls.add(assetData);
      return;
    }

    if (assetData.frames) {
      assetData.frames.forEach(frame => {
        if (frame.url) {
          uniqueUrls.add(frame.url);
        }
      });
    }
  });

  const fetchedAssets = await Promise.all(
    [...uniqueUrls].map(async url => [url, await fetchAsDataUrl(url)])
  );

  const resolvedAssets = fetchedAssets.filter(([, dataUrl]) => dataUrl);
  const reencodedAssets = await Promise.all(
    resolvedAssets.map(async ([url, dataUrl]) => [url, await reencodeAsWebp(dataUrl)])
  );

  const seenAssetData = new Map();
  const urlToClass = new Map();
  const cssRules = [];
  let classIndex = 0;

  reencodedAssets.forEach(([url, dataUrl]) => {
    if (seenAssetData.has(dataUrl)) {
      urlToClass.set(url, seenAssetData.get(dataUrl));
      return;
    }

    const className = `a${classIndex++}`;
    seenAssetData.set(dataUrl, className);
    urlToClass.set(url, className);
    cssRules.push(`.${className}{background-image:url(${dataUrl})}`);
  });

  return {
    urlToClass,
    css: cssRules.join('')
  };
}

function renderFrameMarkup(frames, width, height, urlToClass) {
  if (!frames?.length) {
    return '';
  }

  if (frames.length === 1) {
    return `<i class="f ${getAssetCssClass(urlToClass, frames[0].url)}" style="width:100%;height:100%"></i>`;
  }

  if (frames.length >= 9) {
    const cornerWidth = frames[0].width || 10;
    const cornerHeight = frames[0].height || 10;
    const middleWidth = Math.max(0, width - cornerWidth * 2);
    const middleHeight = Math.max(0, height - cornerHeight * 2);
    const slices = [
      { horizontal: 'left:0', vertical: 'top:0', width: cornerWidth, height: cornerHeight, frame: frames[0] },
      { horizontal: `left:${cornerWidth}px`, vertical: 'top:0', width: middleWidth, height: cornerHeight, frame: frames[1] },
      { horizontal: 'right:0', vertical: 'top:0', width: cornerWidth, height: cornerHeight, frame: frames[2] },
      { horizontal: 'left:0', vertical: `top:${cornerHeight}px`, width: cornerWidth, height: middleHeight, frame: frames[3] },
      { horizontal: `left:${cornerWidth}px`, vertical: `top:${cornerHeight}px`, width: middleWidth, height: middleHeight, frame: frames[4] },
      { horizontal: 'right:0', vertical: `top:${cornerHeight}px`, width: cornerWidth, height: middleHeight, frame: frames[5] },
      { horizontal: 'left:0', vertical: 'bottom:0', width: cornerWidth, height: cornerHeight, frame: frames[6] },
      { horizontal: `left:${cornerWidth}px`, vertical: 'bottom:0', width: middleWidth, height: cornerHeight, frame: frames[7] },
      { horizontal: 'right:0', vertical: 'bottom:0', width: cornerWidth, height: cornerHeight, frame: frames[8] }
    ];

    return slices.map(({ horizontal, vertical, width: sliceWidth, height: sliceHeight, frame }) => (
      `<i class="f ${getAssetCssClass(urlToClass, frame.url)}" style="${horizontal};${vertical};width:${sliceWidth}px;height:${sliceHeight}px"></i>`
    )).join('');
  }

  if (frames.length === 3) {
    const edgeWidth = frames[0].width || 10;
    const centerWidth = Math.max(0, width - edgeWidth * 2);

    return [
      `<i class="f ${getAssetCssClass(urlToClass, frames[0].url)}" style="left:0;top:0;width:${edgeWidth}px;height:100%"></i>`,
      `<i class="f ${getAssetCssClass(urlToClass, frames[1].url)}" style="left:${edgeWidth}px;top:0;width:${centerWidth}px;height:100%"></i>`,
      `<i class="f ${getAssetCssClass(urlToClass, frames[2].url)}" style="right:0;top:0;width:${edgeWidth}px;height:100%"></i>`
    ].join('');
  }

  return `<i class="f ${getAssetCssClass(urlToClass, frames[0].url)}" style="width:100%;height:100%"></i>`;
}

function renderControlMarkup(control, assets, urlToClass) {
  const rect = toCanvasRect(control.properties.rect);
  const assetData = assets[control.properties.ani];
  const caption = stripWrappingQuotes(control.properties.caption || '');
  const isFrameAsset = Boolean(assetData && typeof assetData === 'object' && assetData.frames);

  let className = 'c';
  let innerMarkup = '';

  if (isFrameAsset) {
    innerMarkup = renderFrameMarkup(assetData.frames, rect.w, rect.h, urlToClass);
  } else if (typeof assetData === 'string') {
    const assetClass = urlToClass.get(assetData);
    if (assetClass) {
      className += ` s ${assetClass}`;
    }
  }

  if (caption && !assetData) {
    innerMarkup += `<b class=t>${escapeHtml(caption)}</b>`;
  }

  return `<div class="${className}" style="left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px">${innerMarkup}</div>`;
}

export async function exportAsHtml(nuiData, assets, fileName) {
  const { urlToClass, css } = await buildImageRegistry(assets);
  const windowRect = toCanvasRect(nuiData.genwnd?.properties?.rect);
  const windowAnimation = nuiData.genwnd?.properties?.ani;
  const windowBackgroundClass = (
    windowAnimation && typeof assets[windowAnimation] === 'string'
      ? urlToClass.get(assets[windowAnimation]) || ''
      : ''
  );

  const controlsMarkup = nuiData.controls
    .map(control => renderControlMarkup(control, assets, urlToClass))
    .join('');

  return `<!DOCTYPE html><meta charset=UTF-8><title>${escapeHtml(fileName || 'nui')}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh}.w{position:relative;width:${windowRect.w}px;height:${windowRect.h}px;overflow:hidden}.c{position:absolute;overflow:hidden}.s,.f{background-size:100% 100%}.f{position:absolute}.t{display:flex;justify-content:center;align-items:center;width:100%;height:100%;font:12px/1 sans-serif;color:#e0e0e0;text-shadow:1px 1px 2px rgba(0,0,0,.8);position:relative;z-index:1}${css}</style><div class="w${windowBackgroundClass ? ` ${windowBackgroundClass}` : ''}">${controlsMarkup}</div>`;
}
