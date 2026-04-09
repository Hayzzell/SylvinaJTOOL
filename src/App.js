import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { parseNui, generateNui } from './components/NuiParser';
import desktopBridge from './utils/desktopBridge';
import { decodeBytesWithEncoding, encodeTextWithEncoding, DEFAULT_ENCODING_INFO } from './utils/EncodingUtils';
import { base64ToBytes, bytesToBase64 } from './utils/base64';
import { CANVAS_SCALE_STEP, LEFT_PANEL_WIDTH, MAX_CANVAS_SCALE, MIN_CANVAS_SCALE, RIGHT_PANEL_WIDTH } from './utils/editorConstants';
import { formatRect, getRectSize, parseRect, ZERO_RECT } from './utils/nuiData';
import { useSpriteAssets } from './utils/useSpriteAssets';
import EditorCanvas from './components/EditorCanvas';
import PropertyPanel from './components/PropertyPanel';
import ControlTree from './components/ControlTree';
import AssetManager from './components/AssetManager';
import { exportAsHtml } from './utils/ExportHtmlCss';

const DEFAULT_NUI = `begin genwnd
id = new_window.nui;
rect = 0,0,400,300;
end
`;

const MAX_HISTORY = 50;
const NUI_DIALOG_FILTERS = [{ name: 'NUI Files', extensions: ['nui'] }];
const HTML_DIALOG_FILTERS = [{ name: 'HTML Files', extensions: ['html'] }];
const CONTROL_BUTTONS = [
  { type: 'button', label: '+ Button' },
  { type: 'static', label: '+ Static' },
  { type: 'check', label: '+ Check' },
  { type: 'edit', label: '+ Edit' },
  { type: 'image', label: '+ Image' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ensureExtension = (fileName, extension) => (
  fileName.toLowerCase().endsWith(extension) ? fileName : `${fileName}${extension}`
);

const isEditableElement = (element) => Boolean(
  element && (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  )
);

const hasSpriteAssetChange = (properties) => (
  Object.prototype.hasOwnProperty.call(properties, 'spr') ||
  Object.prototype.hasOwnProperty.call(properties, 'ani')
);

const mergeProperties = (target, newProps) => ({
  ...target,
  properties: {
    ...target.properties,
    ...newProps
  }
});

const pushHistorySnapshot = (historyRef, historyIndexRef, snapshot) => {
  const history = historyRef.current;
  const currentIndex = historyIndexRef.current;

  if (currentIndex >= 0 && history[currentIndex] === snapshot) {
    return;
  }

  if (currentIndex < history.length - 1) {
    history.splice(currentIndex + 1);
  }

  history.push(snapshot);

  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  historyIndexRef.current = history.length - 1;
};

const createControl = (type, index) => ({
  type,
  properties: {
    id: `new_${type}${index}`,
    rect: '0,0,100,20',
    caption: 'New Control'
  }
});

function App() {
  const isDesktopShell = desktopBridge.isDesktop === true;
  const [nuiData, setNuiData] = useState(parseNui(DEFAULT_NUI));
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [scale, setScale] = useState(1);
  const { assets, beginAssetLoad, loadAssetsFromNui, loadSpriteAsset } = useSpriteAssets();
  const [currentFileName, setCurrentFileName] = useState('new_window.nui');
  const [fileEncodingInfo, setFileEncodingInfo] = useState(DEFAULT_ENCODING_INFO);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const nuiDataRef = useRef(nuiData);
  const currentFileNameRef = useRef(currentFileName);
  const fileEncodingInfoRef = useRef(fileEncodingInfo);
  const currentFilePathRef = useRef(currentFilePath);
  const saveInProgressRef = useRef(false);

  nuiDataRef.current = nuiData;
  currentFileNameRef.current = currentFileName;
  fileEncodingInfoRef.current = fileEncodingInfo;
  currentFilePathRef.current = currentFilePath;

  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_PANEL_WIDTH.default);
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_WIDTH.default);
  const resizingRef = useRef(null);
  
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const isDraggingRef = useRef(false);

  const recordHistoryState = useCallback((nextNuiData) => {
    pushHistorySnapshot(historyRef, historyIndexRef, JSON.stringify(nextNuiData));
  }, []);

  const maybeLoadUpdatedSpriteAsset = useCallback((properties, nextProps) => {
    if (!hasSpriteAssetChange(nextProps)) {
      return;
    }

    if (properties.spr && properties.ani) {
      void loadSpriteAsset(properties.spr, properties.ani);
    }
  }, [loadSpriteAsset]);

  const updateControlRect = useCallback((index, getNextRect) => {
    setNuiData(prev => {
      const control = prev.controls[index];
      if (!control) {
        return prev;
      }

      const nextRect = getNextRect(parseRect(control.properties.rect, ZERO_RECT));
      const newControls = [...prev.controls];
      newControls[index] = {
        ...control,
        properties: {
          ...control.properties,
          rect: formatRect(nextRect)
        }
      };

      return { ...prev, controls: newControls };
    });
  }, []);

  const adjustScale = useCallback((delta) => {
    setScale(currentScale => clamp(currentScale + delta, MIN_CANVAS_SCALE, MAX_CANVAS_SCALE));
  }, []);

  const flushPendingEditorChanges = useCallback(async () => {
    const activeElement = document.activeElement;

    if (isEditableElement(activeElement)) {
      activeElement.blur();
    }

    await Promise.resolve();
    await new Promise(resolve => window.requestAnimationFrame(resolve));
  }, []);

  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    if (isDraggingRef.current) {
      return;
    }

    recordHistoryState(nuiData);
  }, [nuiData, recordHistoryState]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;
    
    if (currentIndex > 0) {
      historyIndexRef.current = currentIndex - 1;
      isUndoRedoRef.current = true;
      const previousState = JSON.parse(history[currentIndex - 1]);
      setNuiData(previousState);
    }
  }, []);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;
    
    if (currentIndex < history.length - 1) {
      historyIndexRef.current = currentIndex + 1;
      isUndoRedoRef.current = true;
      const nextState = JSON.parse(history[currentIndex + 1]);
      setNuiData(nextState);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIndices.length > 0) {
        if (isEditableElement(e.target)) {
          return;
        }

        e.preventDefault();
        deleteControl(selectedIndices);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedIndices]);
  const loadNuiBytes = async (bytes, options = {}) => {
    try {
      const { text, ...encodingInfo } = decodeBytesWithEncoding(bytes);

      const parsed = parseNui(text);
      setNuiData(parsed);
      setSelectedIndices([]);
      setFileEncodingInfo(encodingInfo);
      setCurrentFileName(options.name || 'new_window.nui');
      setCurrentFilePath(options.path || null);
      const assetLoadSession = beginAssetLoad();
      void loadAssetsFromNui(parsed, assetLoadSession);
    } catch (err) {
      alert('Failed to parse file');
      console.error(err);
    }
  };

  const handleOpenFile = async () => {
    try {
      const result = await desktopBridge.openFile();
      if (!result) return;

      const bytes = base64ToBytes(result.bytesBase64);
      await loadNuiBytes(bytes, { name: result.name, path: result.path });
    } catch (err) {
      alert('Failed to open file.');
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;

    try {
      await flushPendingEditorChanges();

      const text = generateNui(nuiDataRef.current);
      const filename = ensureExtension(currentFileNameRef.current || 'new_window.nui', '.nui');

      const encodedBytes = encodeTextWithEncoding(text, fileEncodingInfoRef.current);
      const payload = {
        bytesBase64: bytesToBase64(encodedBytes),
        suggestedName: filename,
        filters: NUI_DIALOG_FILTERS
      };

      if (currentFilePathRef.current) {
        await desktopBridge.saveFile({
          ...payload,
          path: currentFilePathRef.current
        });
        return;
      }

      const result = await desktopBridge.saveFileAs(payload);
      if (!result || result.canceled) {
        return;
      }

      setCurrentFileName(result.name || filename);
      setCurrentFilePath(result.path || null);
    } finally {
      saveInProgressRef.current = false;
    }
  };

  const handleSaveMouseDown = (e) => {
    e.preventDefault();
    void handleSave();
  };

  const handleSaveClick = (e) => {
    if (e.detail === 0) {
      void handleSave();
    }
  };

  const handleExportHtml = async () => {
    try {
      await flushPendingEditorChanges();

      const baseName = (currentFileNameRef.current || 'nui_export').replace(/\.nui$/i, '');
      const html = await exportAsHtml(nuiDataRef.current, assets, baseName);
      const encodedBytes = new TextEncoder().encode(html);
      await desktopBridge.saveFileAs({
        bytesBase64: bytesToBase64(encodedBytes),
        suggestedName: `${baseName}.html`,
        filters: HTML_DIALOG_FILTERS
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed – see console for details.');
    }
  };

  const updateGenWnd = (newProps) => {
    setNuiData(prev => {
      const genwnd = mergeProperties(prev.genwnd, newProps);
      maybeLoadUpdatedSpriteAsset(genwnd.properties, newProps);
      
      return {
        ...prev,
        genwnd
      };
    });
  };

  const updateControl = (index, newProps) => {
    setNuiData(prev => {
      const currentControl = prev.controls[index];
      if (!currentControl) {
        return prev;
      }

      const newControls = [...prev.controls];
      newControls[index] = mergeProperties(currentControl, newProps);
      maybeLoadUpdatedSpriteAsset(newControls[index].properties, newProps);
      
      return { ...prev, controls: newControls };
    });
  };

  const getReorderedIndex = useCallback((fromIndex, toIndex, position, totalControls) => {
    let nextIndex = toIndex + (position === 'after' ? 1 : 0);
    if (fromIndex < nextIndex) {
      nextIndex -= 1;
    }

    return clamp(nextIndex, 0, totalControls - 1);
  }, []);

  const reorderControls = useCallback((fromIndex, toIndex, position = 'before') => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;

    const totalControls = nuiData.controls.length;
    if (totalControls <= 1) return;

    const reorderedIndex = getReorderedIndex(fromIndex, toIndex, position, totalControls);
    if (reorderedIndex === fromIndex) return;

    setNuiData(prev => {
      const newControls = [...prev.controls];
      const [movedControl] = newControls.splice(fromIndex, 1);
      if (!movedControl) {
        return prev;
      }

      newControls.splice(reorderedIndex, 0, movedControl);
      return { ...prev, controls: newControls };
    });

    setSelectedIndices([reorderedIndex]);
  }, [getReorderedIndex, nuiData.controls.length]);
  
  const moveControlZOrder = (index, direction) => {
    if (index === null) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= nuiData.controls.length) return;

    reorderControls(index, newIndex, direction > 0 ? 'after' : 'before');
  };

  const addControl = (type) => {
    const nextIndex = nuiData.controls.length;
    setNuiData(prev => ({
      ...prev,
      controls: [...prev.controls, createControl(type, nextIndex)]
    }));
    setSelectedIndices([nextIndex]);
  };

  const deleteControl = (indexOrIndices) => {
    const indices = Array.isArray(indexOrIndices) ? indexOrIndices : [indexOrIndices];
    const toDelete = new Set(indices);
    setNuiData(prev => {
      const newControls = prev.controls.filter((_, i) => !toDelete.has(i));
      return { ...prev, controls: newControls };
    });
    setSelectedIndices([]);
  };

  const moveControl = useCallback((index, x, y) => {
    updateControlRect(index, currentRect => {
      const { width, height } = getRectSize(currentRect);

      return {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height
      };
    });
  }, [updateControlRect]);
  
  const resizeControl = useCallback((index, rectArr) => {
    updateControlRect(index, () => ({
      left: rectArr[0],
      top: rectArr[1],
      right: rectArr[2],
      bottom: rectArr[3]
    }));
  }, [updateControlRect]);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    recordHistoryState(nuiData);
  }, [nuiData, recordHistoryState]);

  const handleResizeStart = useCallback((side, e) => {
    e.preventDefault();
    const startWidth = side === 'left' ? leftPanelWidth : rightPanelWidth;
    resizingRef.current = { side, startX: e.clientX, startWidth };

    const onMouseMove = (ev) => {
      if (!resizingRef.current) return;
      const { side: s, startX, startWidth: sw } = resizingRef.current;
      const dx = ev.clientX - startX;
      if (s === 'left') {
        setLeftPanelWidth(clamp(sw + dx, LEFT_PANEL_WIDTH.min, LEFT_PANEL_WIDTH.max));
      } else {
        setRightPanelWidth(clamp(sw - dx, RIGHT_PANEL_WIDTH.min, RIGHT_PANEL_WIDTH.max));
      }
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftPanelWidth, rightPanelWidth]);

  if (!isDesktopShell) {
    return (
      <div className="App desktop-required">
        <div className="desktop-required-card">
          <h1>SylvinaJTOOL</h1>
          <p>This build only runs inside the standalone desktop application.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App desktop-shell">
      <header className="App-header">
        <div className="header-brand">
          <span className="header-brand-mark"></span>
          <h1>SylvinaJTOOL</h1>
        </div>
        <div className="toolbar">
          <button onClick={undo} title="Undo (Ctrl+Z)">↶</button>
          <button onClick={redo} title="Redo (Ctrl+Y)">↷</button>
          
          <div className="divider"></div>
          
          <button onClick={() => adjustScale(-CANVAS_SCALE_STEP)}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => adjustScale(CANVAS_SCALE_STEP)}>+</button>
          
          <div className="divider"></div>
          
          <button onClick={handleOpenFile}>Open</button>
          <button onMouseDown={handleSaveMouseDown} onClick={handleSaveClick}>Save</button>
          <button onClick={handleExportHtml} title="Export canvas as standalone HTML/CSS">Export HTML</button>
          
          <div className="divider"></div>

          {CONTROL_BUTTONS.map(control => (
            <button key={control.type} onClick={() => addControl(control.type)}>{control.label}</button>
          ))}
        </div>
      </header>
      <div className="main-container">
        <div className="left-panel" style={{ width: leftPanelWidth, minWidth: LEFT_PANEL_WIDTH.min }}>
          <ControlTree 
            data={nuiData} 
            selectedIndices={selectedIndices} 
            onSelect={setSelectedIndices} 
            onMoveZOrder={moveControlZOrder}
            onReorderControls={reorderControls}
          />
          <AssetManager assets={assets} />
        </div>
        <div className="panel-resize-handle" onMouseDown={(e) => handleResizeStart('left', e)} />
        <EditorCanvas 
          data={nuiData} 
          selectedIndices={selectedIndices} 
          onSelect={setSelectedIndices} 
          onMove={moveControl}
          onResize={resizeControl}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          scale={scale}
          setScale={setScale}
          assets={assets}
        />
        <div className="panel-resize-handle" onMouseDown={(e) => handleResizeStart('right', e)} />
        <PropertyPanel 
          data={nuiData}
          selectedIndices={selectedIndices}
          onUpdateGenWnd={updateGenWnd}
          onUpdateControl={updateControl}
          onDeleteControl={deleteControl}
          assets={assets}
          style={{ width: rightPanelWidth, minWidth: RIGHT_PANEL_WIDTH.min }}
        />
      </div>
    </div>
  );
}

export default App;
