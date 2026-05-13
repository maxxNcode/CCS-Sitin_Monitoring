const fs = require('fs');

let code = fs.readFileSync('standardize-nav.js', 'utf-8');
code = code.replace(
    'const regex = /(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)[\\\\s\\\\S]*?(?=(?:<!--[\\\\s\\\\S]*?-->\\\\s*)?<main)/;',
    'const regex = /(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)[\\s\\S]*?(?=(?:<!--[\\s\\S]*?-->\\s*)?<main)/;'
);
fs.writeFileSync('standardize-nav.js', code, 'utf-8');
console.log('Fixed regex!');
