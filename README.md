# SylvinaJTOOL

SylvinaJTOOL is a standalone Tauri editor for Rappelz NUI files.
Why tauri? 
Project was originally web based and not meant to be standalone app
<img width="1581" height="864" alt="image" src="https://github.com/user-attachments/assets/9f964bc0-c73d-4b12-9104-b40b017469f5" />

## Local desktop run

1. Install Rust with `rustup`.
2. Install dependencies with `npm install`.
3. Run `npm start`.

This builds the renderer and launches the Tauri desktop runtime.

## Linting

Run `npm run lint` to verify the frontend, build tools Rust formatting and Tauri clippy warnings.

## Build a Windows exe version

1. Install Rust with `rustup`.
2. Install dependencies with `npm install`.
3. Run `npm run dist:win`.
4. The executable is written to `dist/SylvinaJTOOL.exe`.
5. If that file is locked, the build writes a timestamped `dist/SylvinaJTOOL.next.*.exe` fallback instead.
6. Put your external assets in `dist/static-assets` next to the exe.

## IMPORTANT
- `static-assets/` must contain your external resources.
- Supported asset folders include `dds`, `jpg`, `png`, `spr`, and `tga`.

## Additional
- before you commit pull requests please lint the code before hand 
- if you did UI changes show before and after images of your change 
- Thank you!

