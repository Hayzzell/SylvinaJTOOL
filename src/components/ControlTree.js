import React, { useState } from 'react';

import { getNextSelectedIndices } from '../utils/controlSelection';

const SEARCH_INPUT_STYLE = {
  flex: 1,
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  padding: '4px 8px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  outline: 'none'
};

const TREE_ACTIONS_STYLE = {
  display: 'flex',
  gap: '4px'
};

const EMPTY_STATE_STYLE = {
  padding: '12px',
  color: 'var(--text-muted)',
  fontSize: '12px'
};

function ControlTree({ data, selectedIndices = [], onSelect, onMoveZOrder, onReorderControls }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  
  if (!data) return <div className="control-tree"><div style={{padding: '16px', color: 'var(--text-muted)'}}>Loading...</div></div>;

  const normalizedSearchTerm = searchTerm.toLowerCase();
  const canDragReorder = normalizedSearchTerm.length === 0;

  const filteredControls = data.controls
    .map((control, index) => ({ control, index }))
    .filter(({ control }) => {
      if (!normalizedSearchTerm) return true;
      const id = (control.properties.id || '').toLowerCase();
      const type = (control.type || '').toLowerCase();
      return id.includes(normalizedSearchTerm) || type.includes(normalizedSearchTerm);
    });

  const handleItemClick = (index, event) => {
    onSelect(getNextSelectedIndices(selectedIndices, index, event.ctrlKey));
  };

  const resolveDropPosition = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    return e.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
  };

  const handleDragStart = (index, e) => {
    if (!canDragReorder) {
      e.preventDefault();
      return;
    }

    if (!selectedIndices.includes(index)) {
      onSelect([index]);
    }

    setDraggedIndex(index);
    setDropTarget(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index, e) => {
    if (!canDragReorder || draggedIndex === null) return;

    e.preventDefault();
    if (draggedIndex === index) {
      setDropTarget(null);
      return;
    }

    const position = resolveDropPosition(e);
    setDropTarget({ index, position });
    e.dataTransfer.dropEffect = 'move';
  };

  const clearDragState = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDrop = (index, e) => {
    if (!canDragReorder || draggedIndex === null) return;

    e.preventDefault();
    const position = resolveDropPosition(e);
    onReorderControls?.(draggedIndex, index, position);
    clearDragState();
  };

  const firstSelectedIndex = selectedIndices.length > 0 ? selectedIndices[0] : null;

  return (
    <div className="control-tree">
      <div className="tree-header">
          <input
            type="text"
            placeholder="Search controls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={SEARCH_INPUT_STYLE}
          />
          <div style={TREE_ACTIONS_STYLE}>
              <button disabled={firstSelectedIndex === null} onClick={() => onMoveZOrder(firstSelectedIndex, -1)}>↑</button>
              <button disabled={firstSelectedIndex === null} onClick={() => onMoveZOrder(firstSelectedIndex, 1)}>↓</button>
          </div>
      </div>
      {!searchTerm && (
        <div 
          className={`tree-item ${selectedIndices.length === 0 ? 'selected' : ''}`}
          onClick={(e) => handleItemClick(null, e)}
        >
          <span style={{marginRight: '8px', opacity: 0.6}}>◻</span>
          {data.genwnd.properties?.id || 'Main Window'}
        </div>
      )}
      {filteredControls.map(({ control, index }) => (
        <div 
          key={index} 
          className={`tree-item ${selectedIndices.includes(index) ? 'selected' : ''} ${draggedIndex === index ? 'dragging' : ''} ${dropTarget?.index === index ? `drop-${dropTarget.position}` : ''}`}
          onClick={(e) => handleItemClick(index, e)}
          draggable={canDragReorder}
          onDragStart={(e) => handleDragStart(index, e)}
          onDragOver={(e) => handleDragOver(index, e)}
          onDrop={(e) => handleDrop(index, e)}
          onDragEnd={clearDragState}
          style={{paddingLeft: searchTerm ? '12px' : '28px'}}
        >
          <span className="tree-item-grip">⋮⋮</span>
          <span style={{marginRight: '8px', opacity: 0.6}}>▸</span>
          {control.properties.id || `<${control.type}>`}
        </div>
      ))}
      {searchTerm && filteredControls.length === 0 && (
        <div style={EMPTY_STATE_STYLE}>
          No controls found
        </div>
      )}
    </div>
  );
}

export default ControlTree;
