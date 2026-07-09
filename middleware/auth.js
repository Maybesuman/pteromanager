/**
 * Authentication Middleware
 * Checks if user is authenticated and redirects to login if not
 */

module.exports = (req, res, next) => {
  // Check if user has an active session
  if (req.session && req.session.userId) {
    // User is authenticated, proceed to next middleware/route
    next();
  } else {
    // User is not authenticated, redirect to login page
    res.redirect('/login.html');
  }
};
