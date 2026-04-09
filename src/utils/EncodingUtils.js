import * as iconv from 'iconv-lite-umd';

/**
 * Encoding utilities for NUI file handling.
 */

export const DEFAULT_ENCODING_INFO = Object.freeze({
  encoding: 'windows-1252',
  hasBom: false
});

const BYTE_ORDER_MARKS = {
  'utf-8': [0xEF, 0xBB, 0xBF],
  'utf-16be': [0xFE, 0xFF],
  'utf-16le': [0xFF, 0xFE]
};

const UTF8_BOM = BYTE_ORDER_MARKS['utf-8'];

const canDecodeUtf8 = (bytes) => {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

const getBomLength = encoding => BYTE_ORDER_MARKS[encoding]?.length || 0;

const prependBom = (bytes, encoding) => {
  const bom = BYTE_ORDER_MARKS[encoding];
  if (!bom) return bytes;

  const withBom = new Uint8Array(bom.length + bytes.length);
  withBom.set(bom, 0);
  withBom.set(bytes, bom.length);
  return withBom;
};

/**
 * Detect the encoding of a byte array
 * @param {Uint8Array} bytes - The byte array to analyze
 * @returns {{encoding: string, hasBom: boolean}} - Encoding metadata for the imported file.
 */
export const detectEncoding = (bytes) => {
  if (
    bytes.length >= UTF8_BOM.length &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2]
  ) {
    return { encoding: 'utf-8', hasBom: true };
  }

  if (bytes.length >= 2) {
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return { encoding: 'utf-16be', hasBom: true };
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { encoding: 'utf-16le', hasBom: true };
  }

  return canDecodeUtf8(bytes)
    ? { encoding: 'utf-8', hasBom: false }
    : { encoding: 'euc-kr', hasBom: false };
};

/**
 * Decode bytes to string and return the detected encoding metadata.
 * @param {Uint8Array} bytes - The byte array to decode
 * @returns {{text: string, encoding: string, hasBom: boolean}} - Decoded text and encoding metadata
 */
export const decodeBytesWithEncoding = (bytes) => {
  const { encoding, hasBom } = detectEncoding(bytes);
  const bomLength = hasBom ? getBomLength(encoding) : 0;
  const dataBytes = bomLength > 0 ? bytes.slice(bomLength) : bytes;

  return {
    text: iconv.decode(dataBytes, encoding),
    encoding,
    hasBom
  };
};

/**
 * @param {string} text - The text to encode
 * @returns {Uint8Array} - UTF-8 encoded bytes
 */
export const encodeToUtf8 = (text) => {
  const encoder = new TextEncoder();
  return encoder.encode(text);
};

/**
 * Encode string to ANSI (Windows-1252) bytes.
 * @param {string} text - The text to encode
 * @returns {Uint8Array} - ANSI encoded bytes
 */
const encodeToAnsi = (text) => new Uint8Array(iconv.encode(text, 'windows-1252'));

/**
 * Encode string to bytes with specified encoding
 * @param {string} text - The text to encode  
 * @param {string} encoding - 'utf-8', 'ansi', or 'euc-kr'
 * @returns {Uint8Array} - Encoded bytes
 */
export const encodeText = (text, encoding = 'ansi') => {
  const normalizedEncoding = encoding === 'ansi' ? 'windows-1252' : encoding;

  if (normalizedEncoding === 'utf-8') {
    return encodeToUtf8(text);
  }

  if (normalizedEncoding === 'windows-1252') {
    return encodeToAnsi(text);
  }

  return new Uint8Array(iconv.encode(text, normalizedEncoding));
};

/**
 * Encode string to bytes using imported file metadata.
 * @param {string} text - The text to encode
 * @param {{encoding: string, hasBom: boolean}} encodingInfo - Imported encoding metadata
 * @returns {Uint8Array} - Encoded bytes matching the imported file format
 */
export const encodeTextWithEncoding = (text, encodingInfo = DEFAULT_ENCODING_INFO) => {
  const normalizedInfo = encodingInfo || DEFAULT_ENCODING_INFO;
  const bytes = encodeText(text, normalizedInfo.encoding);
  return normalizedInfo.hasBom ? prependBom(bytes, normalizedInfo.encoding) : bytes;
};
