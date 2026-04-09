export const ZERO_RECT = Object.freeze({
  left: 0,
  top: 0,
  right: 0,
  bottom: 0
});

export const DEFAULT_CONTROL_RECT = Object.freeze({
  left: 0,
  top: 0,
  right: 100,
  bottom: 100
});

const cloneRect = (rect) => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom
});

export const parseRect = (rectString, fallbackRect = ZERO_RECT) => {
  if (!rectString) {
    return cloneRect(fallbackRect);
  }

  const parts = rectString
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10));

  if (parts.length < 4 || parts.some(value => Number.isNaN(value))) {
    return cloneRect(fallbackRect);
  }

  return {
    left: parts[0],
    top: parts[1],
    right: parts[2],
    bottom: parts[3]
  };
};

export const formatRect = (rect) => `${rect.left},${rect.top},${rect.right},${rect.bottom}`;

export const getRectSize = (rect) => ({
  width: rect.right - rect.left,
  height: rect.bottom - rect.top
});

export const toCanvasRect = (rectString, invalidFallbackRect = DEFAULT_CONTROL_RECT) => {
  if (!rectString) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  const rect = parseRect(rectString, invalidFallbackRect);
  const { width, height } = getRectSize(rect);

  return {
    x: rect.left,
    y: rect.top,
    w: width,
    h: height
  };
};

export const stripWrappingQuotes = (value) => {
  if (!value) {
    return '';
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
};