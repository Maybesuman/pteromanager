const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const apiRoutes = require('./routes/api');

// Import middleware
const authMiddleware = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = 1000;

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration - using memory store for simplicity (can be upgraded to store in production)
app.use(session({
  secret: 'pterodactyl-port-manager-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize data files if they don't exist
function initializeDataFiles() {
  // Initialize users.json with default admin user
  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    const bcrypt = require('bcrypt');
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    const defaultUsers = [
      {
        id: 1,
        username: 'admin',
        password: defaultPassword
      }
    ];
    fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2));
    console.log('✓ users.json initialized with default admin user');
  }

  // Initialize config.json as empty object
  const configPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      panelUrl: '',
      apiKey: ''
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✓ config.json initialized');
  }
}

// Initialize data files on startup
initializeDataFiles();

// Routes - Public routes (no auth required)
app.get('/', (req, res) => {
  // Redirect to dashboard if authenticated, otherwise to login
  if (req.session.userId) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

app.get('/login.html', (req, res) => {
  // If already logged in, redirect to dashboard
  if (req.session.userId) {
    res.redirect('/dashboard.html');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Authentication routes
app.use('/auth', authRoutes);

// Protected routes - require authentication
app.get('/setup.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/dashboard.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API routes for configuration and Pterodactyl operations
app.use('/api/config', authMiddleware, configRoutes);
app.use('/api/pterodactyl', authMiddleware, apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   Pterodactyl Port Manager is running!               ║`);
  console.log(`║   Server: http://localhost:${PORT}                            ║`);
  console.log(`║   Default login: admin / admin123                    ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
});
