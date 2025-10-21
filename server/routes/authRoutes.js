const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const router = express.Router();

// Test endpoint to verify code version
router.get('/test-version', (req, res) => {
    res.json({
        message: '✅ NEW CODE IS RUNNING',
        timestamp: new Date().toISOString(),
        version: 'v2-with-organizations'
    });
});

router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;