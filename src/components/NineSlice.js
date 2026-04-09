import React from 'react';

/**
 * NineSlice component renders a 9-slice sprite properly
 * The sprite frames are expected in order: 
 * 1=TL, 2=T, 3=TR, 4=L, 5=C, 6=R, 7=BL, 8=B, 9=BR
 */
function NineSlice({ frames, width, height, style }) {
  if (!frames || frames.length === 0) {
    return null;
  }

  // If only 1 frame, just render it normally
  if (frames.length === 1) {
    return (
      <div
        style={{
          ...style,
          width,
          height,
          backgroundImage: `url(${frames[0].url})`,
          backgroundSize: '100% 100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    );
  }

  // For 9-slice, we need exactly 9 frames
  // Frame order: TL, T, TR, L, C, R, BL, B, BR
  const frameCount = frames.length;
  
  // Get corner size from the first frame (top-left corner)
  const cornerW = frames[0]?.width || 10;
  const cornerH = frames[0]?.height || 10;
  
  // Calculate middle section size
  const middleW = Math.max(0, width - cornerW * 2);
  const middleH = Math.max(0, height - cornerH * 2);

  // Handle 9-slice layout
  if (frameCount >= 9) {
    return (
      <div style={{ ...style, width, height, position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}>
        {/* Top row */}
        <img src={frames[0].url} alt="" style={{ position: 'absolute', left: 0, top: 0, width: cornerW, height: cornerH }} />
        <img src={frames[1].url} alt="" style={{ position: 'absolute', left: cornerW, top: 0, width: middleW, height: cornerH }} />
        <img src={frames[2].url} alt="" style={{ position: 'absolute', right: 0, top: 0, width: cornerW, height: cornerH }} />
        
        {/* Middle row */}
        <img src={frames[3].url} alt="" style={{ position: 'absolute', left: 0, top: cornerH, width: cornerW, height: middleH }} />
        <img src={frames[4].url} alt="" style={{ position: 'absolute', left: cornerW, top: cornerH, width: middleW, height: middleH }} />
        <img src={frames[5].url} alt="" style={{ position: 'absolute', right: 0, top: cornerH, width: cornerW, height: middleH }} />
        
        {/* Bottom row */}
        <img src={frames[6].url} alt="" style={{ position: 'absolute', left: 0, bottom: 0, width: cornerW, height: cornerH }} />
        <img src={frames[7].url} alt="" style={{ position: 'absolute', left: cornerW, bottom: 0, width: middleW, height: cornerH }} />
        <img src={frames[8].url} alt="" style={{ position: 'absolute', right: 0, bottom: 0, width: cornerW, height: cornerH }} />
      </div>
    );
  }

  // Handle 3-slice horizontal (3 frames: L, C, R)
  if (frameCount === 3) {
    const edgeW = frames[0]?.width || 10;
    const centerW = Math.max(0, width - edgeW * 2);
    
    return (
      <div style={{ ...style, width, height, position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}>
        <img src={frames[0].url} alt="" style={{ position: 'absolute', left: 0, top: 0, width: edgeW, height: '100%' }} />
        <img src={frames[1].url} alt="" style={{ position: 'absolute', left: edgeW, top: 0, width: centerW, height: '100%' }} />
        <img src={frames[2].url} alt="" style={{ position: 'absolute', right: 0, top: 0, width: edgeW, height: '100%' }} />
      </div>
    );
  }

  // Fallback: just show first frame stretched
  return (
    <div
      style={{
        ...style,
        width,
        height,
        backgroundImage: `url(${frames[0].url})`,
        backgroundSize: '100% 100%',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
}

export default NineSlice;
