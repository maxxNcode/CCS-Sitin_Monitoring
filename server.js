require('dotenv').config();
const express = require('express');
const http = require('http');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// Initialize Database and start server
// Initialize Database and start server
(async () => {
    try {
        await db.initDb();
        console.log('Database connection established');

        // Small delay to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 200));

        // 1. Create all tables sequentially using runAsync to avoid race conditions on Turso
        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idNumber TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                middleName TEXT,
                courseLevel TEXT,
                course TEXT,
                address TEXT,
                sessionLeft INTEGER DEFAULT 30,
                points INTEGER DEFAULT 0,
                profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Users table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS Announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Announcements table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS sitin_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentName TEXT NOT NULL,
                idNumber TEXT NOT NULL,
                purpose TEXT NOT NULL,
                lab TEXT NOT NULL,
                pcNumber TEXT,
                session TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Sitin records table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idNumber TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                middleName TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Admins table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS student_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentName TEXT NOT NULL,
                idNumber TEXT NOT NULL,
                purpose TEXT NOT NULL,
                lab TEXT NOT NULL,
                pcNumber TEXT,
                session TEXT NOT NULL,
                loginTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                logoutTime DATETIME,
                pointsEarned INTEGER DEFAULT 0
            )
        `);
        console.log('Student history table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                historyId INTEGER,
                idNumber TEXT NOT NULL,
                studentName TEXT NOT NULL,
                lab TEXT,
                purpose TEXT,
                rating INTEGER NOT NULL,
                comments TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Feedbacks table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                studentName TEXT NOT NULL,
                idNumber TEXT NOT NULL,
                lab TEXT NOT NULL,
                pcNumber TEXT,
                purpose TEXT NOT NULL,
                reservationDate DATE NOT NULL,
                reservationTime TIME NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Reservations table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idNumber TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                isRead INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Notifications table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);
        console.log('System settings table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS dropdown_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                value TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, value)
            )
        `);
        console.log('Dropdown options table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS lab_softwares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                labName TEXT NOT NULL,
                softwareName TEXT NOT NULL,
                version TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Lab softwares table ready');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS ai_chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idNumber TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('AI chats table ready');

        // 2. Run migrations sequentially
        // Ensure points column exists in users
        try {
            await db.runAsync("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0");
            console.log('Migration: Checked/Added points column to users table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure profilePic column exists in users
        try {
            await db.runAsync("ALTER TABLE users ADD COLUMN profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky'");
            console.log('Migration: Checked/Added profilePic column to users table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure sessionLeft column exists in users
        try {
            await db.runAsync("ALTER TABLE users ADD COLUMN sessionLeft INTEGER DEFAULT 30");
            console.log('Migration: Checked/Added sessionLeft column to users table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure pcNumber column exists in sitin_records
        try {
            await db.runAsync("ALTER TABLE sitin_records ADD COLUMN pcNumber TEXT DEFAULT 'N/A'");
            console.log('Migration: Checked/Added pcNumber column to sitin_records table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure pcNumber column exists in student_history
        try {
            await db.runAsync("ALTER TABLE student_history ADD COLUMN pcNumber TEXT DEFAULT 'N/A'");
            console.log('Migration: Checked/Added pcNumber column to student_history table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure pointsEarned column exists in student_history
        try {
            await db.runAsync("ALTER TABLE student_history ADD COLUMN pointsEarned INTEGER DEFAULT 0");
            console.log('Migration: Checked/Added pointsEarned column to student_history table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure middleName column exists in users
        try {
            await db.runAsync("ALTER TABLE users ADD COLUMN middleName TEXT");
            console.log('Migration: Checked/Added middleName column to users table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure middleName column exists in admins
        try {
            await db.runAsync("ALTER TABLE admins ADD COLUMN middleName TEXT");
            console.log('Migration: Checked/Added middleName column to admins table');
        } catch (e) { /* ignore if already exists */ }

        // Ensure isHidden column exists in Announcements
        try {
            await db.runAsync("ALTER TABLE Announcements ADD COLUMN isHidden INTEGER DEFAULT 0");
            await db.runAsync("UPDATE Announcements SET isHidden = 0 WHERE isHidden IS NULL");
            console.log('Migration: Checked/Added isHidden column to Announcements table');
        } catch (e) { /* ignore if already exists */ }

        // Rename Annoucements table if needed
        try {
            const oldTable = await db.getAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='Annoucements'");
            if (oldTable) {
                const countRow = await db.getAsync("SELECT COUNT(*) as count FROM Announcements");
                if (countRow && countRow.count === 0) {
                    await db.runAsync("DROP TABLE Announcements");
                    await db.runAsync("ALTER TABLE Annoucements RENAME TO Announcements");
                    console.log('Migration: Renamed Annoucements table to Announcements');
                }
            }
        } catch (e) { console.error('Migration error renaming table:', e.message); }

        // 3. Seed database sequentially
        // Seed default dropdown options if empty
        const countDropdowns = await db.getAsync("SELECT COUNT(*) as count FROM dropdown_options");
        if (countDropdowns && countDropdowns.count === 0) {
            const defaults = [
                { cat: 'lab', val: 'Lab 524' },
                { cat: 'lab', val: 'Lab 526' },
                { cat: 'lab', val: 'Lab 528' },
                { cat: 'lab', val: 'Lab 530' },
                { cat: 'purpose', val: 'C-Programming Assignment' },
                { cat: 'purpose', val: 'Java Project Development' },
                { cat: 'purpose', val: 'Web Systems Exam' },
                { cat: 'purpose', val: 'Database Management Lab' },
                { cat: 'course', val: 'BSIT' },
                { cat: 'course', val: 'BSCS' },
                { cat: 'course', val: 'BSCPE' }
            ];
            for (const item of defaults) {
                await db.runAsync("INSERT OR IGNORE INTO dropdown_options (category, value) VALUES (?, ?)", [item.cat, item.val]);
            }
            console.log('Seeded default dropdown options');
        }

        // Seed default announcements if empty
        const countAnnouncements = await db.getAsync("SELECT COUNT(*) as count FROM Announcements");
        if (countAnnouncements && countAnnouncements.count === 0) {
            await db.runAsync("INSERT INTO Announcements (title, description) VALUES (?, ?)", ['Welcome!', 'Welcome to the CCS Sit-In Monitoring System.']);
            console.log('Seeded default announcements');
        }

        // Start listening only when DB is fully ready (skip server.listen on Vercel)
        if (!process.env.VERCEL) {
            server.listen(PORT, () => {
                console.log(`Server running at http://localhost:${PORT}`);
            });
        } else {
            console.log('Running in Vercel serverless environment. Database initialized successfully.');
        }
    } catch (err) {
        console.error('Failed to initialize database:', err);
        if (!process.env.VERCEL) {
            process.exit(1);
        }
    }
})();

// Initialize database schema
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idNumber TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            middleName TEXT,
            courseLevel TEXT,
            course TEXT,
            address TEXT,
            sessionLeft INTEGER DEFAULT 30,
            points INTEGER DEFAULT 0,
            profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table ready');
            // Ensure points column exists for existing databases
            db.run("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0", (err) => {
                // Ignore error if column already exists
            });
        }
    });
}

function createTableAnnouncements() {
    db.run(`
        CREATE TABLE IF NOT EXISTS Announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )       
    `)
}

function createTableSitInRecords() {
    db.run(`
        CREATE TABLE IF NOT EXISTS sitin_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studentName TEXT NOT NULL,
            idNumber TEXT NOT NULL,
            purpose TEXT NOT NULL,
            lab TEXT NOT NULL,
            pcNumber TEXT,
            session TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)
}

function createTableAdmins() {
    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idNumber TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            middleName TEXT,
            profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)
}

function createTableStudentHistory() {
    db.run(`
        CREATE TABLE IF NOT EXISTS student_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            studentName TEXT NOT NULL,
            idNumber TEXT NOT NULL,
            purpose TEXT NOT NULL,
            lab TEXT NOT NULL,
            pcNumber TEXT,
            loginTime DATETIME NOT NULL,
            logoutTime DATETIME NOT NULL,
            date DATE NOT NULL,
            feedbackStatus TEXT DEFAULT 'Pending'
        )
    `)
}

function createTableFeedbacks() {
    db.run(`
        CREATE TABLE IF NOT EXISTS feedbacks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            historyId INTEGER NOT NULL,
            idNumber TEXT NOT NULL,
            studentName TEXT NOT NULL,
            lab TEXT NOT NULL,
            purpose TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comments TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (historyId) REFERENCES student_history(id)
        )
    `)
}

function createTableReservations() {
    db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idNumber TEXT NOT NULL,
            studentName TEXT NOT NULL,
            lab TEXT NOT NULL,
            purpose TEXT NOT NULL,
            reservationDate DATE NOT NULL,
            reservationTime TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function createTableNotifications() {
    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idNumber TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            isRead INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (!err) {
            db.all("PRAGMA table_info(notifications)", (err, columns) => {
                if (!err && columns) {
                    if (!columns.some(c => c.name === 'type')) {
                        db.run("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info'", (err) => {
                            if (!err) console.log('Added type column to notifications table');
                        });
                    }
                    if (!columns.some(c => c.name === 'created_at')) {
                        db.run("ALTER TABLE notifications ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
                            if (!err) {
                                console.log('Added created_at column to notifications table');
                                db.run("UPDATE notifications SET created_at = createdAt WHERE created_at IS NULL AND createdAt IS NOT NULL");
                            }
                        });
                    }
                    if (!columns.some(c => c.name === 'createdAt')) {
                        db.run("ALTER TABLE notifications ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
                            if (!err) console.log('Added createdAt column to notifications table');
                        });
                    }
                }
            });
        }
    });
}

function createTableSystemSettings() {
    db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `, (err) => {
        if (!err) {
            db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('reservationsEnabled', 'true')`);
        }
    });
}

function createTableDropdownOptions() {
    db.run(`
        CREATE TABLE IF NOT EXISTS dropdown_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            value TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function createTableLabSoftwares() {
    db.run(`
        CREATE TABLE IF NOT EXISTS lab_softwares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lab_id INTEGER NOT NULL,
            software_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lab_id) REFERENCES dropdown_options(id) ON DELETE CASCADE
        )
    `);
}

function seedDropdownOptions() {
    db.get('SELECT COUNT(*) as count FROM dropdown_options', (err, row) => {
        if (err) return;
        if (row.count === 0) {
            const defaults = [
                // Courses
                { category: 'course', value: 'BS Computer Science', sort_order: 1 },
                { category: 'course', value: 'BS Information Technology', sort_order: 2 },
                { category: 'course', value: 'BS Information Systems', sort_order: 3 },
                { category: 'course', value: 'BS Computer Engineering', sort_order: 4 },
                { category: 'course', value: 'Associate in Computer Technology', sort_order: 5 },
                // Labs
                { category: 'lab', value: 'Lab 524', sort_order: 1 },
                { category: 'lab', value: 'Lab 526', sort_order: 2 },
                { category: 'lab', value: 'Lab 542', sort_order: 3 },
                { category: 'lab', value: 'Mac Lab', sort_order: 4 },
                // Purposes
                { category: 'purpose', value: 'C Programming', sort_order: 1 },
                { category: 'purpose', value: 'Java Programming', sort_order: 2 },
                { category: 'purpose', value: 'ASP.NET', sort_order: 3 },
                { category: 'purpose', value: 'Python', sort_order: 4 },
                { category: 'purpose', value: 'Database', sort_order: 5 },
                { category: 'purpose', value: 'Digital Logic & Design', sort_order: 6 },
                { category: 'purpose', value: 'Embedded Systems & IoT', sort_order: 7 },
                { category: 'purpose', value: 'System Integration & Architecture', sort_order: 8 },
                { category: 'purpose', value: 'Computer Application', sort_order: 9 },
                { category: 'purpose', value: 'Web Development', sort_order: 10 },
                { category: 'purpose', value: 'Mobile App Development', sort_order: 11 },
                { category: 'purpose', value: 'Project Development (Thesis/Capstone)', sort_order: 12 },
            ];
            const stmt = db.prepare('INSERT INTO dropdown_options (category, value, sort_order) VALUES (?, ?, ?)');
            defaults.forEach(d => stmt.run(d.category, d.value, d.sort_order));
            stmt.finalize();
            console.log('Seeded dropdown_options with default data');
        }
    });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// manual CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express.static(path.join(__dirname)));

// Serve Static
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer generic upload config using memory storage for stateless Vercel compatibility
const upload = multer({ storage: multer.memoryStorage() });

app.use('/uploads', express.static(uploadsDir));

// Session configuration (using cookie-session for serverless session persistence on Vercel)
app.use(session({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'ccs-sitin-monitoring-secret'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));



// Middleware to check if user is logged in (any role)
function checkAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Unauthorized. Please log in.' });
        } else {
            res.redirect('/login');
        }
    }
}

// Middleware to check if user is an ADMIN
function checkAdminAuth(req, res, next) {
    if (req.session.userId && req.session.role === 'admin') {
        next();
    } else {
        if (req.path.startsWith('/api/')) {
            res.status(403).json({ error: 'Access denied. Admin only.' });
        } else {
            res.redirect('/login');
        }
    }
}

// Routes

// Route to create a new announcement
app.post('/api/announcements', checkAdminAuth, (req, res) => {
    const { title, description } = req.body;


    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    const query = `INSERT INTO Announcements (title, description) VALUES (?, ?)`

    db.run(query, [title, description],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Failed to create announcement' })
            }

            // Notify ALL students about new announcement
            const notifMsg = `New announcement: "${title}"`;
            db.all('SELECT idNumber FROM users', [], (err, students) => {
                if (!err && students) {
                    students.forEach(s => {
                        db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)',
                            [s.idNumber, notifMsg, 'info']);
                    });
                    // Push via Socket.IO to all connected students
                    io.emit('notification:student', { message: notifMsg, type: 'info', category: 'announcement' });
                }
            });

            res.json({ success: true, message: 'Announcement created successfully' });
        });
});

// Login route
app.post('/login', (req, res) => {
    const { idNumber, password } = req.body;

    if (!idNumber || !password) {
        return res.status(400).json({ error: 'ID Number and Password are required' });
    }

    // First check in admins table
    db.get('SELECT * FROM admins WHERE idNumber = ?', [idNumber], (err, admin) => {
        if (err) return res.status(500).json({ error: err.message || 'Server error' });

        if (admin) {
            bcrypt.compare(password, admin.password, (err, isMatch) => {
                if (err) return res.status(500).json({ error: err.message || 'Server error' });
                if (!isMatch) return res.status(401).json({ error: 'Invalid ID Number or Password' });

                req.session.userId = admin.id;
                req.session.idNumber = admin.idNumber;
                req.session.firstName = admin.firstName;
                req.session.lastName = admin.lastName;
                req.session.middleName = admin.middleName;
                req.session.profilePic = admin.profilePic;
                req.session.role = 'admin';

                return res.json({ 
                    success: true, 
                    message: 'Admin logged in successfully', 
                    redirectUrl: '/admin',
                    role: 'admin'
                });
            });
        } else {
            // If not found in admins, check in users (students)
            db.get('SELECT * FROM users WHERE idNumber = ?', [idNumber], (err, user) => {
                if (err) return res.status(500).json({ error: err.message || 'Server error' });

                if (!user) {
                    return res.status(401).json({ error: 'Invalid ID Number or Password' });
                }

                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) return res.status(500).json({ error: err.message || 'Server error' });
                    if (!isMatch) return res.status(401).json({ error: 'Invalid ID Number or Password' });

                    req.session.userId = user.id;
                    req.session.idNumber = user.idNumber;
                    req.session.firstName = user.firstName;
                    req.session.lastName = user.lastName;
                    req.session.middleName = user.middleName;
                    req.session.profilePic = user.profilePic;
                    req.session.role = 'student';

                    return res.json({ 
                        success: true, 
                        message: 'Student logged in successfully', 
                        redirectUrl: '/homepage',
                        role: 'student'
                    });
                });
            });
        }
    });
});


app.get('/api/announcements', (req, res) => {
    // Determine if user is admin
    const isAdmin = req.session.userId && req.session.role === 'admin';
    
    // If not admin, we only show items specifically marked as NOT hidden (isHidden = 0)
    // We also handle cases where isHidden might be NULL
    const query = isAdmin 
        ? 'SELECT id, title, description, created_at, isHidden FROM Announcements ORDER BY created_at DESC'
        : 'SELECT title, description, created_at FROM Announcements WHERE isHidden = 0 OR isHidden IS NULL ORDER BY created_at DESC';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching announcements:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        
        // Debugging log to verify filtering
        console.log(`Announcements fetched for ${isAdmin ? 'ADMIN' : 'STUDENT'}. Returning ${rows.length} items.`);
        res.json(rows);
    });
});

// Admin API: Toggle Announcement Visibility
app.post('/api/announcements/toggle-hide/:id', checkAdminAuth, (req, res) => {
    const id = req.params.id;
    db.get('SELECT isHidden FROM Announcements WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Announcement not found' });
        
        const newStatus = row.isHidden === 1 ? 0 : 1;
        db.run('UPDATE Announcements SET isHidden = ? WHERE id = ?', [newStatus, id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update' });
            
            // Push notification so active student homepages dynamically update their announcement list
            io.emit('notification:student', { category: 'announcement', message: 'Announcements updated' });
            
            res.json({ success: true, isHidden: newStatus });
        });
    });
});

