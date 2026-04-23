const express = require('express');
const http = require('http');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
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
                    io.emit('notification:student', { message: notifMsg, type: 'info' });
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
        if (err) return res.status(500).json({ error: 'Server error' });

        if (admin) {
            bcrypt.compare(password, admin.password, (err, isMatch) => {
                if (err) return res.status(500).json({ error: 'Server error' });
                if (!isMatch) return res.status(401).json({ error: 'Invalid ID Number or Password' });

                req.session.userId = admin.id;
                req.session.idNumber = admin.idNumber;
                req.session.firstName = admin.firstName;
                req.session.lastName = admin.lastName;
                req.session.middleName = admin.middleName;
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
                    req.session.middleName = user.middleName;
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

                // Notify admin that a student updated their profile
                const adminMsg = `${firstName} ${lastName} (${req.session.idNumber}) has updated their profile.`;
                db.run('INSERT INTO notifications (idNumber, message, type) VALUES (?, ?, ?)',
                    ['ADMIN', adminMsg, 'info']);
                io.emit('notification:admin', { message: adminMsg, type: 'info' });

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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 30)`,
            [idNumber, email, hashedPassword, firstName, lastName, middleName, courseLevel, course, address],
            (err) => {
                if (err) {
                    console.error('Registration DB error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'ID Number or Email already exists' });
                    }
                    return res.status(500).json({ error: 'Server error' });
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

            // Decrement sessionLeft on logout and award points
            db.run('UPDATE users SET sessionLeft = sessionLeft - 1, points = points + 10 WHERE idNumber = ?', [record.idNumber]);

            // Add record to student_history table
            const loginTime = record.created_at;
            const logoutTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
            const date = logoutTime.split(' ')[0]; // Extract YYYY-MM-DD
            db.run(
                'INSERT INTO student_history (studentName, idNumber, purpose, lab, loginTime, logoutTime, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [record.studentName, record.idNumber, record.purpose, record.lab, loginTime, logoutTime, date]
            );

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

// Student API: Fetch Reservations
app.get('/api/student/reservations', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;
    db.all(`SELECT * FROM reservations WHERE idNumber = ? ORDER BY created_at DESC`, [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
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
app.post('/api/admin/reservations/check-in', checkAdminAuth, (req, res) => {
    const { id } = req.body;

    if (!id) return res.status(400).json({ error: 'Reservation ID is required' });

    db.get('SELECT * FROM reservations WHERE id = ?', [id], (err, reservation) => {
        if (err || !reservation) return res.status(404).json({ error: 'Reservation not found' });
        if (reservation.status !== 'Approved') return res.status(400).json({ error: 'Only approved reservations can be checked in' });

        db.get('SELECT sessionLeft FROM users WHERE idNumber = ?', [reservation.idNumber], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'Student not found' });
            if (user.sessionLeft <= 0) return res.status(400).json({ error: 'Student has no sessions remaining' });

            // Ensure check-in is not before reservation time
            const now = new Date();
            const resDateTime = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
            if (resDateTime > now) {
                return res.status(400).json({ 
                    error: `Check-in is not yet allowed. Scheduled for ${reservation.reservationDate} at ${reservation.reservationTime}` 
                });
            }

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 1. Create active sit-in record
                db.run(`INSERT INTO sitin_records (studentName, idNumber, purpose, lab, session, status) VALUES (?, ?, ?, ?, ?, ?)`,
                    [reservation.studentName, reservation.idNumber, reservation.purpose, reservation.lab, user.sessionLeft.toString(), 'Active'],
                    (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to create sit-in record' });
                        }

                        // 2. Update reservation status
                        db.run('UPDATE reservations SET status = ? WHERE id = ?', ['Checked In', id], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Failed to update reservation status' });
                            }

                            db.run('COMMIT', (err) => {
                                if (err) return res.status(500).json({ error: 'Transaction failed' });
                                res.json({ success: true, message: 'Student checked in successfully' });
                            });
                        });
                    }
                );
            });
        });
    });
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
            middleName: req.session.middleName,
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

app.get('/student-history', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'student-history.html'));
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

// AI Recommendations API (rule-based)
app.get('/api/ai-recommendations', checkAuth, (req, res) => {
    const idNumber = req.session.idNumber;

    db.all(`
        SELECT lab, purpose, COUNT(*) as frequency
        FROM student_history
        WHERE idNumber = ?
        GROUP BY lab, purpose
        ORDER BY frequency DESC
        LIMIT 5
    `, [idNumber], (err, history) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        db.all(`
            SELECT lab, COUNT(*) as current_count
            FROM sitin_records
            WHERE status = 'Active'
            GROUP BY lab
        `, [], (err, activeLabs) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            const recommendations = [];
            const labCapacity = { 'Lab 524': 30, 'Lab 526': 30, 'Lab 542': 25, 'Mac Lab': 20 };

            // Find least busy lab
            const allLabs = ['Lab 524', 'Lab 526', 'Lab 542', 'Mac Lab'];
            let leastBusy = allLabs[0];
            let minCount = Infinity;
            allLabs.forEach(lab => {
                const count = (activeLabs.find(a => a.lab === lab) || {}).current_count || 0;
                if (count < minCount) {
                    minCount = count;
                    leastBusy = lab;
                }
            });

            if (minCount < (labCapacity[leastBusy] || 30)) {
                recommendations.push({
                    type: 'lab',
                    title: `Try ${leastBusy}`,
                    description: `This lab currently has ${minCount} active users out of ${labCapacity[leastBusy] || 30} capacity. Great availability right now!`,
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
        });
    });
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

createTableAnnouncements();
createTableSitInRecords();
createTableAdmins();
createTableStudentHistory();
createTableFeedbacks();
createTableReservations();
createTableNotifications();

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
            db.run("ALTER TABLE users ADD COLUMN sessionLeft INTEGER DEFAULT 30", (err) => {
                if (!err) {
                    console.log('Added sessionLeft column to users table');
                    db.run('UPDATE users SET sessionLeft = 30 WHERE sessionLeft IS NULL');
                }
            });
        } else {
            // Column exists, just fix any NULLs
            db.run('UPDATE users SET sessionLeft = 30 WHERE sessionLeft IS NULL', (err) => {
                if (!err) console.log('Ensured all students have sessionLeft set');
            });
        }
    });
}
ensureSessionLeftColumn();

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
ensurePointsColumn();

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
ensureMiddleNameColumn();
renameAnnouncementsTable();
ensureAnnouncementHiddenColumn();

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
db.get('SELECT COUNT(*) as count FROM Announcements', (err, row) => {
    if (!err && row.count === 0) {
        db.run('INSERT INTO Announcements (title, description) VALUES (?, ?)', ['Welcome!', 'Welcome to the CCS Sit-In Monitoring System.']);
    }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});



