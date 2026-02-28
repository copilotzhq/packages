const fs = require('node:fs');
const path = require('node:path');

const cssPath = require.resolve('katex/dist/katex.min.css');
const fontsDir = path.join(path.dirname(cssPath), 'fonts');
const destDir = path.resolve(__dirname, 'dist', 'fonts');

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(fontsDir, destDir, { recursive: true });
