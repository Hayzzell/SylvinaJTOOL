import { useCallback, useRef, useState } from 'react';
import desktopBridge from './desktopBridge';
import { parseSpr } from './SprParser';
import { loadTgaAsDataUrl, isTgaFile } from './TgaLoader';

const COMMON_SPR_FILES = ['05_ui.spr', 'ui_frame.spr'];
const IMAGE_FOLDERS = ['png', 'tga', 'dds', 'jpg'];

const parseAniNames = (aniValue) => {
  if (!aniValue) {
    return [];
  }

  return aniValue
    .split('/')
    .map(value => value.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean);
};

const addSpriteRequest = (requestMap, sprFilename, aniName) => {
  if (!sprFilename || !aniName) {
    return;
  }

  if (!requestMap.has(sprFilename)) {
    requestMap.set(sprFilename, new Set());
  }

  requestMap.get(sprFilename).add(aniName);
};

const preloadFrames = (frames) => {
  frames.forEach(frame => {
    const image = new Image();
    image.src = frame.url;
  });
};

const toAssetEntry = (frames) => (
  frames.length === 1
    ? frames[0].url
    : { frames, frameCount: frames.length }
);

export const useSpriteAssets = () => {
  const [assets, setAssets] = useState({});
  const parsedSprCacheRef = useRef({});
  const imagePathCacheRef = useRef({});
  const loadStateRef = useRef({ session: 0, names: new Set() });

  const isActiveSession = useCallback(
    session => loadStateRef.current.session === session,
    []
  );

  const releasePendingAsset = useCallback((aniName, session) => {
    if (isActiveSession(session)) {
      loadStateRef.current.names.delete(aniName);
    }
  }, [isActiveSession]);

  const beginAssetLoad = useCallback(() => {
    const nextSession = loadStateRef.current.session + 1;
    loadStateRef.current = { session: nextSession, names: new Set() };
    setAssets({});
    return nextSession;
  }, []);

  const parseSprFile = useCallback(async (sprFilename) => {
    if (!sprFilename) {
      return null;
    }

    const cacheKey = sprFilename.toLowerCase();
    if (parsedSprCacheRef.current[cacheKey]) {
      return parsedSprCacheRef.current[cacheKey];
    }

    try {
      const text = await desktopBridge.readAssetText(`spr/${sprFilename}`);
      if (!text) {
        console.warn(`SPR file not found: ${sprFilename}`);
        return null;
      }

      const parsed = parseSpr(text);
      parsedSprCacheRef.current[cacheKey] = parsed;
      return parsed;
    } catch (error) {
      console.error(`Failed to parse SPR: ${sprFilename}`, error);
      return null;
    }
  }, []);

  const resolveImagePath = useCallback(async (textureName) => {
    const cacheKey = textureName.toLowerCase();
    if (imagePathCacheRef.current[cacheKey]) {
      return imagePathCacheRef.current[cacheKey];
    }

    const baseName = cacheKey.replace(/\.(tga|png|dds|jpg)$/i, '');
    for (const folder of IMAGE_FOLDERS) {
      const candidate = `${folder}/${baseName}.${folder}`;
      try {
        const assetUrl = await desktopBridge.getAssetUrl(candidate);
        if (assetUrl) {
          imagePathCacheRef.current[cacheKey] = assetUrl;
          return assetUrl;
        }
      } catch {
      }
    }

    return null;
  }, []);

  const resolveFrames = useCallback(async (frames) => {
    const resolvedFrames = await Promise.all(frames.map(async frame => {
      const url = await resolveImagePath(frame.texture);
      if (!url) {
        return null;
      }

      return {
        url,
        width: frame.width,
        height: frame.height,
        needsDecode: isTgaFile(url)
      };
    }));

    const availableFrames = resolvedFrames.filter(Boolean);
    if (!availableFrames.some(frame => frame.needsDecode)) {
      return availableFrames.map(({ needsDecode, ...frame }) => frame);
    }

    const decodedFrames = await Promise.all(availableFrames.map(async frame => {
      if (!frame.needsDecode) {
        const { needsDecode, ...rest } = frame;
        return rest;
      }

      try {
        return {
          url: await loadTgaAsDataUrl(frame.url),
          width: frame.width,
          height: frame.height
        };
      } catch (error) {
        console.warn(`Failed to decode TGA: ${frame.url}`, error);
        return null;
      }
    }));

    return decodedFrames.filter(Boolean);
  }, [resolveImagePath]);

  const storeResolvedAsset = useCallback((aniName, frames, session) => {
    if (!isActiveSession(session) || frames.length === 0) {
      return;
    }

    preloadFrames(frames);
    setAssets(prev => (isActiveSession(session)
      ? { ...prev, [aniName]: toAssetEntry(frames) }
      : prev
    ));
  }, [isActiveSession]);

  const storeCompoundAsset = useCallback((aniName, subNames, session) => {
    setAssets(prev => {
      if (!isActiveSession(session)) {
        return prev;
      }

      const resolvedSubNames = subNames.filter(name => prev[name] !== undefined);
      if (resolvedSubNames.length === 0) {
        loadStateRef.current.names.delete(aniName);
        return prev;
      }

      if (resolvedSubNames.length === 1) {
        return { ...prev, [aniName]: prev[resolvedSubNames[0]] };
      }

      return {
        ...prev,
        [aniName]: {
          layers: resolvedSubNames.map(name => ({ name, asset: prev[name] }))
        }
      };
    });
  }, [isActiveSession]);

  const loadSpriteAsset = useCallback(async function loadSpriteAsset(sprFilename, aniName, session = loadStateRef.current.session) {
    const loadedNames = isActiveSession(session) ? loadStateRef.current.names : null;
    if (!loadedNames || !aniName || loadedNames.has(aniName)) {
      return;
    }

    loadedNames.add(aniName);
    const subNames = parseAniNames(aniName);

    if (subNames.length === 0) {
      releasePendingAsset(aniName, session);
      return;
    }

    if (subNames.length > 1 || subNames[0] !== aniName) {
      await Promise.all(subNames.map(name => loadSpriteAsset(sprFilename, name, session)));
      storeCompoundAsset(aniName, subNames, session);
      return;
    }

    let frames = null;

    if (sprFilename) {
      const parsed = await parseSprFile(sprFilename);
      frames = parsed?.[aniName] || null;
    }

    if (!frames) {
      for (const parsed of Object.values(parsedSprCacheRef.current)) {
        if (parsed[aniName]) {
          frames = parsed[aniName];
          break;
        }
      }
    }

    if (!frames) {
      for (const fallbackSpr of COMMON_SPR_FILES) {
        const parsed = await parseSprFile(fallbackSpr);
        if (parsed?.[aniName]) {
          frames = parsed[aniName];
          break;
        }
      }
    }

    if (!frames || frames.length === 0) {
      console.warn(`Sprite '${aniName}' not found in any SPR file`);
      releasePendingAsset(aniName, session);
      return;
    }

    const resolvedFrames = await resolveFrames(frames);
    if (resolvedFrames.length === 0) {
      releasePendingAsset(aniName, session);
      return;
    }

    storeResolvedAsset(aniName, resolvedFrames, session);
  }, [isActiveSession, parseSprFile, releasePendingAsset, resolveFrames, storeCompoundAsset, storeResolvedAsset]);

  const loadAssetsFromNui = useCallback(async (parsedNui, session = loadStateRef.current.session) => {
    const requestMap = new Map();

    addSpriteRequest(
      requestMap,
      parsedNui.genwnd?.properties?.spr,
      parsedNui.genwnd?.properties?.ani
    );

    parsedNui.controls.forEach(control => {
      addSpriteRequest(requestMap, control.properties.spr, control.properties.ani);
    });

    await Promise.all(
      [...requestMap.entries()].flatMap(([sprFilename, aniNames]) => (
        [...aniNames].map(aniName => loadSpriteAsset(sprFilename, aniName, session))
      ))
    );
  }, [loadSpriteAsset]);

  return {
    assets,
    beginAssetLoad,
    loadAssetsFromNui,
    loadSpriteAsset
  };
};