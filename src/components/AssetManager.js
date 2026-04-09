import React from 'react';

function AssetManager({ assets }) {
  const getDisplayUrl = (assetData) => {
    if (!assetData) return null;

    if (typeof assetData === 'string') {
      return assetData;
    }

    if (assetData.frames && assetData.frames.length > 0) {
      return assetData.frames[0].url;
    }
    
    return null;
  };
  
  const getFrameCount = (assetData) => {
    if (!assetData) return 0;
    if (typeof assetData === 'string') return 1;
    if (assetData.frames) return assetData.frames.length;
    return 0;
  };

  const assetCount = Object.keys(assets).length;

  return (
    <div className="asset-manager">
      <div className="asset-header">Assets ({assetCount})</div>
      
      <div className="asset-list">
        {assetCount === 0 && (
          <div style={{color: 'var(--text-muted)', padding: '8px', textAlign: 'center', fontSize: '11px'}}>
            No assets loaded
          </div>
        )}
        {assetCount > 200 && (
          <div style={{
            color: 'var(--text-muted)', 
            fontStyle: 'italic', 
            marginBottom: '8px', 
            padding: '6px 8px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            Showing first 200 of {assetCount} assets
          </div>
        )}
        {Object.entries(assets).slice(0, 200).map(([name, assetData]) => {
          const displayUrl = getDisplayUrl(assetData);
          const frameCount = getFrameCount(assetData);
          return (
            <div key={name} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '2px',
              cursor: 'pointer'
            }}>
              {displayUrl ? (
                <img 
                  src={displayUrl} 
                  alt={name} 
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    marginRight: '8px', 
                    objectFit: 'contain',
                    flexShrink: 0
                  }} 
                />
              ) : (
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  marginRight: '8px', 
                  background: 'var(--bg-tertiary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '10px', 
                  color: 'var(--text-muted)',
                  borderRadius: '2px',
                  flexShrink: 0
                }}>?</div>
              )}
              <span 
                title={name} 
                style={{
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  color: 'var(--text-secondary)',
                  fontSize: '11px'
                }}
              >
                {name}
                {frameCount > 1 && (
                  <span style={{
                    marginLeft: '6px',
                    padding: '1px 5px',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 500
                  }}>
                    {frameCount}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AssetManager;
