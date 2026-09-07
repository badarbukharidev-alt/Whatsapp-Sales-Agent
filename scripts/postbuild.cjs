const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const distHtml = path.join(rootDir, 'dist', 'index.html');
const rootHtml = path.join(rootDir, 'index.html');
const distAssets = path.join(rootDir, 'dist', 'assets');
const rootAssets = path.join(rootDir, 'assets');
const tmpDir = path.join(rootDir, 'tmp');
const restartTxt = path.join(tmpDir, 'restart.txt');

// 1. Copy dist/index.html to root index.html
if (fs.existsSync(distHtml)) {
  fs.copyFileSync(distHtml, rootHtml);
  console.log('[postbuild] Copied production dist/index.html to root index.html');
}

// 2. Sync dist/assets to root assets
if (fs.existsSync(distAssets)) {
  if (!fs.existsSync(rootAssets)) {
    fs.mkdirSync(rootAssets, { recursive: true });
  }
  const files = fs.readdirSync(distAssets);
  for (const file of files) {
    const src = path.join(distAssets, file);
    const dest = path.join(rootAssets, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log(`[postbuild] Synced ${files.length} asset files to root assets/`);
}

// 3. Touch tmp/restart.txt
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}
fs.writeFileSync(restartTxt, new Date().toISOString(), 'utf8');
console.log('[postbuild] Touched tmp/restart.txt for Passenger restart');
