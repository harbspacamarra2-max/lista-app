const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const base = (process.env.WEB_BASE || '').replace(/\/$/, '');
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />'
);

const tags = `
    <link rel="manifest" href="${base}/manifest.json" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Sinop" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#FAF7F2" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0F0E13" media="(prefers-color-scheme: dark)" />
    <style>html,body{background:#FAF7F2;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}@media (prefers-color-scheme: dark){html,body{background:#0F0E13}}</style>
  </head>`;
html = html.replace('</head>', tags);
fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(dist, '404.html'), html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('web postbuild done (base:', base || '/', ')');
