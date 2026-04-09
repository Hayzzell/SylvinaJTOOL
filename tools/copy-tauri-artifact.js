const fs = require('fs');
const path = require('path');

const COPY_MAX_ATTEMPTS = 24;
const COPY_RETRY_DELAY_MS = 500;
const COPY_RETRY_MAX_DELAY_MS = 3000;
const SOURCE_STABILITY_CHECKS = 3;
const SOURCE_STABILITY_INTERVAL_MS = 500;
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
    destinationPath: path.join(distDir, 'SylvinaJTOOL.exe')
  };
}
/// you most likely wouldnt need this function
/// it was added since vanguard is a disgusting chineese malware blocking access to the executable with random read locks that never stops
/// glory to the ccp
function isFallbackArtifact(name) {
  return /^SylvinaJTOOL\.next(?:\..+)?\.exe$/i.test(name);
}

function safeRemove(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (!isLockError(error)) {
      throw error;
    }
  }
}

function cleanupStaleFallbackArtifacts(distDir) {
  if (!fs.existsSync(distDir)) {
    return;
  }

  fs.readdirSync(distDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && isFallbackArtifact(entry.name))
    .forEach(entry => {
      safeRemove(path.join(distDir, entry.name));
    });
}

function prepareDistDirectory(distDir, distAssetsDir) {
  fs.mkdirSync(distDir, { recursive: true });

  STALE_DIST_ENTRIES.forEach(entry => {
    safeRemove(path.join(distDir, entry));
  });

  cleanupStaleFallbackArtifacts(distDir);

  fs.mkdirSync(distAssetsDir, { recursive: true });
}
/// up to here its just vg being a pain
function relativePath(projectRoot, targetPath) {
  return path.relative(projectRoot, targetPath);
}

function buildRetryDelay(attempt) {
  return Math.min(COPY_RETRY_DELAY_MS * attempt, COPY_RETRY_MAX_DELAY_MS);
}
// XD
function buildFallbackPath(distDir) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');

  return path.join(distDir, `SylvinaJTOOL.next.${stamp}.${process.pid}.exe`);
}

async function waitForStableFile(filePath, stableChecks = SOURCE_STABILITY_CHECKS) {
  let previousSignature = null;
  let matchingChecks = 0;

  while (matchingChecks < stableChecks) {
    const stats = fs.statSync(filePath);
    const signature = `${stats.size}:${stats.mtimeMs}`;

    if (signature === previousSignature) {
      matchingChecks += 1;
    } else {
      previousSignature = signature;
      matchingChecks = 1;
    }

    if (matchingChecks < stableChecks) {
      await wait(SOURCE_STABILITY_INTERVAL_MS);
    }
  }
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
      await wait(buildRetryDelay(attempt));
    }
  }

  throw lastError;
}

async function copyArtifact(sourcePath, destinationPath, distDir) {
  try {
    await copyWithRetries(sourcePath, destinationPath);
    return { writtenPath: destinationPath, usedFallback: false };
  } catch (error) {
    if (!isLockError(error)) {
      throw error;
    }

    const fallbackPath = buildFallbackPath(distDir);
    await copyWithRetries(sourcePath, fallbackPath);
    return { writtenPath: fallbackPath, usedFallback: true };
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const { sourcePath, distDir, distAssetsDir, destinationPath } = resolveArtifactPaths(projectRoot);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Tauri release executable not found at ${sourcePath}`);
  }

  prepareDistDirectory(distDir, distAssetsDir);
  await waitForStableFile(sourcePath);

  const result = await copyArtifact(sourcePath, destinationPath, distDir);

  if (result.usedFallback) {
    console.warn(
      `[SylvinaJTOOL dist] ${relativePath(projectRoot, destinationPath)} is locked; wrote ${relativePath(projectRoot, result.writtenPath)} and prepared ${relativePath(projectRoot, distAssetsDir)}`
    );
  } else {
    console.log(
      `[SylvinaJTOOL dist] wrote ${relativePath(projectRoot, result.writtenPath)} and prepared ${relativePath(projectRoot, distAssetsDir)}`
    );
  }
}

main().catch(error => {
  console.error('[SylvinaJTOOL dist] failed to copy Tauri executable', error);
  process.exitCode = 1;
});