// Generic User Info API - Fetch current user (student or admin)
app.get('/api/studentinfo', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.session.userId;
    const role = req.session.role;
    const table = role === 'admin' ? 'admins' : 'users';

    db.get(`
        SELECT firstName, middleName, lastName,
        firstName || ' ' || (CASE WHEN middleName IS NOT NULL AND middleName != '' THEN middleName || ' ' ELSE '' END) || lastName AS name,
        email, profilePic, 
        ${role === 'student' ? 'course, courseLevel, address, sessionLeft' : '"" as course, "" as courseLevel, "" as address, 0 as sessionLeft'}
        FROM ${table}
        WHERE id = ?
    `, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
    });
});

// Update Profile API
app.post('/api/update-profile', upload.single('profileImage'), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { firstName, lastName, middleName, email, profilePic, course, courseLevel, address } = req.body;
    const userId = req.session.userId;
    const role = req.session.role;

    let finalProfilePic = profilePic;
    if (req.file) {
        const base64Data = req.file.buffer.toString('base64');
        finalProfilePic = `data:${req.file.mimetype};base64,${base64Data}`;
    }

    try {
        if (role === 'admin') {
            await db.runAsync(`UPDATE admins SET firstName = ?, lastName = ?, middleName = ?, email = ?, profilePic = ? WHERE id = ?`,
                [firstName, lastName, middleName, email, finalProfilePic, userId]);
            req.session.firstName = firstName;
            req.session.lastName = lastName;
            req.session.profilePic = finalProfilePic;
            res.json({ success: true, profilePic: finalProfilePic });
        } else {
            await db.runAsync(`UPDATE users SET firstName = ?, lastName = ?, middleName = ?, email = ?, course = ?, courseLevel = ?, address = ?, profilePic = ? WHERE id = ?`,
                [firstName, lastName, middleName, email, course, courseLevel, address, finalProfilePic, userId]);
            req.session.firstName = firstName;
            req.session.lastName = lastName;
            req.session.profilePic = finalProfilePic;

            // Notify admin that a student updated their profile
            const adminMsg = `${firstName} ${lastName} (${req.session.idNumber}) has updated their profile.`;
            await db.runAsync("INSERT INTO notifications (idNumber, message, type) VALUES ('ADMIN', ?, 'info')", [adminMsg]);
            io.emit('notification:admin', { message: adminMsg, type: 'info' });

            res.json({ success: true, profilePic: finalProfilePic });
        }
    } catch (err) {
        console.error("Error during profile update transaction:", err);
        res.status(500).json({ error: 'Update failed' });
    }
});
// Register route
app.post('/register', (req, res) => {
    const { idNumber, email, password, firstName, lastName, middleName, courseLevel, course, address } = req.body;

    if (!idNumber || !email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'ID Number, Email, Password, First Name, and Last Name are required' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        db.run(
            `INSERT INTO users (idNumber, email, password, firstName, lastName, middleName, courseLevel, course, address, sessionLeft)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 30)`,
            [idNumber, email, hashedPassword, firstName, lastName, middleName, courseLevel, course, address],
            (err) => {
                if (err) {
                    console.error('Registration DB error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'ID Number or Email already exists' });
                    }
                    return res.status(500).json({ error: err.message || 'Server error' });
                }

                // Notify admin about new student registration
                const adminMsg = `New student registered: ${firstName} ${lastName} (${idNumber})`;
                db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)',
                    ['ADMIN', adminMsg, 'info']);
                io.emit('notification:admin', { message: adminMsg, type: 'info' });

                res.json({ success: true, message: 'Registration successful', redirectUrl: '/login.html' });
            }
        );
    });
});

