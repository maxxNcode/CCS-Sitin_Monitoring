const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

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

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Serve Static
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'ccs-sitin-monitoring-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Middleware to check if user is logged in
function checkAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Routes

// Login route
app.post('/login', (req, res) => {
    const { idNumber, password } = req.body;

    if (!idNumber || !password) {
        return res.status(400).json({ error: 'ID Number and Password are required' });
    }

    db.get('SELECT * FROM users WHERE idNumber = ?', [idNumber], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid ID Number or Password' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: 'Server error' });
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid ID Number or Password' });
            }

            // Set session
            req.session.userId = user.id;
            req.session.idNumber = user.idNumber;
            req.session.firstName = user.firstName;
            req.session.lastName = user.lastName;

            res.json({ success: true, message: 'Logged in successfully', redirectUrl: '/main.html' });
        });
    });
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
            `INSERT INTO users (idNumber, email, password, firstName, lastName, middleName, courseLevel, course, address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        res.json({ loggedIn: true, idNumber: req.session.idNumber, firstName: req.session.firstName, lastName: req.session.lastName });
    } else {
        res.json({ loggedIn: false });
    }
});

// Serve main.html only if logged in
app.get('/main.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// Serve login and register pages
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});



