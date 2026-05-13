const fs = require('fs');
const html = fs.readFileSync('admin.html', 'utf-8');

console.log("IndexOf ml-auto:", html.indexOf('ml-auto'));
const match = html.match(/(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)[\s\S]*?(?=(?:<!--[\s\S]*?-->\s*)?<main)/);
if (match) {
    console.log("Match length:", match[0].length);
    console.log("Start:", match[0].substring(0, 50));
    console.log("End:", match[0].substring(match[0].length - 50));
} else {
    console.log("NO MATCH");
}
