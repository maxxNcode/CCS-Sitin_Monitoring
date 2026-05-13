const { execSync } = require('child_process');
try {
    const output = execSync('git checkout admin-pages/sit-in.html admin-pages/students.html', { stdio: 'inherit' });
    console.log("Restored files from git.");
} catch (e) {
    console.error("Failed to restore files from git:", e.message);
}
