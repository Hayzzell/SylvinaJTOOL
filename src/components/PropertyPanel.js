import React, { useState } from 'react';

import { parseFlags } from './NuiParser';

const STYLES = [
  'KSTYLE_NOCLOSE', 'KSTYLE_NOMINIMIZE', 'KSTYLE_NORESIZE', 'KSTYLE_NOTITLE', 
  'KSTYLE_NOSTATUSBAR', 'KSTYLE_VSCROLL', 'KSTYLE_HSCROLL', 'KSTYLE_NOFRAME', 
  'KSTYLE_NOTOPFRAME', 'KSTYLE_NOBACKGROUND', 'KSTYLE_RESIZE_LEFT', 
  'KSTYLE_RESIZE_TOP', 'KSTYLE_MOVE_BY_ALL', 'KSTYLE_MOVE_BY_CUSTOM', 
  'KSTYLE_NO_CLIPPING', 'KSTYLE_VERTICAL_REPEAT', 'KSTYLE_HORIZONTAL_REPEAT', 
  'KSTYLE_SPR_CAPTION', 'KSTYLE_ALPHA_SHOW'
];

const FLAGS = [
  'KFLAG_NO_GET_MESSAGE', 'KFLAG_GET_PASS_MESSAGE', 'KFLAG_CAN_DRAG', 'KFLAG_SINGLE_LINE'
];

const ANCHORS = [
  'KANCHOR_LEFT', 'KANCHOR_TOP', 'KANCHOR_RIGHT', 'KANCHOR_BOTTOM'
];

const PROPERTY_SECTIONS = [
  {
    title: 'Styles',
    propertyKey: 'style',
    options: STYLES,
    isVisible: (isGenWnd) => isGenWnd
  },
  {
    title: 'Flags',
    propertyKey: 'flag',
    options: FLAGS,
    isVisible: () => true
  },
  {
    title: 'Anchors',
    propertyKey: 'anchor',
    options: ANCHORS,
    isVisible: (isGenWnd) => !isGenWnd
  }
];

const getExpandableTextareaStyle = (expanded) => ({
  height: expanded ? '120px' : '28px',
  resize: 'none',
  transition: 'height 0.25s ease-in-out',
  overflow: expanded ? 'auto' : 'hidden',
  lineHeight: expanded ? '1.4' : '28px',
  padding: expanded ? '8px' : '0 8px'
});

const toggleFlagValue = (currentValue, option, checked) => {
  const nextValues = new Set(parseFlags(currentValue));

  if (checked) {
    nextValues.add(option);
  } else {
    nextValues.delete(option);
  }

  return [...nextValues].join(' | ');
};

function PropertyCheckboxSection({ title, propertyKey, options, propertyValues, onToggle }) {
  const selectedOptions = new Set(parseFlags(propertyValues[propertyKey]));

  return (
    <div className="property-group">
      <label>{title}</label>
      <div className="checkbox-group">
        {options.map(option => (
          <div key={option} className="checkbox-item">
            <input
              type="checkbox"
              checked={selectedOptions.has(option)}
              onChange={(event) => onToggle(propertyKey, option, event.target.checked)}
            />
            <span>{option.replace(/^[KA-Z]+_/, '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandableTextareaField({ label, value, placeholder, expanded, onChange, onToggleExpanded }) {
  return (
    <div className="property-group">
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onDoubleClick={onToggleExpanded}
        style={getExpandableTextareaStyle(expanded)}
      />
    </div>
  );
}

function PropertyPanel({ data, selectedIndices = [], onUpdateGenWnd, onUpdateControl, onDeleteControl, assets, style }) {
  const [expandedFields, setExpandedFields] = useState({
    caption: false,
    info: false
  });
  
  if (!data) {
    return <div className="property-panel" style={style}><span style={{color: 'var(--text-muted)'}}>No Data</span></div>;
  }

  const isGenWnd = selectedIndices.length === 0;
  const selectedIndex = selectedIndices.length > 0 ? selectedIndices[0] : null;
  const target = isGenWnd ? data.genwnd : data.controls[selectedIndex];
  const multiSelectCount = selectedIndices.length;

  if (!target) {
    return <div className="property-panel" style={style}><span style={{color: 'var(--text-muted)'}}>Select an item</span></div>;
  }

  const targetProperties = target.properties || {};
  const assetOptions = Object.keys(assets).sort();

  const toggleExpandedField = (field) => {
    setExpandedFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChange = (key, value) => {
    if (isGenWnd) {
      onUpdateGenWnd({ [key]: value });
    } else {
      onUpdateControl(selectedIndex, { [key]: value });
    }
  };

  const handleSectionToggle = (propertyKey, option, checked) => {
    handleChange(propertyKey, toggleFlagValue(targetProperties[propertyKey], option, checked));
  };

  return (
    <div className="property-panel" style={style}>
      <h3>{isGenWnd ? 'Window Properties' : `Control: ${target.type}`}</h3>
      
      {multiSelectCount > 1 && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: 'var(--accent-subtle)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--accent)'
        }}>
          {multiSelectCount} controls selected
        </div>
      )}
      
      {!isGenWnd && (
        <div className="property-group">
           <button onClick={() => onDeleteControl(selectedIndices)}>
             Delete {multiSelectCount > 1 ? `${multiSelectCount} Controls` : 'Control'}
           </button>
        </div>
      )}

      <div className="property-group">
        <label>ID</label>
        <input 
          value={targetProperties.id || ''} 
          onChange={(e) => handleChange('id', e.target.value)} 
        />
      </div>

      <div className="property-group">
        <label>Rect (left, top, right, bottom)</label>
        <input 
          value={targetProperties.rect || ''} 
          onChange={(e) => handleChange('rect', e.target.value)} 
          placeholder="0, 0, 100, 100"
        />
      </div>

      <div className="property-group">
        <label>Sprite File</label>
        <input 
            value={targetProperties.spr || ''} 
            onChange={(e) => handleChange('spr', e.target.value)} 
            list="asset-list"
            placeholder="ui_frame.spr"
        />
        <datalist id="asset-list">
            {assetOptions.map(opt => <option key={opt} value={opt} />)}
        </datalist>
      </div>

      {PROPERTY_SECTIONS
        .filter(section => section.isVisible(isGenWnd))
        .map(section => (
          <PropertyCheckboxSection
            key={section.title}
            title={section.title}
            propertyKey={section.propertyKey}
            options={section.options}
            propertyValues={targetProperties}
            onToggle={handleSectionToggle}
          />
        ))}

      {!isGenWnd && (
        <>
            <ExpandableTextareaField
              label="Caption"
              value={targetProperties.caption || ''}
              placeholder="Button text..."
              expanded={expandedFields.caption}
              onChange={(value) => handleChange('caption', value)}
              onToggleExpanded={() => toggleExpandedField('caption')}
            />
            <ExpandableTextareaField
              label="Info (Tooltip)"
              value={targetProperties.info || ''}
              placeholder="Hover tooltip..."
              expanded={expandedFields.info}
              onChange={(value) => handleChange('info', value)}
              onToggleExpanded={() => toggleExpandedField('info')}
            />
            <div className="property-group">
                <label>Animation</label>
                <input 
                  value={targetProperties.ani || ''} 
                  onChange={(e) => handleChange('ani', e.target.value)} 
                  placeholder="sprite_name"
                />
            </div>
        </>
      )}

    </div>
  );
}

export default PropertyPanel;
