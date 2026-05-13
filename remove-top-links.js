const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'admin.html',
    'admin-pages/students.html',
    'admin-pages/sit-in.html'
];

// We want to match all these old navigation links in the top bar.
// Since they vary in classes (btn-primary vs btn-ghost) and formatting,
// we'll look for blocks of anchor tags with href="/admin", "/students", etc.
// that are inside the top nav section.

const regex = /<a\s+href="\/admin"[^>]*>[\s\S]*?<a\s+href="\/admin\/analytics"[^>]*>[\s\S]*?<\/a>/g;

for (const file of filesToUpdate) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${file}`);
        continue;
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    
    if (regex.test(html)) {
        html = html.replace(regex, '<!-- Desktop nav links removed - use sidebar -->');
        fs.writeFileSync(filePath, html, 'utf-8');
        console.log(`✅ Removed top navigation links from ${file}`);
    } else {
        console.log(`⏭️  No matching top navigation links found in ${file}`);
    }
}
