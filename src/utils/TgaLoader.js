
const TGA_HEADER_SIZE = 18;

const readTgaHeader = (data) => ({
  idLength: data[0],
  colorMapType: data[1],
  imageType: data[2],
  colorMapLength: data[5] | (data[6] << 8),
  colorMapDepth: data[7],
  width: data[12] | (data[13] << 8),
  height: data[14] | (data[15] << 8),
  pixelDepth: data[16],
  flags: data[17]
});

const decode16BitColor = (value) => ([
  ((value >> 10) & 0x1F) * 255 / 31,
  ((value >> 5) & 0x1F) * 255 / 31,
  (value & 0x1F) * 255 / 31,
  255
]);

export async function loadTgaAsDataUrl(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);

  const header = readTgaHeader(data);

  const width = header.width;
  const height = header.height;
  const pixelDepth = header.pixelDepth;
  const isRLE = header.imageType === 9 || header.imageType === 10 || header.imageType === 11;
  const isGrayscale = header.imageType === 3 || header.imageType === 11;

  let offset = TGA_HEADER_SIZE + header.idLength;
  if (header.colorMapType === 1) {
    offset += header.colorMapLength * (header.colorMapDepth / 8);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  if (isRLE) {
    decodeRLE(data, offset, pixels, width, height, pixelDepth, isGrayscale);
  } else {
    decodeRaw(data, offset, pixels, width, height, pixelDepth, isGrayscale);
  }

  const isBottomUp = ((header.flags >> 5) & 1) === 0;
  if (isBottomUp) {
    flipVertical(pixels, width, height);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function decodeRaw(data, offset, pixels, width, height, pixelDepth, isGrayscale) {
  const bytesPerPixel = pixelDepth / 8;
  let pixelIndex = 0;

  for (let i = 0; i < width * height; i++) {
    const dataOffset = offset + i * bytesPerPixel;
    
    if (isGrayscale) {
      const gray = data[dataOffset];
      pixels[pixelIndex++] = gray;
      pixels[pixelIndex++] = gray;
      pixels[pixelIndex++] = gray;
      pixels[pixelIndex++] = bytesPerPixel === 2 ? data[dataOffset + 1] : 255;
    } else if (bytesPerPixel === 3) {
      pixels[pixelIndex++] = data[dataOffset + 2];
      pixels[pixelIndex++] = data[dataOffset + 1];
      pixels[pixelIndex++] = data[dataOffset];
      pixels[pixelIndex++] = 255;
    } else if (bytesPerPixel === 4) {
      pixels[pixelIndex++] = data[dataOffset + 2];
      pixels[pixelIndex++] = data[dataOffset + 1];
      pixels[pixelIndex++] = data[dataOffset];
      pixels[pixelIndex++] = data[dataOffset + 3];
    } else if (bytesPerPixel === 2) {
      const value = data[dataOffset] | (data[dataOffset + 1] << 8);
      const [red, green, blue, alpha] = decode16BitColor(value);
      pixels[pixelIndex++] = red;
      pixels[pixelIndex++] = green;
      pixels[pixelIndex++] = blue;
      pixels[pixelIndex++] = alpha;
    }
  }
}

function decodeRLE(data, offset, pixels, width, height, pixelDepth, isGrayscale) {
  const bytesPerPixel = pixelDepth / 8;
  let dataIndex = offset;
  let pixelIndex = 0;
  const totalPixels = width * height;

  while (pixelIndex < totalPixels * 4) {
    const header = data[dataIndex++];
    const isRLEPacket = (header & 0x80) !== 0;
    const count = (header & 0x7F) + 1;

    if (isRLEPacket) {
      const pixel = readPixel(data, dataIndex, bytesPerPixel, isGrayscale);
      dataIndex += bytesPerPixel;
      
      for (let i = 0; i < count; i++) {
        pixels[pixelIndex++] = pixel[0];
        pixels[pixelIndex++] = pixel[1];
        pixels[pixelIndex++] = pixel[2];
        pixels[pixelIndex++] = pixel[3];
      }
    } else {
      for (let i = 0; i < count; i++) {
        const pixel = readPixel(data, dataIndex, bytesPerPixel, isGrayscale);
        dataIndex += bytesPerPixel;
        pixels[pixelIndex++] = pixel[0];
        pixels[pixelIndex++] = pixel[1];
        pixels[pixelIndex++] = pixel[2];
        pixels[pixelIndex++] = pixel[3];
      }
    }
  }
}

function readPixel(data, offset, bytesPerPixel, isGrayscale) {
  if (isGrayscale) {
    const gray = data[offset];
    const alpha = bytesPerPixel === 2 ? data[offset + 1] : 255;
    return [gray, gray, gray, alpha];
  } else if (bytesPerPixel === 3) {
    return [data[offset + 2], data[offset + 1], data[offset], 255];
  } else if (bytesPerPixel === 4) {
    return [data[offset + 2], data[offset + 1], data[offset], data[offset + 3]];
  } else if (bytesPerPixel === 2) {
    const value = data[offset] | (data[offset + 1] << 8);
    return decode16BitColor(value);
  }
  return [0, 0, 0, 255];
}

function flipVertical(pixels, width, height) {
  const rowSize = width * 4;
  const halfHeight = Math.floor(height / 2);
  
  for (let y = 0; y < halfHeight; y++) {
    const topRow = y * rowSize;
    const bottomRow = (height - 1 - y) * rowSize;
    
    for (let x = 0; x < rowSize; x++) {
      const temp = pixels[topRow + x];
      pixels[topRow + x] = pixels[bottomRow + x];
      pixels[bottomRow + x] = temp;
    }
  }
}


export function isTgaFile(url) {
  return url && url.toLowerCase().endsWith('.tga');
}
