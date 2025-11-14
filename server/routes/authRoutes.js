const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const { 
    authLimiter, 
    registrationLimiter, 
    passwordResetLimiter 
} = require('../middleware/rateLimitMiddleware');
const router = express.Router();

// Test endpoint to verify code version
router.get('/test-version', (req, res) => {
    res.json({
        message: '✅ NEW CODE IS RUNNING',
        timestamp: new Date().toISOString(),
        version: 'v2-with-organizations'
    });
});

// Apply strict rate limiting to authentication endpoints
router.post('/register', registrationLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// Note: Add password reset route with passwordResetLimiter when implemented
// router.post('/forgot-password', passwordResetLimiter, forgotPassword);
// router.post('/reset-password', passwordResetLimiter, resetPassword);

module.exports = router;