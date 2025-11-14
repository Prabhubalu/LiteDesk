const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // SECURITY: Ensure JWT_SECRET is set - fail hard if not configured
    if (!process.env.JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET environment variable is not set!');
        return res.status(500).json({ 
            message: 'Server configuration error. Please contact support.',
            code: 'SERVER_CONFIG_ERROR'
        });
    }

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header (Bearer <token>)
            token = req.headers.authorization.split(' ')[1];

            // Verify token with configured secret (no fallback for security)
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user to the request object (without the password hash)
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            next();
        } catch (error) {
            console.error('Token verification error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        // No token provided
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };