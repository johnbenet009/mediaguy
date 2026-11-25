const fs = require('node:fs');
const path = require('node:path');

const sourceDirectory = path.join(__dirname, 'vite-core', 'dist');
const publicDirectory = path.join(__dirname, 'public');

if (!fs.existsSync(sourceDirectory)) {
  throw new Error('Frontend build output is missing. Run the Vite build first.');
}

fs.mkdirSync(publicDirectory, { recursive: true });
for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
  const source = path.join(sourceDirectory, entry.name);
  const destination = path.join(publicDirectory, entry.name);
  if (entry.isDirectory() && entry.name === 'assets') {
    fs.mkdirSync(destination, { recursive: true });
    for (const assetName of fs.readdirSync(destination)) {
      if (/^index-.+\.(?:js|css)$/.test(assetName)) fs.rmSync(path.join(destination, assetName), { force: true });
    }
  } else if (entry.isDirectory() && entry.name === 'guide') {
    fs.rmSync(destination, { recursive: true, force: true });
  }
  fs.cpSync(source, destination, { recursive: true, force: true });
}
