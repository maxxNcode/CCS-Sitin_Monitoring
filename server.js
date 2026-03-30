const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { error } = require('console');

const app = express();
const PORT = 3000;

// Initialize Database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

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
            profilePic TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table ready');
        }
    });
}

function createTableAnnouncements() {
    db.run(`
        CREATE TABLE IF NOT EXISTS Annoucements (
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

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Serve Static
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer generic upload config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

app.use('/uploads', express.static(uploadsDir));

// Session configuration
app.use(session({
    secret: 'ccs-sitin-monitoring-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
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
app.post('/api/announcements', (req, res) => {
    const { title, description } = req.body;


    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
    }

    const query = `INSERT INTO Annoucements (title, description) VALUES (?, ?)`

    db.run(query, [title, description],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Failed to create announcement' })
            }
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
        if (err) return res.status(500).json({ error: 'Server error' });

        if (admin) {
            bcrypt.compare(password, admin.password, (err, isMatch) => {
                if (err) return res.status(500).json({ error: 'Server error' });
                if (!isMatch) return res.status(401).json({ error: 'Invalid ID Number or Password' });

                req.session.userId = admin.id;
                req.session.idNumber = admin.idNumber;
                req.session.firstName = admin.firstName;
                req.session.lastName = admin.lastName;
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
                if (err) return res.status(500).json({ error: 'Server error' });

                if (!user) {
                    return res.status(401).json({ error: 'Invalid ID Number or Password' });
                }

                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) return res.status(500).json({ error: 'Server error' });
                    if (!isMatch) return res.status(401).json({ error: 'Invalid ID Number or Password' });

                    req.session.userId = user.id;
                    req.session.idNumber = user.idNumber;
                    req.session.firstName = user.firstName;
                    req.session.lastName = user.lastName;
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
    db.all('SELECT title, description, created_at FROM Annoucements ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error' });
        }
        res.json(rows);
    });
});

// Generic User Info API - Fetch current user (student or admin)
app.get('/api/studentinfo', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const userId = req.session.userId;
    const role = req.session.role;
    const table = role === 'admin' ? 'admins' : 'users';

    db.get(`
        SELECT firstName || ' ' || lastName AS name, email, profilePic, 
        ${role === 'student' ? 'course, courseLevel, address' : '"" as course, "" as courseLevel, "" as address'}
        FROM ${table}
        WHERE id = ?
    `, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
    });
});

// Update Profile API
app.post('/api/update-profile', upload.single('profileImage'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { firstName, lastName, middleName, email, profilePic, course, courseLevel, address } = req.body;
    const userId = req.session.userId;
    const role = req.session.role;

    let finalProfilePic = profilePic;
    if (req.file) {
        finalProfilePic = '/uploads/' + req.file.filename;
    }

    if (role === 'admin') {
        db.run(`UPDATE admins SET firstName = ?, lastName = ?, middleName = ?, email = ?, profilePic = ? WHERE id = ?`,
            [firstName, lastName, middleName, email, finalProfilePic, userId], function(err) {
                if (err) return res.status(500).json({ error: 'Update failed' });
                req.session.firstName = firstName;
                req.session.lastName = lastName;
                res.json({ success: true, profilePic: finalProfilePic });
            });
    } else {
        db.run(`UPDATE users SET firstName = ?, lastName = ?, middleName = ?, email = ?, course = ?, courseLevel = ?, address = ?, profilePic = ? WHERE id = ?`,
            [firstName, lastName, middleName, email, course, courseLevel, address, finalProfilePic, userId], function(err) {
                if (err) return res.status(500).json({ error: 'Update failed' });
                req.session.firstName = firstName;
                req.session.lastName = lastName;
                res.json({ success: true, profilePic: finalProfilePic });
            });
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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 40)`,
            [idNumber, email, hashedPassword, firstName, lastName, middleName, courseLevel, course, address],
            (err) => {
                if (err) {
                    console.error('Registration DB error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'ID Number or Email already exists' });
                    }
                    return res.status(500).json({ error: 'Server error' });
                }

                res.json({ success: true, message: 'Registration successful', redirectUrl: '/login.html' });
            }
        );
    });
});

// Admin API: Search Student by ID
app.get('/api/admin/search-student/:idNumber', (req, res) => {
    const idNumber = req.params.idNumber;
    db.get('SELECT firstName || " " || lastName as name, sessionLeft FROM users WHERE idNumber = ?', [idNumber], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
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

        // Only insert the record — do NOT decrement sessionLeft yet
        db.run(`INSERT INTO sitin_records (studentName, idNumber, purpose, lab, session, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [studentName, idNumber, purpose, lab, user.sessionLeft.toString(), 'Active'],
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
app.post('/api/admin/sit-in/logout/:id', (req, res) => {
    const recordId = req.params.id;

    db.get('SELECT * FROM sitin_records WHERE id = ?', [recordId], (err, record) => {
        if (err || !record) return res.status(404).json({ error: 'Record not found' });
        if (record.status !== 'Active') return res.status(400).json({ error: 'Session already ended' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Set status to Inactive
            db.run('UPDATE sitin_records SET status = ? WHERE id = ?', ['Inactive', recordId]);

            // Decrement sessionLeft on logout
            db.run('UPDATE users SET sessionLeft = sessionLeft - 1 WHERE idNumber = ?', [record.idNumber]);

            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: 'Failed to end session' });
                res.json({ success: true, message: 'Session ended successfully' });
            });
        });
    });
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
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully', redirectUrl: '/login.html' });
    });
});

// Check session route
app.get('/check-session', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            idNumber: req.session.idNumber, 
            firstName: req.session.firstName, 
            lastName: req.session.lastName,
            role: req.session.role 
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// Serve main.html only if logged in

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

app.get('/admin', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-register', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-register.html'));
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


createTableAnnouncements();
createTableSitInRecords();
createTableAdmins();

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
ensureProfilePicColumn();

// Ensure sessionLeft column exists (Migration)
function ensureSessionLeftColumn() {
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (!err && !columns.some(c => c.name === 'sessionLeft')) {
            db.run("ALTER TABLE users ADD COLUMN sessionLeft INTEGER DEFAULT 40", (err) => {
                if (!err) {
                    console.log('Added sessionLeft column to users table');
                    db.run('UPDATE users SET sessionLeft = 40 WHERE sessionLeft IS NULL');
                }
            });
        } else {
            // Column exists, just fix any NULLs
            db.run('UPDATE users SET sessionLeft = 40 WHERE sessionLeft IS NULL', (err) => {
                if (!err) console.log('Ensured all students have sessionLeft set');
            });
        }
    });
}
ensureSessionLeftColumn();


// Seed dummy announcement if empty
db.get('SELECT COUNT(*) as count FROM Annoucements', (err, row) => {
    if (!err && row.count === 0) {
        db.run('INSERT INTO Annoucements (title, description) VALUES (?, ?)', ['Welcome!', 'Welcome to the CCS Sit-In Monitoring System.']);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});



