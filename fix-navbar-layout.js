const fs = require('fs');
const path = require('path');

const pages = [
  'students.html',
  'sit-in.html'
];

for (const page of pages) {
  const filePath = path.join(__dirname, 'admin-pages', page);
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, 'utf-8');

  // We need to replace the old desktop menu wrapper with the new one
  // that includes the toggle and the ml-auto utility class.
  const oldMenuRegex = /<!-- Desktop Menu -->\s*\n\s*<div class="hidden md:flex flex-none items-center gap-1">/;
  
  if (oldMenuRegex.test(html)) {
      html = html.replace(
        oldMenuRegex,
        `<!-- Sidebar toggle for desktop -->
                    <div class="hidden lg:flex flex-none">
                        <button onclick="toggleSidebar()" class="btn btn-ghost btn-square btn-sm" title="Toggle Sidebar">
                            <i class="fa-solid fa-bars text-base"></i>
                        </button>
                    </div>

                    <!-- Desktop Menu utilities -->
                    <div class="hidden lg:flex flex-none items-center gap-1 ml-auto">`
      );
      fs.writeFileSync(filePath, html, 'utf-8');
      console.log(`✅ Fixed layout and toggle button on ${page}`);
  } else {
      console.log(`⏭️  Could not find old menu pattern in ${page}`);
  }
}
