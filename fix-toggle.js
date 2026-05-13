const fs = require('fs');
const path = require('path');

const toggleJS = `
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar-nav');
                const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
                if (isCollapsed) {
                    sidebar.classList.remove('sidebar-collapsed');
                    localStorage.setItem('sidebar-collapsed', '0');
                } else {
                    sidebar.classList.add('sidebar-collapsed');
                    localStorage.setItem('sidebar-collapsed', '1');
                }
            }

            (function() {
                if (localStorage.getItem('sidebar-collapsed') === '1') {
                    const sidebar = document.getElementById('sidebar-nav');
                    if (sidebar) sidebar.classList.add('sidebar-collapsed');
                }
            })();`;

const pages = [
  'reservations.html',
  'leaderboard.html',
  'manage-dropdowns.html',
  'analytics.html',
];

for (const file of pages) {
  const filePath = path.join(__dirname, 'admin-pages', file);
  let html = fs.readFileSync(filePath, 'utf-8');
  
  if (html.includes('function toggleSidebar()')) {
    console.log(`⏭️  ${file} already has the JS function toggleSidebar`);
    continue;
  }

  // Find the LAST </script> and insert toggleJS before it
  const lastScriptClose = html.lastIndexOf('</script>');
  if (lastScriptClose === -1) {
    console.log(`❌ ${file}: no </script> found`);
    continue;
  }
  
  html = html.slice(0, lastScriptClose) + toggleJS + '\n        </script>' + html.slice(lastScriptClose + '</script>'.length);
  
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ Added toggleSidebar JS to ${file}`);
}

console.log('\nDone!');
