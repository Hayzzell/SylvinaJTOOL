import React, { useRef, useState, useEffect, useCallback } from 'react';
import NineSlice from './NineSlice';

import { CANVAS_SCALE_STEP, MAX_CANVAS_SCALE, MIN_CANVAS_SCALE } from '../utils/editorConstants';
import { getNextSelectedIndices } from '../utils/controlSelection';
import { stripWrappingQuotes, toCanvasRect } from '../utils/nuiData';

const isFrameAsset = (assetData) => Boolean(assetData && typeof assetData === 'object' && assetData.frames);
const isLayeredAsset = (assetData) => Boolean(assetData && typeof assetData === 'object' && assetData.layers);

const getIntersectingControlIndices = (controls, selectionBox) => {
  const minX = Math.min(selectionBox.startX, selectionBox.currentX);
  const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
  const minY = Math.min(selectionBox.startY, selectionBox.currentY);
  const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

  return controls.reduce((indices, control, index) => {
    const rect = toCanvasRect(control.properties.rect);
    const intersects = !(
      rect.x + rect.w < minX ||
      rect.x > maxX ||
      rect.y + rect.h < minY ||
      rect.y > maxY
    );

    if (intersects) {
      indices.push(index);
    }

    return indices;
  }, []);
};

const getControlLabel = (control) => (
  stripWrappingQuotes(control.properties.caption) || control.properties.id || control.type
);

