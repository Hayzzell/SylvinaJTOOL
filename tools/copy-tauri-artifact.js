const fs = require('fs');
const path = require('path');

const COPY_MAX_ATTEMPTS = 10;
const COPY_RETRY_DELAY_MS = 500;
const STALE_DIST_ENTRIES = [
  'builder-debug.yml',
  'builder-effective-config.yaml',
  'sylvinajtool-0.1.0-x64.nsis.7z',
  'win-unpacked'
];

const LOCK_ERROR_CODES = new Set(['EBUSY', 'EPERM']);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isLockError(error) {
  return Boolean(error && LOCK_ERROR_CODES.has(error.code));
}

function resolveArtifactPaths(projectRoot) {
  const distDir = path.join(projectRoot, 'dist');

  return {
    sourcePath: path.join(projectRoot, 'src-tauri', 'target', 'release', 'sylvinajtool.exe'),
    distDir,
    distAssetsDir: path.join(distDir, 'static-assets'),
    destinationPath: path.join(distDir, 'SylvinaJTOOL.exe'),
    fallbackPath: path.join(distDir, 'SylvinaJTOOL.next.exe')
  };
}

function prepareDistDirectory(distDir, distAssetsDir) {
  fs.mkdirSync(distDir, { recursive: true });

  STALE_DIST_ENTRIES.forEach(entry => {
    fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
  });

  fs.mkdirSync(distAssetsDir, { recursive: true });
}

function relativePath(projectRoot, targetPath) {
  return path.relative(projectRoot, targetPath);
}

async function copyWithRetries(sourcePath, destinationPath, maxAttempts = COPY_MAX_ATTEMPTS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.copyFileSync(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!isLockError(error) || attempt === maxAttempts) {
        throw error;
      }

      lastError = error;
      await wait(COPY_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const { sourcePath, distDir, distAssetsDir, destinationPath, fallbackPath } = resolveArtifactPaths(projectRoot);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Tauri release executable not found at ${sourcePath}`);
  }

  prepareDistDirectory(distDir, distAssetsDir);

  try {
    await copyWithRetries(sourcePath, destinationPath);
    console.log(
      `[SylvinaJTOOL dist] wrote ${relativePath(projectRoot, destinationPath)} and prepared ${relativePath(projectRoot, distAssetsDir)}`
    );
  } catch (error) {
    if (!isLockError(error)) {
      throw error;
    }

    await copyWithRetries(sourcePath, fallbackPath);
    console.warn(
      `[SylvinaJTOOL dist] ${relativePath(projectRoot, destinationPath)} is locked; wrote ${relativePath(projectRoot, fallbackPath)} and prepared ${relativePath(projectRoot, distAssetsDir)}`
    );
  }
}

main().catch(error => {
  console.error('[SylvinaJTOOL dist] failed to copy Tauri executable', error);
  process.exitCode = 1;
});