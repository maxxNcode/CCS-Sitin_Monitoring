const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Find all HTML files recursively
function findHtml(dir, results = []) {
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory() && !['node_modules', '.git', 'public'].includes(f)) {
            findHtml(full, results);
        } else if (f.endsWith('.html')) {
            results.push(full);
        }
    }
    return results;
}

const files = findHtml(ROOT);

let totalChanged = 0;
for (const file of files) {
    let src = fs.readFileSync(file, 'utf8');
    let updated = src;

    // Fix transparent select backgrounds: bg-base-200/50 -> bg-base-200, bg-base-200/80 -> bg-base-200
    updated = updated.replace(/bg-base-200\/50/g, 'bg-base-200');
    updated = updated.replace(/bg-base-200\/80/g, 'bg-base-200');

    // Remove stray backdrop-blur-md from select elements specifically
    // (match select elements that have backdrop-blur-md)
    updated = updated.replace(/(class="select[^"]*?)backdrop-blur-md\s*/g, '$1');

    if (updated !== src) {
        fs.writeFileSync(file, updated, 'utf8');
        totalChanged++;
        console.log('Fixed:', path.relative(ROOT, file));
    }
}

console.log(`\nDone. Fixed ${totalChanged} file(s).`);
