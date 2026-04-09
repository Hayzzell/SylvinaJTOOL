const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const LARGE_ICON_SIZE = 512;
const TRANSPARENT_RESIZE_OPTIONS = {
  fit: 'contain',
  background: { r: 0, g: 0, b: 0, alpha: 0 }
};

function resolveProjectPaths(projectRoot) {
  const iconsDir = path.join(projectRoot, 'src-tauri', 'icons');

  return {
    sourcePath: path.join(projectRoot, 'SylvinaBackFree.png'), // if you want to convert your icon just replace this with the path to your source image, it should be a square png  512x512 or larger 
    iconsDir,
    iconPngPath: path.join(iconsDir, 'icon.png'),
    iconIcoPath: path.join(iconsDir, 'icon.ico')
  };
}

async function renderTransparentPng(sourcePath, outputPath, size) {
  await sharp(sourcePath)
    .resize(size, size, TRANSPARENT_RESIZE_OPTIONS)
    .png()
    .toFile(outputPath);
}

async function generateSizedPngs(sourcePath, tempDir) {
  const pngFiles = [];

  for (const size of ICON_SIZES) {
    const outputPath = path.join(tempDir, `icon-${size}.png`);
    await renderTransparentPng(sourcePath, outputPath, size);
    pngFiles.push(outputPath);
  }

  return pngFiles;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const { sourcePath, iconsDir, iconPngPath, iconIcoPath } = resolveProjectPaths(projectRoot);

  await fs.access(sourcePath);
  await fs.mkdir(iconsDir, { recursive: true });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sylvina-tauri-icon-'));

  try {
    const pngFiles = await generateSizedPngs(sourcePath, tempDir);

    const iconBuffer = await pngToIco(pngFiles);
    await fs.writeFile(iconIcoPath, iconBuffer);

    await renderTransparentPng(sourcePath, iconPngPath, LARGE_ICON_SIZE);

    console.log(`[SylvinaJTOOL icons] wrote ${path.relative(projectRoot, iconIcoPath)} and ${path.relative(projectRoot, iconPngPath)}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error('[SylvinaJTOOL icons] failed to generate Tauri icon assets', error);
  process.exitCode = 1;
});

//yes i am that lazy to convert it to ico every time i change the icon 