const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * POST /auth/login
 * Authenticates user with username and password
 * Creates session if credentials are valid
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Read users from JSON file
    const usersPath = path.join(__dirname, '../users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Find user by username
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare provided password with hashed password
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ 
      success: true, 
      message: 'Login successful',
      redirect: '/dashboard.html'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

/**
 * POST /auth/logout
 * Destroys user session and logs them out
 */
router.post('/logout', (req, res) => {
  try {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ 
        success: true, 
        message: 'Logout successful',
        redirect: '/login.html'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});

/**
 * GET /auth/session
 * Returns current session information
 */
router.get('/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      username: req.session.username
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

module.exports = router;
