import { invoke } from '@tauri-apps/api/core';

import { base64ToBytes } from './base64';

const MIME_TYPES = {
  '.dds': 'application/octet-stream',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.nui': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.spr': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.tga': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const assetUrlCache = new Map();

const normalizeAssetPath = (relativePath) => relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
const invokeAssetCommand = (command, relativePath) => invoke(command, { relativePath: normalizeAssetPath(relativePath) });

const getMimeType = (relativePath) => {
  const match = /\.[^.]+$/.exec(relativePath.toLowerCase());
  return MIME_TYPES[match?.[0] || ''] || 'application/octet-stream';
};

const createObjectUrl = (base64, mimeType) => {
  const bytes = base64ToBytes(base64);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

const desktopBridge = {
  isDesktop: typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__),

  openFile() {
    return invoke('open_nui_file');
  },

  saveFile(payload) {
    return invoke('save_file', { payload });
  },

  saveFileAs(payload) {
    return invoke('save_file_as', { payload });
  },

  readAssetText(relativePath) {
    return invokeAssetCommand('read_asset_text', relativePath);
  },

  async getAssetUrl(relativePath) {
    const normalizedPath = normalizeAssetPath(relativePath);
    if (assetUrlCache.has(normalizedPath)) {
      return assetUrlCache.get(normalizedPath);
    }

    const bytesBase64 = await invokeAssetCommand('read_asset_bytes', normalizedPath);
    if (!bytesBase64) {
      return null;
    }

    const assetUrl = createObjectUrl(bytesBase64, getMimeType(normalizedPath));
    assetUrlCache.set(normalizedPath, assetUrl);
    return assetUrl;
  }
};

export default desktopBridge;