const fs = require('fs');

let html = fs.readFileSync('admin.html', 'utf-8');
const originalHtml = html;

const standardizedNav = `<!-- Desktop Menu utilities -->
                    <div class="hidden lg:flex flex-none items-center gap-1 ml-auto">
                        <!-- Search Student Modal Button -->
                        <button class="btn btn-ghost btn-sm" onclick="my_modal_1.showModal()">
                            <i class="fa-solid fa-search"></i>Search
                        </button>
                        
                        <!-- Search Modal -->
                        <dialog id="my_modal_1" class="modal">
                            <div class="modal-box">
                                <h3 class="text-xl font-black italic tracking-tighter text-base-content mb-2 flex items-center gap-2">
                                    <i class="fa-solid fa-magnifying-glass text-primary"></i> 
                                    Search <span class="text-primary not-italic">Student</span>
                                </h3>
                                <p class="text-sm opacity-60 mb-6 font-medium">Enter the student's ID Number to start a sit-in session.</p>

                                <div class="form-control w-full">
                                    <label class="label pt-0 pb-1">
                                        <span class="label-text-alt font-black uppercase opacity-40 tracking-widest">Student ID Number</span>
                                    </label>
                                    <div class="relative group">
                                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-primary/50 group-focus-within:text-primary transition-colors z-10">
                                            <i class="fa-solid fa-id-card"></i>
                                        </div>
                                        <input type="text" id="searchIdNumber" placeholder="e.g. 21-1234-567" class="input input-bordered w-full pl-11 rounded-2xl bg-base-200 border-base-content/5 focus:border-primary transition-all font-bold" />
                                    </div>
                                </div>
                                
                                <div class="modal-action mt-8">
                                    <form method="dialog" class="w-full flex gap-3">
                                        <button class="btn btn-ghost flex-1 rounded-2xl font-bold border border-base-content/5 hover:bg-base-content hover:text-base-100 transition-all duration-500">Cancel</button>
                                        <button type="button" class="btn btn-primary flex-1 rounded-2xl font-black italic uppercase" onclick="searchStudent()">
                                            Search <i class="fa-solid fa-arrow-right ml-1"></i>
                                        </button>
                                    </form>
                                </div>
                            </div>
                            <form method="dialog" class="modal-backdrop"><button>close</button></form>
                        </dialog>

                        <!-- Record Sit-in Modal -->
                        <dialog id="my_modal_2" class="modal">
                            <div class="modal-box p-8 max-w-md">
                                <h3 class="text-2xl font-black italic tracking-tighter text-base-content mb-6 flex items-center gap-2">
                                    <i class="fa-solid fa-clipboard-user text-primary"></i>
                                    Record <span class="text-primary not-italic">Sit-in</span>
                                </h3>
                                <div class="space-y-4">
                                    <div class="grid grid-cols-2 gap-4 mb-6">
                                        <div class="form-control">
                                            <label class="label pt-0 pb-1"><span class="label-text-alt font-black uppercase opacity-40 tracking-widest">ID Number</span></label>
                                            <input type="text" id="formIdNumber" placeholder="Enter ID" class="input input-bordered w-full rounded-2xl bg-base-200 border-base-content/5 focus:border-primary transition-all font-bold" />
                                        </div>
                                        <div class="bg-primary/10 rounded-2xl border border-primary/20 flex justify-center gap-2 items-center text-center mt-[1.6rem]">
                                            <p class="text-[10px] font-black uppercase tracking-widest text-primary/60">Remaining</p>
                                            <p class="text-2xl font-black text-primary leading-none" id="formSessions">0</p>
                                        </div>
                                        <div class="form-control col-span-2">
                                            <label class="label pt-0 pb-1"><span class="label-text-alt font-black uppercase opacity-40 tracking-widest">Student Name</span></label>
                                            <input type="text" id="formStudentName" placeholder="Enter Name" class="input input-bordered w-full rounded-2xl bg-base-200 border-base-content/5 focus:border-primary transition-all font-bold" />
                                        </div>
                                    </div>
                                    <div class="divider text-xs font-black opacity-30 uppercase tracking-widest before:bg-base-content/10 after:bg-base-content/10">Session Details</div>
                                    <div class="form-control">
                                        <label class="label pt-0 pb-1"><span class="label-text-alt font-black uppercase opacity-40 tracking-widest">Purpose</span></label>
                                        <select id="formPurpose" class="select select-bordered w-full rounded-2xl bg-base-200 border-base-content/5 focus:border-primary font-bold"><option value="" disabled selected>Select Purpose</option></select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label pt-0 pb-1"><span class="label-text-alt font-black uppercase opacity-40 tracking-widest">Laboratory</span></label>
                                        <select id="formLab" class="select select-bordered w-full rounded-2xl bg-base-200 border-base-content/5 focus:border-primary font-bold"><option value="" disabled selected>Select Lab Room</option></select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label pt-0 pb-1"><span class="label-text-alt font-black uppercase opacity-40 tracking-widest">PC Number</span></label>
                                        <input type="text" id="formPcNumber" placeholder="e.g. PC-01" class="input input-bordered w-full rounded-2xl bg-base-200 border-base-content/5 focus:border-primary transition-all font-bold" />
                                    </div>
                                </div>
                                <div class="modal-action mt-8">
                                    <form method="dialog" class="w-full flex gap-3">
                                        <button class="btn btn-ghost flex-1 rounded-2xl font-bold border border-base-content/5 hover:bg-base-content hover:text-base-100 transition-all duration-500" id="closeSitinModal">Cancel</button>
                                        <button type="button" class="btn btn-primary flex-1 rounded-2xl font-black italic uppercase" onclick="submitSitin()">Confirm Sit-in</button>
                                    </form>
                                </div>
                            </div>
                            <form method="dialog" class="modal-backdrop"><button>close</button></form>
                        </dialog>

                        <!-- Theme Dropdown -->
                        <div class="dropdown dropdown-end ml-2">
                            <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-2">
                                <i class="fa-solid fa-palette opacity-50"></i> Theme
                                <i class="fa-solid fa-chevron-down text-[10px] opacity-50"></i>
                            </div>
                            <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow mt-2 max-h-96 overflow-y-auto">
                                <li><button class="theme-controller" data-set-theme="light">Light</button></li>
                                <li><button class="theme-controller" data-set-theme="dark">Dark</button></li>
                                <li><button class="theme-controller" data-set-theme="cupcake">Cupcake</button></li>
                                <li><button class="theme-controller" data-set-theme="bumblebee">Bumblebee</button></li>
                                <li><button class="theme-controller" data-set-theme="emerald">Emerald</button></li>
                                <li><button class="theme-controller" data-set-theme="corporate">Corporate</button></li>
                                <li><button class="theme-controller" data-set-theme="synthwave">Synthwave</button></li>
                                <li><button class="theme-controller" data-set-theme="retro">Retro</button></li>
                                <li><button class="theme-controller" data-set-theme="cyberpunk">Cyberpunk</button></li>
                                <li><button class="theme-controller" data-set-theme="valentine">Valentine</button></li>
                                <li><button class="theme-controller" data-set-theme="halloween">Halloween</button></li>
                                <li><button class="theme-controller" data-set-theme="garden">Garden</button></li>
                                <li><button class="theme-controller" data-set-theme="forest">Forest</button></li>
                                <li><button class="theme-controller" data-set-theme="aqua">Aqua</button></li>
                                <li><button class="theme-controller" data-set-theme="lofi">Lofi</button></li>
                                <li><button class="theme-controller" data-set-theme="pastel">Pastel</button></li>
                                <li><button class="theme-controller" data-set-theme="fantasy">Fantasy</button></li>
                                <li><button class="theme-controller" data-set-theme="wireframe">Wireframe</button></li>
                                <li><button class="theme-controller" data-set-theme="black">Black</button></li>
                                <li><button class="theme-controller" data-set-theme="luxury">Luxury</button></li>
                                <li><button class="theme-controller" data-set-theme="dracula">Dracula</button></li>
                                <li><button class="theme-controller" data-set-theme="cmyk">Cmyk</button></li>
                                <li><button class="theme-controller" data-set-theme="autumn">Autumn</button></li>
                                <li><button class="theme-controller" data-set-theme="business">Business</button></li>
                                <li><button class="theme-controller" data-set-theme="acid">Acid</button></li>
                                <li><button class="theme-controller" data-set-theme="lemonade">Lemonade</button></li>
                                <li><button class="theme-controller" data-set-theme="night">Night</button></li>
                                <li><button class="theme-controller" data-set-theme="coffee">Coffee</button></li>
                                <li><button class="theme-controller" data-set-theme="winter">Winter</button></li>
                                <li><button class="theme-controller" data-set-theme="dim">Dim</button></li>
                                <li><button class="theme-controller" data-set-theme="nord">Nord</button></li>
                                <li><button class="theme-controller" data-set-theme="sunset">Sunset</button></li>
                                <li><button class="theme-controller" data-set-theme="caramellatte">Caramellatte</button></li>
                                <li><button class="theme-controller" data-set-theme="abyss">Abyss</button></li>
                                <li><button class="theme-controller" data-set-theme="silk">Silk</button></li>
                            </ul>
                        </div>

                        <!-- Notifications Dropdown -->
                        <div class="dropdown dropdown-end ml-2">
                            <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm">
                                <div class="indicator">
                                    <i class="fa-solid fa-bell text-sm"></i>
                                    <span id="notif-bell-badge" class="badge badge-xs badge-primary indicator-item hidden"></span>
                                </div>
                            </div>
                            <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-80 p-4 shadow mt-2">
                                <li class="menu-title font-bold text-base-content uppercase text-[10px] tracking-widest mb-2 px-0">Notifications</li>
                                <div id="notif-dropdown-list" class="max-h-60 overflow-y-auto">
                                    <li><a class="text-sm py-3 opacity-60 italic justify-center">No new notifications</a></li>
                                </div>
                            </ul>
                        </div>
                    </div>`;

const regex = /(<div class="hidden lg:flex flex-none items-center gap-1 ml-auto">)[\s\S]*?(?=(?:<!--[\s\S]*?-->\s*)?<main)/;

html = html.replace(regex, (match) => {
    console.log("Found match of length:", match.length);
    return standardizedNav + '\n                </div>\n\n                ';
});

if (html !== originalHtml) {
    fs.writeFileSync('admin.html', html, 'utf-8');
    console.log("FIXED ADMIN.HTML!");
} else {
    console.log("HTML DID NOT CHANGE!");
}