// Admin API: Search Student by ID
app.get('/api/admin/search-student/:idNumber', (req, res) => {
    const idNumber = req.params.idNumber;
    db.get("SELECT firstName || ' ' || lastName as name, sessionLeft FROM users WHERE idNumber = ?", [idNumber], (err, row) => {
        if (err) {
            console.error("Student search database error:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) return res.status(404).json({ error: 'Student not found' });
        res.json(row);
    });
});

// Admin API: Record Sit-in
app.post('/api/admin/sit-in', (req, res) => {
    const { idNumber, studentName, purpose, lab } = req.body;

    if (!idNumber || !studentName || !purpose || !lab) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.get('SELECT sessionLeft FROM users WHERE idNumber = ?', [idNumber], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Student not found' });
        
        if (user.sessionLeft <= 0) {
            return res.status(400).json({ error: 'No sessions remaining' });
        }

        const { pcNumber } = req.body;

        // Only insert the record — do NOT decrement sessionLeft yet
        db.run(`INSERT INTO sitin_records (studentName, idNumber, purpose, lab, pcNumber, session, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [studentName, idNumber, purpose, lab, pcNumber || 'N/A', user.sessionLeft.toString(), 'Active'],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to record sit-in' });
                res.json({ success: true, message: 'Sit-in recorded successfully' });
            });
    });
});

// Admin API: Fetch All Sit-in Records
app.get('/api/admin/sit-in-records', (req, res) => {
    db.all(`
        SELECT s.*, u.profilePic 
        FROM sitin_records s
        LEFT JOIN users u ON s.idNumber = u.idNumber
        ORDER BY s.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin API: Fetch Active Sit-ins Only
app.get('/api/admin/active-sitins', (req, res) => {
    db.all(`
        SELECT s.*, u.profilePic 
        FROM sitin_records s
        LEFT JOIN users u ON s.idNumber = u.idNumber
        WHERE s.status = 'Active'
        ORDER BY s.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin API: Fetch Sit-in History (Inactive Only)
app.get('/api/admin/sit-in-history', (req, res) => {
    db.all(`
        SELECT s.*, u.profilePic 
        FROM sitin_records s
        LEFT JOIN users u ON s.idNumber = u.idNumber
        WHERE s.status = 'Inactive'
        ORDER BY s.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin API: Logout / End a Sit-in Session
app.post('/api/admin/sit-in/logout/:id', async (req, res) => {
    const recordId = req.params.id;

    try {
        const record = await db.getAsync('SELECT * FROM sitin_records WHERE id = ?', [recordId]);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        if (record.status !== 'Active') return res.status(400).json({ error: 'Session already ended' });

        // 1. Set status to Inactive
        await db.runAsync('UPDATE sitin_records SET status = ? WHERE id = ?', ['Inactive', recordId]);

        // 2. Decrement sessionLeft on logout and award points
        await db.runAsync('UPDATE users SET sessionLeft = sessionLeft - 1, points = points + 10 WHERE idNumber = ?', [record.idNumber]);

        // 3. Add record to student_history table
        const loginTime = record.created_at;
        const logoutTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const date = logoutTime.split(' ')[0]; // Extract YYYY-MM-DD
        await db.runAsync(
            'INSERT INTO student_history (studentName, idNumber, purpose, lab, pcNumber, loginTime, logoutTime, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [record.studentName, record.idNumber, record.purpose, record.lab, record.pcNumber || 'N/A', loginTime, logoutTime, date]
        );

        // 4. Notify student about session end and remaining sessions
        const student = await db.getAsync('SELECT sessionLeft, points FROM users WHERE idNumber = ?', [record.idNumber]);
        if (student) {
            const message = `Sit-in session ended! You earned +10 points. Remaining sessions: ${student.sessionLeft}`;
            await db.runAsync('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)', [record.idNumber, message, 'success']);
            io.emit('notification:student', {
                idNumber: record.idNumber,
                message,
                type: 'success'
            });
        }

        res.json({ success: true, message: 'Session ended successfully' });
    } catch (err) {
        console.error("Error during sit-in logout transaction:", err);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Admin API: Delete a Sit-in Record
app.delete('/api/admin/sit-in/:id', (req, res) => {
    const recordId = req.params.id;

    db.run('DELETE FROM sitin_records WHERE id = ?', [recordId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete record' });
        if (this.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ success: true, message: 'Record deleted successfully' });
    });
});

// Admin API: Fetch All Students
app.get('/api/admin/students', (req, res) => {
    db.all('SELECT idNumber, firstName, lastName, middleName, email, course, courseLevel, sessionLeft, profilePic FROM users', (err, rows) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Admin API: Add Student
app.post('/api/admin/students', checkAdminAuth, (req, res) => {
    const { idNumber, firstName, lastName, middleName, email, course, courseLevel, password } = req.body;
    // For admins adding students, we can default the password to their idNumber if not provided
    const studentPassword = password || idNumber;

    bcrypt.hash(studentPassword, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ error: 'Server error' });

        db.run(
            `INSERT INTO users (idNumber, firstName, lastName, middleName, email, course, courseLevel, password, sessionLeft)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 30)`,
            [idNumber, firstName, lastName, middleName, email, course, courseLevel, hashedPassword],
            (err) => {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'ID Number or Email already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true });
            }
        );
    });
});

// Admin API: Update Student
app.put('/api/admin/students/:idNumber', checkAdminAuth, (req, res) => {
    const idNumber = req.params.idNumber;
    const { firstName, lastName, middleName, email, course, courseLevel } = req.body;

    db.run(
        `UPDATE users SET firstName = ?, lastName = ?, middleName = ?, email = ?, course = ?, courseLevel = ? WHERE idNumber = ?`,
        [firstName, lastName, middleName, email, course, courseLevel, idNumber],
        (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

// Admin API: Delete Student
app.delete('/api/admin/students/:idNumber', checkAdminAuth, (req, res) => {
    const idNumber = req.params.idNumber;
    db.run('DELETE FROM users WHERE idNumber = ?', [idNumber], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Admin API: Reset Single Student Sessions
app.post('/api/admin/students/reset/:idNumber', checkAdminAuth, (req, res) => {
    const idNumber = req.params.idNumber;
    db.run('UPDATE users SET sessionLeft = 30 WHERE idNumber = ?', [idNumber], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Admin API: Reset All Juniors (3rd Year and below)
app.post('/api/admin/students/reset-all-juniors', checkAdminAuth, (req, res) => {
    const juniors = ['1st Year', '2nd Year', '3rd Year'];
    const placeholders = juniors.map(() => '?').join(',');
    db.run(`UPDATE users SET sessionLeft = 30 WHERE courseLevel IN (${placeholders})`, juniors, (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Admin API: Fetch Dashboard Statistics
app.get('/api/admin/dashboard-stats', checkAdminAuth, (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.totalStudents = row.count;
        
        db.get('SELECT COUNT(*) as count FROM sitin_records WHERE status = "Active"', (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.activeSitIn = row.count;
            
            db.get('SELECT COUNT(*) as count FROM sitin_records', (err, row) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                stats.totalSitIn = row.count;
                res.json(stats);
            });
        });
    });
});

// Admin API: Fetch Weekly Activity
app.get('/api/admin/weekly-activity', checkAdminAuth, (req, res) => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
    }

    db.all(`
        SELECT date(created_at) as log_date, COUNT(*) as count 
        FROM sitin_records 
        WHERE date(created_at) >= ? 
        GROUP BY log_date
    `, [days[0]], (err, rows) => {
        if (err) {
            console.error('Error fetching weekly activity:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const data = days.map(dateStr => {
            const row = rows.find(r => r.log_date === dateStr);
            const dateObj = new Date(dateStr);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            return {
                date: dateStr,
                day: dayName,
                count: row ? row.count : 0
            };
        });
        
        res.json(data);
    });
});


// Admin API: Fetch Sit-in Reports (Paginated & Filtered)
app.get('/api/admin/reports/sit-in', checkAdminAuth, (req, res) => {
    const { search, date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT h.*, u.profilePic 
        FROM student_history h
        LEFT JOIN users u ON h.idNumber = u.idNumber
        WHERE 1=1
    `;
    let countQuery = `SELECT COUNT(*) as total FROM student_history h LEFT JOIN users u ON h.idNumber = u.idNumber WHERE 1=1`;
    const params = [];

    if (search) {
        const searchPattern = `%${search}%`;
        query += ` AND (h.idNumber LIKE ? OR h.studentName LIKE ?)`;
        countQuery += ` AND (h.idNumber LIKE ? OR h.studentName LIKE ?)`;
        params.push(searchPattern, searchPattern);
    }

    if (date) {
        query += ` AND h.date = ?`;
        countQuery += ` AND h.date = ?`;
        params.push(date);
    }

    query += ` ORDER BY h.loginTime DESC LIMIT ? OFFSET ?`;
    db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: 'Database error fetching count' });
        
        const finalParams = [...params, parseInt(limit), parseInt(offset)];
        db.all(query, finalParams, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error fetching reports' });
            res.json({
                data: rows,
                total: countRow.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countRow.total / limit)
            });
        });
    });
});

// Student API: Create Reservation
app.post('/api/student/reserve', checkAuth, (req, res) => {
    // Check if reservations are enabled
    db.get("SELECT value FROM system_settings WHERE key = 'reservationsEnabled'", [], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row && row.value !== 'true') {
            return res.status(403).json({ error: 'Reservations are currently disabled by the administrator.' });
        }

        const { lab, purpose, date, time } = req.body;
        const { idNumber, firstName, lastName } = req.session;
        const studentName = `${firstName} ${lastName}`;

        if (!lab || !purpose || !date || !time) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        db.run(
            `INSERT INTO reservations (idNumber, studentName, lab, purpose, reservationDate, reservationTime) VALUES (?, ?, ?, ?, ?, ?)`,
            [idNumber, studentName, lab, purpose, date, time],
            function (err) {
                if (err) return res.status(500).json({ error: 'Failed to create reservation' });
                
                // Notify ADMIN about new reservation
                const adminMessage = `${studentName} has requested a reservation for ${lab} on ${date}.`;
                db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)', 
                    ['ADMIN', adminMessage, 'info']);
                // Push via Socket.IO
                io.emit('notification:admin', { message: adminMessage, type: 'info' });

                res.json({ success: true, message: 'Reservation submitted successfully' });
            }
        );
    });
});

// Student API: Fetch Reservations
app.get('/api/student/reservations', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;
    db.all(`SELECT * FROM reservations WHERE idNumber = ? ORDER BY created_at DESC`, [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Student API: Toggle Reservation Status (Enable/Disable/Cancel)
app.post('/api/student/reservations/toggle-status', checkAuth, (req, res) => {
    const id = parseInt(req.body.id);
    const idNumber = req.session.idNumber;

    if (!id || isNaN(id)) return res.status(400).json({ error: 'Valid Reservation ID is required' });

    db.get('SELECT * FROM reservations WHERE id = ? AND idNumber = ?', [id, idNumber], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Reservation not found' });
        
        if (row.status === 'Checked In' || row.status === 'Rejected') {
            return res.status(400).json({ error: `Cannot change status for a reservation that is ${row.status}` });
        }

        const newStatus = row.status === 'Cancelled' ? 'Pending' : 'Cancelled';

        db.run('UPDATE reservations SET status = ? WHERE id = ?', [newStatus, id], function(err) {
            if (err) return res.status(500).json({ error: `Failed to ${newStatus === 'Cancelled' ? 'cancel' : 'enable'} reservation` });
            
            const actionVerb = newStatus === 'Cancelled' ? 'cancelled' : 're-enabled';
            const adminMsg = `Student ${req.session.firstName} ${req.session.lastName} ${actionVerb} their reservation for ${row.lab} on ${row.reservationDate}.`;
            
            db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)', ['ADMIN', adminMsg, 'warning']);
            io.emit('notification:admin', { message: adminMsg, type: 'warning' });

            res.json({ 
                success: true, 
                message: `Reservation ${newStatus === 'Cancelled' ? 'cancelled' : 're-enabled'} successfully`,
                newStatus 
            });
        });
    });
});

// Admin API: Fetch All Reservations
app.get('/api/admin/reservations', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT r.*, u.profilePic 
        FROM reservations r 
        LEFT JOIN users u ON r.idNumber = u.idNumber 
        ORDER BY r.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin API: Reservation Action (Approve/Reject)
app.post('/api/admin/reservations/action', checkAdminAuth, (req, res) => {
    const { id, action } = req.body; // action: 'Approved' or 'Rejected'

    if (!id || !['Approved', 'Rejected'].includes(action)) {
        return res.status(400).json({ error: 'Invalid ID or action' });
    }

    db.get('SELECT * FROM reservations WHERE id = ?', [id], (err, reservation) => {
        if (err || !reservation) return res.status(404).json({ error: 'Reservation not found' });

        db.run('UPDATE reservations SET status = ? WHERE id = ?', [action, id], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to update reservation' });

            // Create notification for student
            const message = `Your reservation for ${reservation.lab} on ${reservation.reservationDate} has been ${action.toLowerCase()}.`;
            const type = action === 'Approved' ? 'success' : 'error';
            
            db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)', 
                [reservation.idNumber, message, type]);
            // Push via Socket.IO to student
            io.emit('notification:student', { idNumber: reservation.idNumber, message, type });

            res.json({ success: true, message: `Reservation ${action.toLowerCase()} successfully` });
        });
    });
});

// Admin API: Reservation Check-in
app.post('/api/admin/reservations/check-in', checkAdminAuth, async (req, res) => {
    const { id } = req.body;

    if (!id) return res.status(400).json({ error: 'Reservation ID is required' });

    try {
        const reservation = await db.getAsync('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
        if (reservation.status !== 'Approved') return res.status(400).json({ error: 'Only approved reservations can be checked in' });

        const user = await db.getAsync('SELECT sessionLeft FROM users WHERE idNumber = ?', [reservation.idNumber]);
        if (!user) return res.status(404).json({ error: 'Student not found' });
        if (user.sessionLeft <= 0) return res.status(400).json({ error: 'Student has no sessions remaining' });

        // Ensure check-in is not before reservation time
        const now = new Date();
        const resDateTime = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
        if (resDateTime > now) {
            return res.status(400).json({ 
                error: `Check-in is not yet allowed. Scheduled for ${reservation.reservationDate} at ${reservation.reservationTime}` 
            });
        }

        // 1. Create active sit-in record
        await db.runAsync(`INSERT INTO sitin_records (studentName, idNumber, purpose, lab, session, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [reservation.studentName, reservation.idNumber, reservation.purpose, reservation.lab, user.sessionLeft.toString(), 'Active']);

        // 2. Update reservation status
        await db.runAsync('UPDATE reservations SET status = ? WHERE id = ?', ['Checked In', id]);

        res.json({ success: true, message: 'Student checked in successfully' });
    } catch (err) {
        console.error("Error during reservation check-in transaction:", err);
        res.status(500).json({ error: 'Failed to process check-in' });
    }
});

// Generic API: Fetch Notifications
app.get('/api/notifications', checkAuth, (req, res) => {
    const idNumber = req.session.role === 'admin' ? 'ADMIN' : req.session.idNumber;
    db.all(`SELECT * FROM notifications WHERE idNumber = ? ORDER BY created_at DESC LIMIT 20`, [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Generic API: Mark Notifications as Read
app.post('/api/notifications/mark-read', checkAuth, (req, res) => {
    const idNumber = req.session.role === 'admin' ? 'ADMIN' : req.session.idNumber;
    db.run(`UPDATE notifications SET isRead = 1 WHERE idNumber = ?`, [idNumber], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to mark notifications as read' });
        res.json({ success: true });
    });
});


// Admin Register route
app.post('/api/admin/register', (req, res) => {
    const { idNumber, email, password, firstName, lastName, middleName } = req.body;

    if (!idNumber || !email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ error: 'Server error' });

        db.run(
            `INSERT INTO admins (idNumber, email, password, firstName, lastName, middleName)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idNumber, email, hashedPassword, firstName, lastName, middleName],
            (err) => {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'ID Number or Email already exists' });
                    }
                    return res.status(500).json({ error: 'Server error' });
                }
                res.json({ success: true, message: 'Admin registered successfully' });
            }
        );
    });
});

// Logout route
app.post('/logout', (req, res) => {
    req.session = null; // Clear cookie-session
    res.json({ success: true, message: 'Logged out successfully', redirectUrl: '/login?logout=success' });
});

// Check session route
app.get('/check-session', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            idNumber: req.session.idNumber, 
            firstName: req.session.firstName, 
            lastName: req.session.lastName,
            middleName: req.session.middleName,
            role: req.session.role,
            profilePic: req.session.profilePic
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Serve main.html only if logged in

app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        if (req.session.role === 'admin') {
            return res.redirect('/admin');
        } else {
            return res.redirect('/homepage');
        }
    }
    res.redirect('/login');
});

// Serve static landing page
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login and register pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/homepage', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'homepage.html'));
});

app.get('/reservation', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'reservation.html'));
});

app.get('/admin', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-register.html'));
});

// Student API: Fetch Sit-in History
app.get('/api/student/history', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;
    db.all(`
        SELECT * FROM student_history 
        WHERE idNumber = ? 
        ORDER BY logoutTime DESC
    `, [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Student API: Fetch Sit-in Summary
app.get('/api/student/summary', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;
    
    db.all('SELECT loginTime, logoutTime FROM student_history WHERE idNumber = ?', [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        let totalMinutes = 0;
        let longestMinutes = 0;
        let sessionCount = rows.length;
        
        rows.forEach(row => {
            const login = new Date(row.loginTime);
            const logout = new Date(row.logoutTime);
            const duration = Math.max(0, (logout - login) / 60000); // Duration in minutes
            
            totalMinutes += duration;
            if (duration > longestMinutes) {
                longestMinutes = duration;
            }
        });
        
        const avgMinutes = sessionCount > 0 ? totalMinutes / sessionCount : 0;
        
        res.json({
            totalHours: (totalMinutes / 60).toFixed(1),
            sessionCount: sessionCount,
            avgDuration: Math.round(avgMinutes),
            longestSession: Math.round(longestMinutes)
        });
    });
});

// System Settings API
app.get('/api/settings/reservations-status', (req, res) => {
    db.get("SELECT value FROM system_settings WHERE key = 'reservationsEnabled'", [], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ enabled: row ? row.value === 'true' : true });
    });
});

app.get('/api/admin/settings', checkAdminAuth, (req, res) => {
    db.all("SELECT * FROM system_settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        const settings = {};
        rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    });
});

app.post('/api/admin/settings', checkAdminAuth, (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)", [key, String(value)], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update setting' });
        res.json({ success: true });
    });
});

app.get('/student-history', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'student-history.html'));
});

app.get('/sessions', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'sessions.html'));
});

app.get('/students', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/students.html'));
});

app.get('/sit-in', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/sit-in.html'));
});

app.get('/sit-in-records', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/sit-in-records.html'));
});

app.get('/sit-in-reports', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/sit-in-reports.html'));
});

app.get('/feedback-reports', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/feedback-reports.html'));
});

app.get('/reservations', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/reservations.html'));
});

app.get('/edit-profile', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'edit-profile.html'));
});

// ─── Leaderboard & Analytics Routes ───────────────────────────────

app.get('/leaderboard', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'leaderboard.html'));
});

app.get('/lab-rules', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'lab-rules.html'));
});

app.get('/ai-recommendations', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'ai-recommendations.html'));
});

app.get('/admin/leaderboard', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/leaderboard.html'));
});

app.get('/admin/manage-dropdowns', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/manage-dropdowns.html'));
});

app.get('/admin/analytics', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-pages/analytics.html'));
});

// ─── Dropdown Options API ──────────────────────────────────────────

// Public: Fetch all active dropdown options (used by all pages)
app.get('/api/dropdown-options', (req, res) => {
    db.all('SELECT * FROM dropdown_options WHERE is_active = 1 ORDER BY category, sort_order, value', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        // Group by category
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push(r);
        });
        res.json(grouped);
    });
});

// Public: Fetch active options by category
app.get('/api/dropdown-options/:category', (req, res) => {
    const { category } = req.params;
    db.all('SELECT * FROM dropdown_options WHERE category = ? AND is_active = 1 ORDER BY sort_order, value', [category], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin: Fetch ALL options (including inactive) for management
app.get('/api/admin/dropdown-options', checkAdminAuth, (req, res) => {
    db.all('SELECT * FROM dropdown_options ORDER BY category, sort_order, value', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.category]) grouped[r.category] = [];
            grouped[r.category].push(r);
        });
        res.json(grouped);
    });
});

// Admin: Add new dropdown option
app.post('/api/admin/dropdown-options', checkAdminAuth, (req, res) => {
    const { category, value } = req.body;
    if (!category || !value) return res.status(400).json({ error: 'Category and value are required' });
    
    // Check for duplicate
    db.get('SELECT id FROM dropdown_options WHERE category = ? AND value = ?', [category, value], (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (existing) return res.status(400).json({ error: 'This option already exists' });
        
        // Get max sort_order for the category
        db.get('SELECT MAX(sort_order) as maxOrder FROM dropdown_options WHERE category = ?', [category], (err, row) => {
            const nextOrder = (row && row.maxOrder ? row.maxOrder : 0) + 1;
            db.run('INSERT INTO dropdown_options (category, value, sort_order) VALUES (?, ?, ?)', [category, value, nextOrder], function(err) {
                if (err) return res.status(500).json({ error: 'Failed to add option' });
                res.json({ success: true, id: this.lastID, message: 'Option added successfully' });
            });
        });
    });
});

// Admin: Update dropdown option
app.put('/api/admin/dropdown-options/:id', checkAdminAuth, (req, res) => {
    const { id } = req.params;
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: 'Value is required' });
    
    db.run('UPDATE dropdown_options SET value = ? WHERE id = ?', [value, id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update option' });
        if (this.changes === 0) return res.status(404).json({ error: 'Option not found' });
        res.json({ success: true, message: 'Option updated successfully' });
    });
});

// Admin: Delete dropdown option
app.delete('/api/admin/dropdown-options/:id', checkAdminAuth, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM dropdown_options WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete option' });
        if (this.changes === 0) return res.status(404).json({ error: 'Option not found' });
        res.json({ success: true, message: 'Option deleted successfully' });
    });
});

// Admin: Toggle active/inactive
app.put('/api/admin/dropdown-options/:id/toggle', checkAdminAuth, (req, res) => {
    const { id } = req.params;
    db.get('SELECT is_active FROM dropdown_options WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Option not found' });
        const newStatus = row.is_active === 1 ? 0 : 1;
        db.run('UPDATE dropdown_options SET is_active = ? WHERE id = ?', [newStatus, id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to toggle option' });
            res.json({ success: true, is_active: newStatus });
        });
    });
});

// ─── Lab Softwares API ─────────────────────────────────────────────

// Public: Fetch all software for a specific lab
app.get('/api/lab-softwares/:labId', (req, res) => {
    const { labId } = req.params;
    db.all('SELECT * FROM lab_softwares WHERE lab_id = ? ORDER BY software_name', [labId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin: Add software to a lab
app.post('/api/admin/lab-softwares', checkAdminAuth, (req, res) => {
    const { lab_id, software_name } = req.body;
    if (!lab_id || !software_name) return res.status(400).json({ error: 'Lab ID and Software Name are required' });

    db.run('INSERT INTO lab_softwares (lab_id, software_name) VALUES (?, ?)', [lab_id, software_name], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add software' });
        res.json({ success: true, id: this.lastID, message: 'Software added successfully' });
    });
});

// Admin: Delete software from a lab
app.delete('/api/admin/lab-softwares/:id', checkAdminAuth, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM lab_softwares WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete software' });
        if (this.changes === 0) return res.status(404).json({ error: 'Software not found' });
        res.json({ success: true, message: 'Software removed successfully' });
    });
});

// Leaderboard API: Calculate weighted scores
// Weight: Points 50%, Hours 30%, Tasks 20%
app.get('/api/leaderboard', checkAuth, (req, res) => {
    db.all(`
        SELECT
            u.idNumber,
            u.firstName || ' ' || u.lastName AS name,
            u.profilePic,
            u.points,
            COALESCE(h.totalHours, 0) AS totalHours,
            COALESCE(h.tasksCompleted, 0) AS tasksCompleted
        FROM users u
        LEFT JOIN (
            SELECT
                idNumber,
                COUNT(*) AS tasksCompleted,
                ROUND(SUM(
                    (julianday(logoutTime) - julianday(loginTime)) * 24
                ), 2) AS totalHours
            FROM student_history
            GROUP BY idNumber
        ) h ON u.idNumber = h.idNumber
        ORDER BY u.points DESC
    `, [], (err, rows) => {
        if (err) {
            console.error('Leaderboard error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Find max values for normalization
        const maxPoints = Math.max(...rows.map(r => r.points || 0), 1);
        const maxHours = Math.max(...rows.map(r => r.totalHours || 0), 1);
        const maxTasks = Math.max(...rows.map(r => r.tasksCompleted || 0), 1);

        // Calculate weighted score and add rank
        const leaderboard = rows.map((r, index) => {
            const normPoints = (r.points || 0) / maxPoints;
            const normHours = (r.totalHours || 0) / maxHours;
            const normTasks = (r.tasksCompleted || 0) / maxTasks;
            const score = (normPoints * 0.5) + (normHours * 0.3) + (normTasks * 0.2);
            return {
                ...r,
                rank: index + 1,
                score: Math.round(score * 1000) / 10 // 0-100 scale with 1 decimal
            };
        }).sort((a, b) => b.score - a.score); // Re-sort by composite score

        // Re-assign ranks after score sort
        leaderboard.forEach((r, i) => r.rank = i + 1);

        res.json(leaderboard);
    });
});

// Student API: Get current user's leaderboard position
app.get('/api/leaderboard/me', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;
    db.all(`
        SELECT
            u.idNumber,
            u.firstName || ' ' || u.lastName AS name,
            u.profilePic,
            u.points,
            COALESCE(h.totalHours, 0) AS totalHours,
            COALESCE(h.tasksCompleted, 0) AS tasksCompleted
        FROM users u
        LEFT JOIN (
            SELECT
                idNumber,
                COUNT(*) AS tasksCompleted,
                ROUND(SUM(
                    (julianday(logoutTime) - julianday(loginTime)) * 24
                ), 2) AS totalHours
            FROM student_history
            GROUP BY idNumber
        ) h ON u.idNumber = h.idNumber
        ORDER BY u.points DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const maxPoints = Math.max(...rows.map(r => r.points || 0), 1);
        const maxHours = Math.max(...rows.map(r => r.totalHours || 0), 1);
        const maxTasks = Math.max(...rows.map(r => r.tasksCompleted || 0), 1);

        const leaderboard = rows.map((r) => {
            const normPoints = (r.points || 0) / maxPoints;
            const normHours = (r.totalHours || 0) / maxHours;
            const normTasks = (r.tasksCompleted || 0) / maxTasks;
            const score = (normPoints * 0.5) + (normHours * 0.3) + (normTasks * 0.2);
            return { ...r, score: Math.round(score * 1000) / 10 };
        }).sort((a, b) => b.score - a.score);

        const myIndex = leaderboard.findIndex(r => r.idNumber === idNumber);
        if (myIndex === -1) return res.status(404).json({ error: 'Student not found' });

        const me = leaderboard[myIndex];
        res.json({
            rank: myIndex + 1,
            totalStudents: leaderboard.length,
            name: me.name,
            points: me.points,
            totalHours: me.totalHours,
            tasksCompleted: me.tasksCompleted,
            score: me.score
        });
    });
});

// Most Visited Laboratory Analytics
app.get('/api/analytics/most-visited-lab', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT lab, COUNT(*) as visits
        FROM student_history
        GROUP BY lab
        ORDER BY visits DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin Analytics: Summary Stats
app.get('/api/admin/analytics/summary', checkAdminAuth, (req, res) => {
    const stats = {};
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        stats.totalStudents = row.count;
        db.get('SELECT COUNT(*) as count FROM sitin_records', (err, row) => {
            stats.totalSitIns = row.count;
            db.get('SELECT COUNT(*) as count FROM feedbacks', (err, row) => {
                stats.totalFeedbacks = row.count;
                db.get('SELECT COUNT(*) as count FROM reservations', (err, row) => {
                    stats.totalReservations = row.count;
                    res.json(stats);
                });
            });
        });
    });
});

// Admin Analytics: Usage by Lab (Dynamic)
app.get('/api/admin/analytics/usage-by-lab', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT lab as name, COUNT(*) as value
        FROM student_history
        GROUP BY lab
        ORDER BY value DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin Analytics: Usage by Purpose (Dynamic)
app.get('/api/admin/analytics/usage-by-purpose', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT purpose as name, COUNT(*) as value
        FROM student_history
        GROUP BY purpose
        ORDER BY value DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin Analytics: Daily Trends (Last 7 Days)
app.get('/api/admin/analytics/daily-trends', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT date as name, COUNT(*) as value
        FROM student_history
        WHERE date >= date('now', '-6 days')
        GROUP BY date
        ORDER BY date ASC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        // Generate the last 7 days array to ensure missing days show as 0
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            const row = rows.find(r => r.name === dateStr);
            last7Days.push({
                name: dateStr,
                value: row ? row.value : 0
            });
        }
        
        res.json(last7Days);
    });
});

// AI Recommendations API (rule-based) - Optimized using parallel queries
app.get('/api/ai-recommendations', checkAuth, async (req, res) => {
    const idNumber = req.session.idNumber;

    try {
        const [history, activeLabs, labRows, studentRow, nextRankRow] = await Promise.all([
            db.allAsync(`
                SELECT lab, purpose, COUNT(*) as frequency
                FROM student_history
                WHERE idNumber = ?
                GROUP BY lab, purpose
                ORDER BY frequency DESC
                LIMIT 5
            `, [idNumber]),
            db.allAsync(`
                SELECT lab, COUNT(*) as current_count
                FROM sitin_records
                WHERE status = 'Active'
                GROUP BY lab
            `),
            db.allAsync('SELECT value FROM dropdown_options WHERE category = ? AND is_active = 1 ORDER BY sort_order', ['lab']),
            db.getAsync('SELECT points FROM students WHERE idNumber = ?', [idNumber]),
            db.getAsync('SELECT points FROM students WHERE points > (SELECT points FROM students WHERE idNumber = ?) ORDER BY points ASC LIMIT 1')
        ]);

        const recommendations = [];
        const allLabs = labRows.length > 0 ? labRows.map(r => r.value) : ['Lab 524', 'Lab 530', 'Lab 536'];
        const defaultCapacity = 30;

        // Find least busy lab
        let leastBusy = allLabs[0];
        let minCount = Infinity;
        allLabs.forEach(lab => {
            const count = (activeLabs.find(a => a.lab === lab) || {}).current_count || 0;
            if (count < minCount) {
                minCount = count;
                leastBusy = lab;
            }
        });

        if (minCount < defaultCapacity) {
            recommendations.push({
                type: 'lab',
                title: `Try ${leastBusy}`,
                description: `This lab currently has ${minCount} active users out of ${defaultCapacity} capacity. Great availability right now!`,
                icon: 'fa-computer'
            });
        }

        // Suggest based on history
        if (history.length > 0) {
            const topPurpose = history[0];
            recommendations.push({
                type: 'purpose',
                title: `Continue ${topPurpose.purpose}`,
                description: `You've worked on "${topPurpose.purpose}" ${topPurpose.frequency} times. Keep up the momentum!`,
                icon: 'fa-code'
            });

            const topLab = history.reduce((acc, curr) => curr.frequency > acc.frequency ? curr : acc, history[0]);
            recommendations.push({
                type: 'lab_habit',
                title: `Your Favorite Lab`,
                description: `You most frequently use ${topLab.lab}. It's your optimal workspace!`,
                icon: 'fa-star'
            });
        } else {
            recommendations.push({
                type: 'welcome',
                title: 'Welcome!',
                description: 'Start using the labs to get personalized recommendations based on your usage patterns.',
                icon: 'fa-hand-sparkles'
            });
        }

        // Leaderboard Challenge Card
        const currentPoints = (studentRow || {}).points || 0;
        const targetPoints = (nextRankRow || {}).points || (currentPoints + 10);
        const pointsDiff = Math.max(10, targetPoints - currentPoints);

        recommendations.push({
            type: 'challenge',
            title: `Boost Your Rank!`,
            description: `You are only ${pointsDiff} points away from overtaking the next student in the standings! Attend a sit-in session today to claim your lead.`,
            icon: 'fa-trophy'
        });

        // Time-based recommendation
        const hour = new Date().getHours();
        let timeLabel = 'afternoon';
        if (hour < 12) timeLabel = 'morning';
        else if (hour >= 17) timeLabel = 'evening';

        recommendations.push({
            type: 'time',
            title: `Good ${timeLabel}!`,
            description: hour >= 8 && hour <= 17
                ? 'Lab hours are active. Perfect time for focused work!'
                : 'Labs may be closing soon. Consider an early session tomorrow!',
            icon: 'fa-clock'
        });

        res.json(recommendations);
    } catch (err) {
        console.error("Failed to fetch recommendations:", err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET AI Chat History
app.get('/api/ai/chat/history', checkAuth, async (req, res) => {
    const idNumber = req.session.idNumber;
    try {
        const rows = await db.allAsync(`
            SELECT role, content 
            FROM ai_chats 
            WHERE idNumber = ? 
            ORDER BY created_at ASC 
            LIMIT 50
        `, [idNumber]);
        res.json({ success: true, history: rows || [] });
    } catch (err) {
        console.error("Failed to load chat history:", err);
        res.status(500).json({ error: "Failed to load chat history" });
    }
});

// DELETE AI Chat History
app.delete('/api/ai/chat/history', checkAuth, async (req, res) => {
    const idNumber = req.session.idNumber;
    try {
        await db.runAsync(`DELETE FROM ai_chats WHERE idNumber = ?`, [idNumber]);
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to clear chat history:", err);
        res.status(500).json({ error: "Failed to clear chat history" });
    }
});

// AI Chatbot API (Groq AI powered with smart simulated fallback mode)
app.post('/api/ai/chat', checkAuth, async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages history is required' });
    }

    const idNumber = req.session.idNumber;
    const sessionBalance = req.session.sessions || 30;

    let activeLabs = [];
    let studentPoints = 0;
    let studentRank = 1;
    let leaderboard = [];
    let peakHours = [];

    try {
        const [activeLabsRows, pointsRow, rankRow, leaderboardRows, peakHoursRows] = await Promise.all([
            db.allAsync(`
                SELECT lab, COUNT(*) as current_count
                FROM sitin_records
                WHERE status = 'Active'
                GROUP BY lab
            `),
            db.getAsync('SELECT points FROM students WHERE idNumber = ?', [idNumber]),
            db.getAsync('SELECT COUNT(*) + 1 as rank FROM students WHERE points > (SELECT points FROM students WHERE idNumber = ?)', [idNumber]),
            db.allAsync('SELECT firstName, lastName, points FROM students ORDER BY points DESC LIMIT 3'),
            db.allAsync("SELECT strftime('%H', loginTime) as hour, COUNT(*) as count FROM student_history GROUP BY hour ORDER BY count DESC LIMIT 3")
        ]);

        activeLabs = activeLabsRows || [];
        studentPoints = (pointsRow || {}).points || 0;
        studentRank = (rankRow || {}).rank || 1;
        leaderboard = leaderboardRows || [];
        peakHours = peakHoursRows || [];
    } catch (err) {
        console.error("Failed to query dynamic DB context for AI:", err);
    }

    const count524 = (activeLabs.find(a => a.lab === 'Lab 524') || {}).current_count || 0;
    const count530 = (activeLabs.find(a => a.lab === 'Lab 530') || {}).current_count || 0;
    const count536 = (activeLabs.find(a => a.lab === 'Lab 536') || {}).current_count || 0;

    // Format top 3 leaderboard
    const leaderboardStr = leaderboard.map((s, i) => `${i + 1}. ${s.firstName} ${s.lastName} (${s.points} pts)`).join(', ');

    // Format peak hours
    const peakHoursStr = peakHours.map(p => `${p.hour}:00 (${p.count} historical check-ins)`).join(', ');

    const systemPrompt = `You are the CCS Sit-in AI Assistant, a friendly, intelligent, and highly knowledgeable virtual guide for the College of Computer Studies (CCS) Sit-in Monitoring System.
Your job is to assist computer science and IT students with queries about computer labs, schedules, rules, pre-installed software, and debugging programming questions.

Here is the exact truth and context about the CCS Laboratories:
1. Laboratories & Pre-installed Software:
   - Lab 524 (Advanced Systems & Programming Lab): Pre-installed with Visual Studio Code (v1.87.0), Visual Studio 2022 (v17.9.0), Node.js (v20.11.0), IntelliJ IDEA (v2023.3.4), Git (v2.43.0), and Notepad++ (v8.6.2).
   - Lab 530 (Introductory & C/C++ Lab): Pre-installed with Quincy 2005 (v1.3), Code::Blocks (v20.03), Python (v3.12.2), Visual Studio Code (v1.87.0), Notepad++ (v8.6.2), and Git (v2.43.0).
   - Lab 536 (Database Management & Systems Design Lab): Pre-installed with Microsoft SQL Server Management Studio (v19.3), MySQL Workbench (v8.0.36), Visual Studio Code (v1.87.0), XAMPP (v8.2.12), pgAdmin 4 (v8.3), Visual Studio 2022 (v17.9.0), and Notepad++ (v8.6.2).

2. CCS Laboratory Rules & Guidelines (Official Dashboard Rules):
   - Camaraderie & Decorum: Treat fellow students, instructors, and lab personnel with respect. Maintain proper decorum at all times and do not disrupt others.
   - Silence & Discipline: Maintain silence and discipline inside the lab. Keep conversations to a minimum and at a low volume. Mobile phones/devices must be switched off or set to silent mode.
   - Game Restrictions: Strictly NO games inside the laboratory (computer-related, card games, etc.). Entertainment/social media browsing should be limited to academic purposes only.
   - Internet Usage Policy: Surfing the Internet is allowed only with the permission of the instructor. Downloading and installing of software are strictly prohibited.
   - Equipment Care: Handle all computer equipment with care. Report malfunctioning units to the lab attendant immediately. Strictly NO food, drinks, or gum near the computers. Log off properly and push your chair in when leaving.
   - Security & Privacy: Do not share login credentials. Log out of all accounts before leaving the lab. Do not attempt to access restricted systems or networks.

3. Sit-in Sessions and Points Balance:
   - Every student starts with 30 sit-in sessions (1 session = 1 hour).
   - When a student checks out / logs out of their active sit-in, 1 session is decremented from their balance, and they are awarded +10 points.
   - The Leaderboard shows the top students ranked by their accumulated points.

4. REAL-TIME LABORATORY OCCUPANCY STATUS (LIVE DATABASE STATE):
   - Lab 524: ${count524} student(s) currently active / checked in.
   - Lab 530: ${count530} student(s) currently active / checked in.
   - Lab 536: ${count536} student(s) currently active / checked in.

5. CONVERSATIONAL LAB RESERVATIONS (AGENT BOOKING PROTOCOL):
   - You have the capability to schedule / request sit-in reservations directly for the student.
   - To register a reservation, you MUST collect exactly four slots:
     1. lab: Which lab they want to book (exactly 'Lab 524', 'Lab 530', or 'Lab 536').
     2. purpose: The reason for their sit-in (e.g. C Programming, Python Scripting, Java, etc.).
     3. date: The reservation date. Interpret dates like "May 20" or "tomorrow" and output strictly as YYYY-MM-DD (e.g. "2026-05-20").
     4. time: The reservation time. Convert times like "10:30 AM" or "2 PM" into 24-hour style HH:MM format (e.g. "10:30" or "14:00").
   - If a student requests a booking but any of these four details are missing, you MUST ask for the missing ones first.
   - ONCE AND ONLY ONCE ALL 4 SLOTS ARE GIVEN by the user:
     Confirm the details in your text reply and append EXACTLY this string on a new line at the very end of your response:
     [[RESERVE:{"lab":"Lab name","purpose":"Purpose","date":"YYYY-MM-DD","time":"HH:MM"}]]
     (Do not include any extra text inside the double brackets after the JSON string).

6. LIVE STUDENT STATISTICS & LEADERBOARD DATA:
   - Current Student Profile: Name is "${req.session.firstName} ${req.session.lastName}", ID Number is "${idNumber}".
   - Current Session Balance: ${sessionBalance} sit-in sessions remaining.
   - Current Accumulated Points: ${studentPoints} points.
   - Current Leaderboard Rank: Ranked #${studentRank} out of all students.
   - Overall Leaderboard Standings (Top 3): ${leaderboardStr || 'No data yet'}.
   - *Behavior*: If the student asks about their personal stats, points, sessions, rank, or the top students on the leaderboard, read these exact variables and answer accurately.

7. LABORATORY PEAK-HOURS ANALYSIS (HISTORICAL DATA):
   - Busiest Check-in Hours (Peak Hours): ${peakHoursStr || 'No data yet'}.
   - *Behavior*: If the student asks about the best/quietest times to study or which hours are peak/busy, tell them that according to our history logs, peak hours occur at ${peakHoursStr || '10:00 AM and 2:00 PM'}. Recommend that they plan their sessions in the early morning (8:00 AM - 9:30 AM) or late afternoon (4:00 PM - 5:30 PM) for optimal seating!

8. COURSE-TO-WORKSPACE MATCHER:
   - When a student asks what laboratory room is best for a specific subject, class, compiler, or database engine:
     * Suggest Lab 530 if they want to study introductory topics, C, C++, or Python scripting (since Quincy, Code::Blocks, and Python are pre-installed).
     * Suggest Lab 524 if they want to study advanced development, Java backend, web applications, or advanced systems (since IntelliJ, VS Code, Node.js, and Git are pre-installed).
     * Suggest Lab 536 if they want to study databases, SQL queries, servers, or systems design (since MSSQL Server, MySQL Workbench, pgAdmin 4, and XAMPP are pre-installed).

Always respond in a helpful, encouraging, and tech-savvy tone. Use formatting like bullet points and bold titles when describing software or rules. Keep answers relatively concise and easy to read.`;

    const groqKey = process.env.GROQ_API_KEY;

    if (groqKey && groqKey.trim() !== '') {
        try {
            // Forward conversation history to Groq API
            const groqMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content }))
            ];

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: groqMessages,
                    temperature: 0.7,
                    max_tokens: 800
                })
            });

            if (response.ok) {
                const data = await response.json();
                const reply = data.choices?.[0]?.message?.content || "I couldn't process that response. Please try again.";
                
                // Save user message and reply to database asynchronously
                db.run('INSERT INTO ai_chats (idNumber, role, content) VALUES (?, ?, ?)', [req.session.idNumber, 'user', messages[messages.length - 1]?.content || '']);
                db.run('INSERT INTO ai_chats (idNumber, role, content) VALUES (?, ?, ?)', [req.session.idNumber, 'assistant', reply]);
                
                return res.json({ success: true, reply });
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error("Groq API error response status:", response.status, errData);
                const errMsg = errData.error?.message || `Groq API responded with status ${response.status}`;
                return res.json({ 
                    success: true, 
                    reply: `⚠️ **Groq API Error (${response.status}):** ${errMsg}\n\n*(Please check your Groq API Key and account settings on console.groq.com)*` 
                });
            }
        } catch (err) {
            console.error("Failed to query Groq AI:", err);
            return res.json({ 
                success: true, 
                reply: `⚠️ **Connection Error:** Failed to connect to Groq AI servers: ${err.message}` 
            });
        }
    }

    // Smart simulated fallback mode (runs if GROQ_API_KEY is missing or if connection fails)
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    let reply = "";

    const simulatedNote = "\n\n*(💡 Running in CCS Local AI Mode. Connect a Groq API Key to enable the high-speed Llama 3 cloud module!)*";

    if (lastUserMsg.includes('reserve') || lastUserMsg.includes('reservation') || lastUserMsg.includes('book')) {
        // Simple slot parsing from user message history
        let parsedLab = "";
        let parsedPurpose = "";
        let parsedDate = "";
        let parsedTime = "";

        // Look through recent messages to accumulate slots
        for (const msg of messages) {
            const txt = msg.content.toLowerCase();
            if (txt.includes('524')) parsedLab = "Lab 524";
            else if (txt.includes('530')) parsedLab = "Lab 530";
            else if (txt.includes('536')) parsedLab = "Lab 536";

            if (txt.includes('c programming') || txt.includes('c language')) parsedPurpose = "C Programming";
            else if (txt.includes('java')) parsedPurpose = "Java Programming";
            else if (txt.includes('python')) parsedPurpose = "Python Programming";
            else if (txt.includes('asp.net') || txt.includes('web')) parsedPurpose = "ASP.NET Web Development";
            else if (txt.includes('sql') || txt.includes('database')) parsedPurpose = "Database Research";

            // Extract date: looking for YYYY-MM-DD or Month DD (like "may 20")
            const dateMatch = txt.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                parsedDate = dateMatch[1];
            } else {
                const monthDayMatch = txt.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}/);
                if (monthDayMatch) {
                    const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
                    const words = monthDayMatch[0].split(' ');
                    const m = months[words[0].substring(0, 3)];
                    const d = words[1].padStart(2, '0');
                    parsedDate = `2026-${m}-${d}`;
                }
            }

            // Extract time: looking for HH:MM or HH:MM am/pm
            const timeMatch = txt.match(/(\d{1,2}:\d{2})/);
            if (timeMatch) {
                parsedTime = timeMatch[1].padStart(5, '0');
            }
        }

        // Check which slots are missing
        const missing = [];
        if (!parsedLab) missing.push("Laboratory (Lab 524, 530, or 536)");
        if (!parsedPurpose) missing.push("Sit-in Purpose (e.g. C Programming, Java)");
        if (!parsedDate) missing.push("Date (e.g. May 20 or YYYY-MM-DD)");
        if (!parsedTime) missing.push("Time (e.g. 10:30 AM or 10:30)");

        if (missing.length > 0) {
            reply = `### 📅 Conversational Sit-in Reservation
I'd be glad to help you book a sit-in reservation! However, I still need a few more details to schedule it:
${missing.map(m => `* **${m}**`).join('\n')}

Could you please provide these remaining details in your next message?`;
        } else {
            reply = `### 📅 Reservation Request Prepared!
Perfect! I have collected all the required details for your laboratory reservation:
* **Laboratory:** ${parsedLab}
* **Purpose:** ${parsedPurpose}
* **Date:** ${parsedDate}
* **Time:** ${parsedTime}

I am submitting this reservation request to the administration for you right now!
\n\n[[RESERVE:{"lab":"${parsedLab}","purpose":"${parsedPurpose}","date":"${parsedDate}","time":"${parsedTime}"}]]`;
        }
    } else if (lastUserMsg.includes('available') || lastUserMsg.includes('active') || lastUserMsg.includes('occupancy') || lastUserMsg.includes('busy') || lastUserMsg.includes('session')) {
        reply = `### 🖥️ Real-time Laboratory Occupancy
According to the live database, here is the current number of active students checked in:
* **Lab 524 (Advanced Systems & Programming):** ${count524} active student(s) checked in
* **Lab 530 (Introductory & C/C++):** ${count530} active student(s) checked in
* **Lab 536 (Database Management & Systems):** ${count536} active student(s) checked in

${(count524 === 0 && count530 === 0 && count536 === 0) 
  ? "All computer laboratories are currently **100% empty and available**! Feel free to start a sit-in session!" 
  : "Some computer laboratories are currently active. Check the sit-in system for reservation availability."}`;
    } else if (lastUserMsg.includes('rules') || lastUserMsg.includes('guideline') || lastUserMsg.includes('dress') || lastUserMsg.includes('uniform') || lastUserMsg.includes('food')) {
        reply = `### 📜 CCS Official Laboratory Rules & Guidelines
Here are the official rules from the student dashboard:
* **Camaraderie & Decorum:** Treat fellow students, instructors, and lab personnel with respect. Maintain proper decorum at all times and do not disrupt others.
* **Silence & Discipline:** Maintain silence and discipline. Keep conversations to a minimum and at low volume. Mobile devices must be switched off or set to silent mode.
* **Game Restrictions:** Strictly NO games inside the laboratory (computer-related, card games, etc.). Entertainment/social media browsing is prohibited.
* **Internet Usage Policy:** Surfing the Internet is allowed only with the permission of the instructor. Downloading and installing of software are strictly prohibited.
* **Equipment Care:** Handle all computer equipment with care. Strictly NO food, drinks, or gum near the computers. Log off properly and push in your chair when leaving.
* **Security & Privacy:** Do not share login credentials. Log out of all accounts before leaving the lab. Do not attempt to access restricted systems or networks.`;
    } else if (lastUserMsg.includes('524')) {
        reply = `### 🖥️ Lab 524 (Advanced Systems & Programming Lab)
Lab 524 is optimized for advanced development and programming workflows. Here is the software currently installed:
* **Code Editors & IDEs:** Visual Studio Code (v1.87.0), Visual Studio 2022 (v17.9.0), IntelliJ IDEA (v2023.3.4), Notepad++ (v8.6.2)
* **Runtimes & Tools:** Node.js (v20.11.0), Git (v2.43.0)
* **Ideal Use Cases:** Web application coding, Java/C# backend development, systems programming.`;
    } else if (lastUserMsg.includes('530')) {
        reply = `### 🖥️ Lab 530 (Introductory & C/C++ Lab)
Lab 530 is tailored for students learning computer science foundations and initial programming languages:
* **IDE & Editors:** Quincy 2005 (v1.3), Code::Blocks (v20.03), Visual Studio Code (v1.87.0), Notepad++ (v8.6.2)
* **Languages & Version Control:** Python (v3.12.2), Git (v2.43.0)
* **Ideal Use Cases:** Learning C/C++ concepts, scripting in Python, introductory algorithms.`;
    } else if (lastUserMsg.includes('536')) {
        reply = `### 🖥️ Lab 536 (Database Management & Systems Design Lab)
Lab 536 is our dedicated laboratory for databases, design frameworks, and servers:
* **Database Management:** Microsoft SQL Server Management Studio (v19.3), MySQL Workbench (v8.0.36), pgAdmin 4 (v8.3)
* **Servers & Runtimes:** XAMPP Server (v8.2.12), Visual Studio 2022, VS Code
* **Ideal Use Cases:** Structuring SQL databases, hosting local servers, systems integration testing.`;
    } else if (lastUserMsg.includes('points') || lastUserMsg.includes('rank') || lastUserMsg.includes('leaderboard') || lastUserMsg.includes('standing') || lastUserMsg.includes('score') || lastUserMsg.includes('top')) {
        reply = `### 🏆 Your Live Student Statistics & Standing
Here are your active session details retrieved straight from the CCS Sit-in database:
* **Student Name:** ${req.session.firstName} ${req.session.lastName} (ID: ${idNumber})
* **Remaining Sessions:** **${sessionBalance}** hours left
* **Accumulated Points:** **${studentPoints}** points
* **Leaderboard Standing:** Ranked **#${studentRank}** out of all students

#### 🥇 Leaderboard Top 3 Standings:
${leaderboard.length > 0 ? leaderboard.map((s, i) => `* **#${i + 1}** ${s.firstName} ${s.lastName} — **${s.points}** points`).join('\n') : "* No standings recorded yet."}`;
    } else if (lastUserMsg.includes('busy') || lastUserMsg.includes('peak') || lastUserMsg.includes('best time') || lastUserMsg.includes('traffic') || lastUserMsg.includes('quiet') || lastUserMsg.includes('optimal') || lastUserMsg.includes('time')) {
        reply = `### 📊 AI Peak-Hours & Lab Optimizer (Big Data Analysis)
Based on our database of historical check-in logs, here are the busiest laboratory check-in periods:
${peakHours.length > 0 ? peakHours.map(p => `* **${p.hour}:00** — ${p.count} historical check-ins`).join('\n') : "* No historical logins recorded yet."}

#### 💡 My Optimal Recommendation:
* **Busiest Hours:** The laboratories experience heavy student check-ins around **${peakHours.length > 0 ? peakHours[0].hour + ":00" : "10:00 AM - 12:00 PM"}**.
* **Quiet Study Windows:** I highly recommend booking your sessions during **early morning hours (8:00 AM - 9:30 AM)** or **late afternoons (4:00 PM - 5:30 PM)** when computer availability is at its highest!`;
    } else if (lastUserMsg.includes('sql') || lastUserMsg.includes('database') || lastUserMsg.includes('query') || lastUserMsg.includes('mysql') || lastUserMsg.includes('c++') || lastUserMsg.includes('quincy') || lastUserMsg.includes('code::blocks') || lastUserMsg.includes('java') || lastUserMsg.includes('node') || lastUserMsg.includes('intellij') || lastUserMsg.includes('web') || lastUserMsg.includes('python') || lastUserMsg.includes('subject') || lastUserMsg.includes('class') || lastUserMsg.includes('compiler')) {
        let bestLab = "";
        let matchReason = "";
        if (lastUserMsg.includes('sql') || lastUserMsg.includes('database') || lastUserMsg.includes('query') || lastUserMsg.includes('mysql') || lastUserMsg.includes('xampp')) {
            bestLab = "Lab 536 (Database Management Lab)";
            matchReason = "It is pre-installed with Microsoft SQL Server, MySQL Workbench, pgAdmin 4, and XAMPP Server.";
        } else if (lastUserMsg.includes('java') || lastUserMsg.includes('node') || lastUserMsg.includes('web') || lastUserMsg.includes('intellij')) {
            bestLab = "Lab 524 (Advanced Systems & Programming Lab)";
            matchReason = "It is pre-installed with IntelliJ IDEA, Node.js, Git, VS Code, and Visual Studio 2022.";
        } else {
            bestLab = "Lab 530 (Introductory & C/C++ Lab)";
            matchReason = "It is pre-installed with Quincy 2005, Code::Blocks, Python 3, and Git, which are ideal for introductory classes.";
        }
        reply = `### 🛠️ AI Course-to-Workspace Matcher
Based on your subject query, here is the optimal computer laboratory room:
* **Recommended Room:** **${bestLab}**
* **Reason:** ${matchReason}

You can make a reservation in this lab directly by telling me: *"Can you reserve a slot in ${bestLab.substring(0,7)}?"*`;
    } else if (lastUserMsg.includes('hi') || lastUserMsg.includes('hello') || lastUserMsg.includes('hey') || lastUserMsg.includes('start')) {
        reply = `Hello! I am your **CCS Sit-in AI Assistant**! 👋
I can help you answer any questions about our laboratory rooms, pre-installed software, sit-in rules, sessions, or programming syntax.

**Try asking me:**
* "What tools are installed in Lab 536?"
* "What are the computer lab rules?"
* "How do I earn points and manage my sessions?"
* "Which lab is best for coding in Java?"`;
    } else {
        reply = `I understand you're asking about the College of Computer Studies (CCS). As your CCS Lab Assistant, I can confirm that our computer labs (**Lab 524, Lab 530, and Lab 536**) are fully equipped with compilers, databases, and IDEs to support your sit-in sessions!

Please feel free to ask about specific labs, installed software (like VS Code, Quincy, MSSQL, or Python), lab rules, or sit-in session balance metrics!`;
    }

    const finalReply = reply + simulatedNote;
    db.run('INSERT INTO ai_chats (idNumber, role, content) VALUES (?, ?, ?)', [req.session.idNumber, 'user', messages[messages.length - 1]?.content || '']);
    db.run('INSERT INTO ai_chats (idNumber, role, content) VALUES (?, ?, ?)', [req.session.idNumber, 'assistant', finalReply]);

    res.json({ success: true, reply: finalReply });
});

// Award points on feedback submission (5 bonus points)
app.post('/api/student/feedback', checkAuth, (req, res) => {
    const { historyId, rating, comments } = req.body;
    const idNumber = req.session.idNumber;

    if (!historyId || !rating || !comments) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.get('SELECT * FROM student_history WHERE id = ? AND idNumber = ?', [historyId, idNumber], (err, record) => {
        if (err || !record) return res.status(404).json({ error: 'Record not found' });
        if (record.feedbackStatus === 'Completed') return res.status(400).json({ error: 'Feedback already submitted' });

        db.run('UPDATE student_history SET feedbackStatus = ? WHERE id = ?', ['Completed', historyId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to submit feedback' });

            // Save actual feedback data
            db.run(
                'INSERT INTO feedbacks (historyId, idNumber, studentName, lab, purpose, rating, comments) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [historyId, idNumber, record.studentName, record.lab, record.purpose, rating, comments],
                (err) => {
                    if (err) console.error('Failed to save feedback:', err);
                }
            );

            // Award 5 bonus points for feedback
            db.run('UPDATE users SET points = points + 5 WHERE idNumber = ?', [idNumber], (err) => {
                if (err) console.error('Failed to award feedback points:', err);
            });

            res.json({ success: true, message: 'Feedback submitted successfully (+5 points!)' });
        });
    });
});

// Admin API: Fetch all feedbacks
app.get('/api/admin/feedbacks', checkAdminAuth, (req, res) => {
    db.all(`
        SELECT f.*, h.date, h.loginTime, h.logoutTime
        FROM feedbacks f
        LEFT JOIN student_history h ON f.historyId = h.id
        ORDER BY f.created_at DESC
    `, [], (err, rows) => {
        if (err) {
            console.error('Error fetching feedbacks:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Ensure profilePic column exists (Migration)
function ensureProfilePicColumn() {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'profilePic')) {
            db.run("ALTER TABLE users ADD COLUMN profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky'");
        }
    });
    db.all("PRAGMA table_info(admins)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'profilePic')) {
            db.run("ALTER TABLE admins ADD COLUMN profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'");
        }
    });
}

// Ensure sessionLeft column exists (Migration)
function ensureSessionLeftColumn() {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'sessionLeft')) {
            db.run("ALTER TABLE users ADD COLUMN sessionLeft INTEGER DEFAULT 30", (err) => {
                if (!err) {
                    console.log('Added sessionLeft column to users table');
                    db.run('UPDATE users SET sessionLeft = 30 WHERE sessionLeft IS NULL');
                }
            });
        }
    });
}

// Ensure pcNumber column exists (Migration)
function ensurePcNumberColumn() {
    db.all("PRAGMA table_info(sitin_records)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'pcNumber')) {
            db.run("ALTER TABLE sitin_records ADD COLUMN pcNumber TEXT DEFAULT 'N/A'");
        }
    });
    db.all("PRAGMA table_info(student_history)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'pcNumber')) {
            db.run("ALTER TABLE student_history ADD COLUMN pcNumber TEXT DEFAULT 'N/A'");
        }
    });
}

// Ensure points column exists (Migration)
function ensurePointsColumn() {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'points')) {
            db.run("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0", (err) => {
                if (!err) console.log('Added points column to users table');
            });
        }
    });
}