function EditorCanvas({ data, selectedIndices, onSelect, onMove, onResize, onDragStart, onDragEnd, scale, setScale, assets }) {
  const containerRef = useRef(null);
  const viewportRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [panState, setPanState] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [breathOffset, setBreathOffset] = useState({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState(null);
  const justFinishedMarqueeRef = useRef(false);
  const breathPhaseRef = useRef(0);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -CANVAS_SCALE_STEP : CANVAS_SCALE_STEP;
    setScale(currentScale => Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, currentScale + delta)));
  }, [setScale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const getViewportPoint = useCallback((clientX, clientY) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return null;
    }

    const viewportRect = viewport.getBoundingClientRect();
    return {
      x: (clientX - viewportRect.left) / scale,
      y: (clientY - viewportRect.top) / scale
    };
  }, [scale]);

  const genRect = toCanvasRect(data.genwnd?.properties?.rect);
  
  const handleMouseDown = (e, index, type, handle) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (e.ctrlKey || !selectedIndices.includes(index)) {
      onSelect(getNextSelectedIndices(selectedIndices, index, e.ctrlKey));
    }
    
    if (onDragStart) onDragStart();
    
    setDragState({
      index,
      startX: e.clientX,
      startY: e.clientY,
      initialRect: toCanvasRect(data.controls[index].properties.rect),
      initialRects: selectedIndices.includes(index) 
        ? selectedIndices.map(i => ({ index: i, rect: toCanvasRect(data.controls[i].properties.rect) }))
        : [{ index, rect: toCanvasRect(data.controls[index].properties.rect) }],
      type,
      handle
    });
  };

  const handleCanvasMouseDown = (e) => {
    if ((e.button === 0 && e.altKey) || e.button === 1) {
        e.preventDefault();
        setPanState({
            startX: e.clientX,
            startY: e.clientY,
            initialX: offset.x,
            initialY: offset.y
        });
    } else if (e.button === 0 && e.target === containerRef.current) {
      const point = getViewportPoint(e.clientX, e.clientY);
      if (!point) return;
      
      setSelectionBox({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y
      });
      
      if (!e.ctrlKey) {
        onSelect([]);
      }
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (dragState) {
        const dx = (e.clientX - dragState.startX) / scale;
        const dy = (e.clientY - dragState.startY) / scale;
        
        if (dragState.type === 'move') {
          if (dragState.initialRects && dragState.initialRects.length > 1) {
            dragState.initialRects.forEach(({ index: idx, rect }) => {
              const newX = rect.x + dx;
              const newY = rect.y + dy;
              onMove(idx, Math.round(newX), Math.round(newY));
            });
          } else {
            const newX = dragState.initialRect.x + dx;
            const newY = dragState.initialRect.y + dy;
            onMove(dragState.index, Math.round(newX), Math.round(newY));
          }
        } else if (dragState.type === 'resize') {
          let { x, y, w, h } = dragState.initialRect;

          if (dragState.handle.includes('e')) w += dx;
          if (dragState.handle.includes('s')) h += dy;
          if (dragState.handle.includes('w')) { x += dx; w -= dx; }
          if (dragState.handle.includes('n')) { y += dy; h -= dy; }
          
          const r = x + w;
          const b = y + h;
          
          onResize(dragState.index, [Math.round(x), Math.round(y), Math.round(r), Math.round(b)]);
        }
    } else if (panState) {
        const dx = e.clientX - panState.startX;
        const dy = e.clientY - panState.startY;
        setOffset({
            x: panState.initialX + dx,
            y: panState.initialY + dy
        });
    } else if (selectionBox) {
        const point = getViewportPoint(e.clientX, e.clientY);
        if (!point) return;
        
        setSelectionBox(prev => ({
          ...prev,
          currentX: point.x,
          currentY: point.y
        }));
    }
  }, [dragState, getViewportPoint, onMove, onResize, panState, scale, selectionBox]);

  const handleMouseUp = useCallback((e) => {
    if (dragState && onDragEnd) onDragEnd();

    if (selectionBox) {
      const intersectingIndices = getIntersectingControlIndices(data.controls, selectionBox);

      if (e && e.ctrlKey) {
        const combined = [...new Set([...selectedIndices, ...intersectingIndices])];
        onSelect(combined);
      } else {
        onSelect(intersectingIndices);
      }

      justFinishedMarqueeRef.current = true;
      setTimeout(() => { justFinishedMarqueeRef.current = false; }, 0);
    }
    
    setDragState(null);
    setPanState(null);
    setSelectionBox(null);
  }, [dragState, selectionBox, selectedIndices, data.controls, onDragEnd, onSelect]);

  useEffect(() => {
    if (dragState || panState || selectionBox) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, panState, selectionBox, handleMouseMove, handleMouseUp]);

  const handleContainerMouseMove = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const offsetX = (mouseX - centerX) / 25;
    const offsetY = (mouseY - centerY) / 25;
    
    setMouseOffset({ x: offsetX, y: offsetY });
  }, []);

  useEffect(() => {
    let animationId;
    const animate = () => {
      breathPhaseRef.current += 0.015;
      const breathX = Math.sin(breathPhaseRef.current) * 2 + Math.sin(breathPhaseRef.current * 0.7) * 1;
      const breathY = Math.cos(breathPhaseRef.current * 0.8) * 2 + Math.cos(breathPhaseRef.current * 0.5) * 1;
      
      setBreathOffset({ x: breathX, y: breathY });
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const combinedOffset = {
    x: breathOffset.x + mouseOffset.x * 0.5,
    y: breathOffset.y + mouseOffset.y * 0.5
  };

  const selectionBoxStyle = selectionBox ? {
    left: Math.min(selectionBox.startX, selectionBox.currentX),
    top: Math.min(selectionBox.startY, selectionBox.currentY),
    width: Math.abs(selectionBox.currentX - selectionBox.startX),
    height: Math.abs(selectionBox.currentY - selectionBox.startY)
  } : null;

  return (
    <div 
      className="editor-canvas-container" 
      ref={containerRef} 
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleContainerMouseMove}
      onClick={(e) => { 
        if (e.target === e.currentTarget && !justFinishedMarqueeRef.current) {
          onSelect([]); 
        }
      }}
      style={{
        backgroundPosition: `${combinedOffset.x}px ${combinedOffset.y}px`
      }}
    >
      <div 
        className="canvas-viewport" 
        ref={viewportRef}
        style={{
          width: genRect.w, 
          height: genRect.h, 
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          backgroundImage: assets[data.genwnd?.properties?.ani] ? `url(${assets[data.genwnd.properties.ani]})` : undefined,
          backgroundSize: '100% 100%'
        }}
        onClick={(e) => { 
          e.stopPropagation(); 
          if (!justFinishedMarqueeRef.current) {
            onSelect([]); 
          }
        }}
      >
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '1px solid #777', pointerEvents: 'none'}}>
            {!assets[data.genwnd?.properties?.ani] && <span style={{color: '#777', fontSize: 10, padding: 2}}>Window Area ({genRect.w}x{genRect.h})</span>}
        </div>

        {selectionBoxStyle && (
          <div 
            className="selection-marquee"
            style={{
              position: 'absolute',
              left: selectionBoxStyle.left,
              top: selectionBoxStyle.top,
              width: selectionBoxStyle.width,
              height: selectionBoxStyle.height,
              border: '1px dashed var(--accent)',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        )}

        {data.controls.map((control, index) => {
          const rect = toCanvasRect(control.properties.rect);
          const isSelected = selectedIndices.includes(index);
          const assetData = assets[control.properties.ani];

          const isMultiFrame = isFrameAsset(assetData);
          const isLayered = isLayeredAsset(assetData);
          const bgImageUrl = (isMultiFrame || isLayered) ? null : (typeof assetData === 'string' ? assetData : null);
          
          return (
            <div
              key={index}
              className={`control-box ${isSelected ? 'selected' : ''}`}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
                backgroundSize: '100% 100%',
                position: 'absolute'
              }}
              onMouseDown={(e) => handleMouseDown(e, index, 'move')}
              onClick={(e) => e.stopPropagation()}
              title={`${control.type}: ${control.properties.id}`}
            >
              {isMultiFrame && (
                <NineSlice 
                  frames={assetData.frames} 
                  width={rect.w} 
                  height={rect.h}
                />
              )}

              {isLayered && assetData.layers.map((layer, li) => {
                const la = layer.asset;
                const layerIsMulti = la && typeof la === 'object' && la.frames;
                const layerUrl = typeof la === 'string' ? la : null;
                return (
                  <div key={li} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none'}}>
                    {layerIsMulti && <NineSlice frames={la.frames} width={rect.w} height={rect.h} />}
                    {layerUrl && <div style={{width: '100%', height: '100%', backgroundImage: `url(${layerUrl})`, backgroundSize: '100% 100%'}} />}
                  </div>
                );
              })}
              
              {!assetData && getControlLabel(control)}
              
              {isSelected && (
                <>
                  <div className="resize-handle rh-nw" onMouseDown={(e) => handleMouseDown(e, index, 'resize', 'nw')} />
                  <div className="resize-handle rh-ne" onMouseDown={(e) => handleMouseDown(e, index, 'resize', 'ne')} />
                  <div className="resize-handle rh-sw" onMouseDown={(e) => handleMouseDown(e, index, 'resize', 'sw')} />
                  <div className="resize-handle rh-se" onMouseDown={(e) => handleMouseDown(e, index, 'resize', 'se')} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EditorCanvas;
