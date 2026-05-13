const fs = require('fs');
const path = require('path');

const linksTemplate = (activeLink) => {
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

    return links.map(l => {
        const isActive = l.href === activeLink;
        const cls = isActive
            ? 'active bg-primary/10 text-primary border-r-4 border-primary !rounded-l-xl !rounded-r-none font-black'
            : 'opacity-60 hover:opacity-100 font-bold hover:bg-base-200 transition-all';
        return `                    <li><a href="${l.href}" class="${cls}"><i class="fa-solid ${l.icon} w-4 text-center"></i><span class="sidebar-text">${l.label}</span></a></li>`;
    }).join('\n');
};

const pagesToFix = [
    { file: 'admin.html', activeLink: '/admin' },
    { file: 'admin-pages/students.html', activeLink: '/students' },
    { file: 'admin-pages/sit-in.html', activeLink: '/sit-in' }
];

for (const page of pagesToFix) {
    const filePath = path.join(__dirname, page.file);
    if (!fs.existsSync(filePath)) continue;

    let html = fs.readFileSync(filePath, 'utf-8');

    // Restore the sidebar links
    // Find the divider and insert links after it.
    // Specifically, look for:
    // <div class="divider my-0 opacity-20"></div>
    //                 <li>
    //                     <!-- Desktop nav links removed - use sidebar -->
    //                 </li>
    const restoreRegex = /(<div class="divider my-0 opacity-20"><\/div>)([\s\S]*?)(<li class="mt-auto pt-4">)/;
    
    html = html.replace(restoreRegex, (match, p1, p2, p3) => {
        return `${p1}\n${linksTemplate(page.activeLink)}\n${p3}`;
    });

    // NOW we need to find the old top-nav links in students.html and sit-in.html.
    // These are located before `<div class="dropdown dropdown-end ml-4">` or `ml-2`.
    // Let's remove them directly.
    if (page.file !== 'admin.html') {
        const topNavRegex = /<a href="\/admin" class="btn btn-ghost btn-sm">Home<\/a>[\s\S]*?<a href="\/admin\/analytics" class="btn btn-ghost btn-sm">[\s\S]*?<\/a>/g;
        // Wait, one of the links might be 'btn-primary' instead of 'btn-ghost' depending on the active page.
        // So let's use:
        const saferTopNavRegex = /<a href="\/admin" class="btn btn-[^>]*>Home<\/a>[\s\S]*?<a href="\/admin\/analytics" class="btn btn-[^>]*>[\s\S]*?Analytics\s*<\/a>/;
        html = html.replace(saferTopNavRegex, '<!-- Desktop nav links removed -->');
    }

    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`✅ Fixed ${page.file}`);
}
