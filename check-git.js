const { execSync } = require('child_process');
try {
    const status = execSync('git status', { encoding: 'utf-8' });
    console.log("GIT STATUS:\n", status);
} catch (e) {
    console.error("GIT ERROR:", e.message);
}
