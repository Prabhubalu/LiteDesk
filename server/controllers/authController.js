const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- Helper Function: Generate Token ---
const generateToken = (id) => {
    // Secret key should be stored in .env for production
    return jwt.sign({ id }, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET', {
        expiresIn: '1d',
    });
};

// --- 1. Registration Logic ---
exports.registerUser = async (req, res) => {
    const { username, email, password, vertical } = req.body;
    try {
        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Create User
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            vertical,
        });

        // 3. Respond with Token
        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                vertical: user.vertical,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        // Handle duplicate key error (email/username already exists)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'User already exists with this email or username.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// --- 2. Login Logic ---
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    // 1. Find User by Email
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        // 2. Passwords match, respond with Token
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            vertical: user.vertical,
            token: generateToken(user._id),
        });
    } else {
        // 3. Authentication Failed
        res.status(401).json({ message: 'Invalid credentials.' });
    }
};