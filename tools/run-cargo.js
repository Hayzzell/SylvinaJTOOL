const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUSTUP_STABLE_CARGO_PATH = ['toolchains', 'stable-x86_64-pc-windows-msvc', 'bin', 'cargo.exe'];
const CARGO_BIN_FILE_NAMES = ['cargo.exe', 'cargo'];

function appendPathIfPresent(candidates, basePath, ...segments) {
  if (basePath) {
    candidates.push(path.join(basePath, ...segments));
  }
}

function appendCargoBinCandidates(candidates, cargoHome) {
  CARGO_BIN_FILE_NAMES.forEach(fileName => {
    appendPathIfPresent(candidates, cargoHome, 'bin', fileName);
  });
}

function findExistingPath(candidates) {
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function resolveCargoExecutable() {
  const candidates = [];

  appendPathIfPresent(candidates, process.env.RUSTUP_HOME, ...RUSTUP_STABLE_CARGO_PATH);
  appendPathIfPresent(candidates, process.env.USERPROFILE, '.rustup', ...RUSTUP_STABLE_CARGO_PATH);
  appendCargoBinCandidates(candidates, process.env.CARGO_HOME);
  appendCargoBinCandidates(candidates, process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.cargo'));

  return findExistingPath(candidates) || 'cargo';
}

function resolveVisualStudioEnvironmentScript() {
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  if (!programFilesX86) {
    return null;
  }

  const vswherePath = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (!fs.existsSync(vswherePath)) {
    return null;
  }

  const result = spawnSync(
    vswherePath,
    ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
    { encoding: 'utf8', shell: false }
  );

  if (result.status !== 0) {
    return null;
  }

  const installationPath = result.stdout.trim();
  if (!installationPath) {
    return null;
  }

  const vcvarsPath = path.join(installationPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  if (fs.existsSync(vcvarsPath)) {
    return { path: vcvarsPath, args: [] };
  }

  const vsDevCmdPath = path.join(installationPath, 'Common7', 'Tools', 'VsDevCmd.bat');
  if (fs.existsSync(vsDevCmdPath)) {
    return { path: vsDevCmdPath, args: ['-arch=x64', '-host_arch=x64'] };
  }

  return null;
}

function quoteBatchArg(value) {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function createCargoEnvironment(cargoExecutable) {
  const cargoBinDir = path.dirname(cargoExecutable);

  return {
    cargoBinDir,
    envWithCargoBin: {
      ...process.env,
      PATH: process.env.PATH ? `${cargoBinDir}${path.delimiter}${process.env.PATH}` : cargoBinDir
    }
  };
}

function spawnCargoProcess(cargoExecutable, cargoArgs, env) {
  return spawnSync(cargoExecutable, cargoArgs, {
    stdio: 'inherit',
    shell: false,
    env
  });
}

function runCargoWithMsvcEnvironment(cargoExecutable, cargoArgs, environmentScript) {
  const scriptPath = path.join(os.tmpdir(), `sylvinajtool-cargo-${process.pid}-${Date.now()}.cmd`);
  const envCall = [quoteBatchArg(environmentScript.path), ...environmentScript.args].join(' ');
  const cargoCommand = [quoteBatchArg(cargoExecutable), ...cargoArgs.map(quoteBatchArg)].join(' ');
  const cargoBinDir = path.dirname(cargoExecutable);

  const scriptContents = [
    '@echo off',
    `call ${envCall} >nul 2>&1`,
    'if errorlevel 1 exit /b %errorlevel%',
    `set "PATH=${cargoBinDir};%PATH%"`,
    cargoCommand
  ].join('\r\n');

  fs.writeFileSync(scriptPath, scriptContents, 'ascii');

  try {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', scriptPath], {
      stdio: 'inherit',
      shell: false
    });
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

const cargoExecutable = resolveCargoExecutable();
const cargoArgs = process.argv.slice(2);
const environmentScript = resolveVisualStudioEnvironmentScript();
const { envWithCargoBin } = createCargoEnvironment(cargoExecutable);

const result = environmentScript
  ? runCargoWithMsvcEnvironment(cargoExecutable, cargoArgs, environmentScript)
  : spawnCargoProcess(cargoExecutable, cargoArgs, envWithCargoBin);

if (result.error) {
  console.error('[SylvinaJTOOL cargo] failed to start cargo', result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);