function ensureMiddleNameColumn() {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'middleName')) {
            db.run("ALTER TABLE users ADD COLUMN middleName TEXT", (err) => {
                if (!err) console.log('Added middleName column to users table');
            });
        }
    });
    db.all("PRAGMA table_info(admins)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'middleName')) {
            db.run("ALTER TABLE admins ADD COLUMN middleName TEXT", (err) => {
                if (!err) console.log('Added middleName column to admins table');
            });
        }
    });
}

function renameAnnouncementsTable() {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Annoucements'", (err, oldRow) => {
        if (oldRow) {
            db.get("SELECT COUNT(*) as count FROM Announcements", (err, newRow) => {
                if (!err && newRow && newRow.count === 0) {
                    db.run("DROP TABLE Announcements", () => {
                        db.run("ALTER TABLE Annoucements RENAME TO Announcements", (err) => {
                            if (!err) console.log('Renamed Annoucements table to Announcements');
                            else console.error('Failed to rename Annoucements:', err);
                        });
                    });
                } else if (!err && newRow && newRow.count > 0) {
                    console.log('Announcements table already has data, skipping rename');
                }
            });
        }
    });
}

function ensureAnnouncementHiddenColumn() {
    db.all("PRAGMA table_info(Announcements)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'isHidden')) {
            db.run("ALTER TABLE Announcements ADD COLUMN isHidden INTEGER DEFAULT 0", (err) => {
                if (!err) {
                    console.log('Added isHidden column to Announcements table');
                    db.run("UPDATE Announcements SET isHidden = 0 WHERE isHidden IS NULL");
                }
            });
        }
    });
}

// Seed dummy announcement if empty
function seedAnnouncements() {
    db.get('SELECT COUNT(*) as count FROM Announcements', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run('INSERT INTO Announcements (title, description) VALUES (?, ?)', ['Welcome!', 'Welcome to the CCS Sit-In Monitoring System.']);
        }
    });
}

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

module.exports = app;



