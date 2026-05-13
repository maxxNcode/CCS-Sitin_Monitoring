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

// Regex to find the old logout button in the top navbar.
// It looks something like:
// <button onclick="logout()" class="btn btn-primary btn-sm ml-4">
//     <i class="fa-solid fa-right-from-bracket mr-2"></i>Logout
// </button>
// OR
// <button
//     onclick="logout()"
//     class="btn btn-primary btn-sm ml-4"
// >
//     <i class="fa-solid fa-right-from-bracket mr-2"></i
//     >Logout
// </button>

const logoutRegex = /<button[^>]*?onclick="logout\(\)"[^>]*?class="[^"]*?btn-primary[^"]*?ml-4[^"]*"[^>]*>[\s\S]*?<\/button>/g;

for (const file of filesToUpdate) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${file}`);
        continue;
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    
    if (logoutRegex.test(html)) {
        html = html.replace(logoutRegex, '');
        fs.writeFileSync(filePath, html, 'utf-8');
        console.log(`✅ Removed old logout button from ${file}`);
    } else {
        console.log(`⏭️  No old logout button found in ${file}`);
    }
}
