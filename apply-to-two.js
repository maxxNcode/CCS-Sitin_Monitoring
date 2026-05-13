const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'students.html', activeLink: '/students' },
  { file: 'sit-in.html', activeLink: '/sit-in' },
];

const sidebarCSS = `
    <style>
        #sidebar-nav {
            transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            width: 16rem;
        }
        #sidebar-nav.sidebar-collapsed { width: 4.5rem; }
        #sidebar-nav.sidebar-collapsed .sidebar-text { display: none; }
        #sidebar-nav.sidebar-collapsed .sidebar-brand-text { display: none; }
        #sidebar-nav.sidebar-collapsed li > a,
        #sidebar-nav.sidebar-collapsed li > button {
            justify-content: center;
            padding: 0.75rem;
            border-right: none !important;
        }
        #sidebar-nav.sidebar-collapsed li > a i { margin-right: 0 !important; }
        #sidebar-nav.sidebar-collapsed .sidebar-header { align-items: center; padding: 1rem 0; }
        #sidebar-nav.sidebar-collapsed .sidebar-logo { width: 2.5rem; height: 2.5rem; }
    </style>
`;

function makeSidebarHTML(activeLink) {
  const links = [
    { href: '/admin', icon: 'fa-house', label: 'Dashboard' },
    { href: '/students', icon: 'fa-users', label: 'Students' },
    { href: '/sit-in', icon: 'fa-clipboard-user', label: 'Sit-in Session' },
    { href: '/sit-in-records', icon: 'fa-clock-rotate-left', label: 'Sit-in Records' },
    { href: '/sit-in-reports', icon: 'fa-chart-line', label: 'Sit-in Reports' },
    { href: '/feedback-reports', icon: 'fa-comment-dots', label: 'Feedback' },
    { href: '/reservations', icon: 'fa-calendar-check', label: 'Reservations' },
    { href: '/admin/leaderboard', icon: 'fa-trophy', label: 'Leaderboard' },
    { href: '/admin/manage-dropdowns', icon: 'fa-sliders', label: 'Manage Dropdowns' },
    { href: '/admin/analytics', icon: 'fa-chart-pie', label: 'Analytics' },
  ];

  const linkHTML = links.map(l => {
    const isActive = l.href === activeLink;
    const cls = isActive
      ? 'active bg-primary/10 text-primary border-r-4 border-primary !rounded-l-xl !rounded-r-none font-black'
      : 'opacity-60 hover:opacity-100 font-bold hover:bg-base-200 transition-all';
    return `                    <li><a href="${l.href}" class="${cls}"><i class="fa-solid ${l.icon} w-4 text-center"></i><span class="sidebar-text">${l.label}</span></a></li>`;
  }).join('\n');

  return `            <!-- Sidebar (Desktop permanent + Mobile drawer) -->
            <div class="drawer-side z-[200]">
                <label for="my-drawer" class="drawer-overlay"></label>
                <ul id="sidebar-nav" class="menu p-3 min-h-full bg-base-100 text-base-content space-y-1">
                    <li class="sidebar-header flex flex-col items-center pt-5 pb-3 mb-1">
                        <div class="sidebar-logo w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 mb-2 transition-all duration-300">
                            <img src="../assets/ccslogo.png" alt="CCS Logo" class="w-full h-full object-contain" />
                        </div>
                        <span class="sidebar-brand-text text-[16px] font-black tracking-tighter italic uppercase whitespace-nowrap leading-tight text-center">
                            <span class="text-primary not-italic">CCS</span> <span class="text-base-content">SIT-IN MONITORING</span>
                        </span>
                    </li>
                    <div class="divider my-0 opacity-20"></div>
${linkHTML}
                    <li class="mt-auto pt-4">
                        <button onclick="logout()" class="btn btn-error btn-outline w-full rounded-2xl">
                            <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
                            <span class="sidebar-text">Logout</span>
                        </button>
                    </li>
                </ul>
            </div>
        </div>`;
}

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

for (const page of pages) {
  const filePath = path.join(__dirname, 'admin-pages', page.file);
  let html = fs.readFileSync(filePath, 'utf-8');

  // 1. Fix stylesheet path
  html = html.replace(/href="style\.css"/g, 'href="../style.css"');

  // 2. Add sidebar CSS after </head>
  if (!html.includes('#sidebar-nav')) {
    html = html.replace('</head>', '</head>\n' + sidebarCSS);
  }

  // 3. Change drawer to lg:drawer-open
  html = html.replace('<div class="drawer">', '<div class="drawer lg:drawer-open">');

  // 4. Change md:hidden to lg:hidden for hamburger
  html = html.replace(/class="flex-none md:hidden"/g, 'class="flex-none lg:hidden"');

  // 5. Hide branding on desktop
  html = html.replace(
    /(<div class="flex-1 gap-3 flex items-center)(">)/,
    '$1 lg:hidden$2'
  );

  // 6. Fix asset paths
  html = html.replace(/src="assets\//g, 'src="../assets/');

  // 7. Insert the toggle button next to Desktop Menu utilities
  if (!html.includes('toggleSidebar()')) {
    // Both students and sit-in have this div
    html = html.replace(
        /<!-- Desktop Menu utilities -->\s*\n\s*<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">/,
        `<!-- Sidebar toggle for desktop -->
                    <div class="hidden lg:flex flex-none">
                        <button onclick="toggleSidebar()" class="btn btn-ghost btn-square btn-sm" title="Toggle Sidebar">
                            <i class="fa-solid fa-bars text-base"></i>
                        </button>
                    </div>

                    <!-- Desktop Menu utilities -->
                    <div class="hidden lg:flex flex-none items-center gap-1 ml-auto">`
    );
  }

  // 8. Safely remove nav links (Home through Analytics)
  // We use a non-greedy match that looks specifically for `<a href="/admin/analytics"`
  html = html.replace(
    /\s*<a href="\/admin" class="btn btn-[^>]*>Home<\/a>[\s\S]*?<a href="\/admin\/analytics"[^>]*>[\s\S]*?Analytics\s*<\/a>/,
    '\n\n                        <!-- Desktop nav links removed - use sidebar -->\n\n                        '
  );

  // 9. Replace old mobile sidebar with new icon-rail sidebar
  const sidebarHTML = makeSidebarHTML(page.activeLink);
  html = html.replace(
    /\s*<!-- Sidebar \(Mobile drawer\) -->[\s\S]*?<\/ul>\s*<\/div>\s*<\/div>/,
    '\n' + sidebarHTML
  );

  // 10. Add toggle JS before </script>
  if (!html.includes('toggleSidebar')) {
    html = html.replace(
      /function logout\(\)\s*\{[\s\S]*?\}\s*\n\s*<\/script>/,
      (match) => match.replace('</script>', toggleJS + '\n        </script>')
    );
  }

  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ Safely applied sidebar to ${page.file}`);
}

console.log('Done!');
