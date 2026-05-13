const fs = require('fs');
const html = fs.readFileSync('admin-pages/reservations.html', 'utf-8');
const regex = /(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)[\s\S]*?(?=(?:<!--[\s\S]*?-->\s*)?<main)/;

const match = html.match(regex);
if (match) {
    console.log("Matched!", match[0].substring(0, 50) + "..." + match[0].substring(match[0].length - 50));
} else {
    console.log("Did not match.");
    // try to find just the first part
    const m1 = html.match(/(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)/);
    console.log("Found start div?", !!m1);
    const m2 = html.match(/<main/);
    console.log("Found main?", !!m2);
}
