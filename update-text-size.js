const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'admin.html',
    'admin-pages/students.html',
    'admin-pages/sit-in.html',
    'admin-pages/sit-in-records.html',
    'admin-pages/sit-in-reports.html',
    'admin-pages/feedback-reports.html',
    'admin-pages/reservations.html',
    'admin-pages/leaderboard.html',
    'admin-pages/manage-dropdowns.html',
    'admin-pages/analytics.html'
];

for (const file of filesToUpdate) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${file}`);
        continue;
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    
    const targetString = '<span class="sidebar-brand-text text-[20px] font-black tracking-tighter italic uppercase whitespace-nowrap leading-tight text-center">';
    const replacementString = '<span class="sidebar-brand-text text-[16px] font-black tracking-tighter italic uppercase whitespace-nowrap leading-tight text-center">';

    if (html.includes(targetString)) {
        html = html.replace(targetString, replacementString);
        fs.writeFileSync(filePath, html, 'utf-8');
        console.log(`✅ Updated ${file}`);
    } else if (html.includes(replacementString)) {
        console.log(`⏭️  ${file} already updated`);
    } else {
        console.log(`⚠️ Target string not found in ${file}`);
    }
}
