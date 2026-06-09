const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const {
    validateInvite,
    acceptInvite,
    confirmEmailVerification
} = require('../controllers/userInviteAuthController');
const {
    forgotPassword,
    validateResetPassword,
    resetPassword
} = require('../controllers/passwordResetAuthController');
const { 
    authLimiter, 
    registrationLimiter, 
    passwordResetLimiter 
} = require('../middleware/rateLimitMiddleware');
const { progressiveAuthThrottle } = require('../middleware/progressiveAuthThrottleMiddleware');
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
router.post('/login', progressiveAuthThrottle, authLimiter, loginUser);

router.get('/invite/validate', passwordResetLimiter, validateInvite);
router.post('/invite/accept', passwordResetLimiter, acceptInvite);
router.get('/verify-email/confirm', passwordResetLimiter, confirmEmailVerification);
router.post('/verify-email/confirm', passwordResetLimiter, confirmEmailVerification);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.get('/reset-password/validate', passwordResetLimiter, validateResetPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

module.exports = router;
