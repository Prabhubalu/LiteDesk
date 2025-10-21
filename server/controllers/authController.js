const User = require('../models/User');
const Organization = require('../models/Organization');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- Helper Function: Generate Token ---
const generateToken = (id) => {
    // Secret key should be stored in .env for production
    return jwt.sign({ id }, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET', {
        expiresIn: '1d',
    });
};

// --- 1. Registration Logic (Multi-tenant: Creates Organization + Owner) ---
exports.registerUser = async (req, res) => {
    console.log('\n\n========================================');
    console.log('🚀 REGISTRATION FUNCTION CALLED - NEW CODE VERSION');
    console.log('========================================');
    
    const { username, email, password, vertical, organizationName } = req.body;
    
    // DEBUG LOGGING
    console.log('📝 Registration Request Received:');
    console.log('  - Username:', username);
    console.log('  - Email:', email);
    console.log('  - Vertical:', vertical);
    console.log('  - Organization Name:', organizationName);
    console.log('  - Full body:', JSON.stringify(req.body, null, 2));
    
    try {
        console.log('\n🔍 Step 1: Validating fields...');
        // Validate required fields
        if (!username || !email || !password || !vertical) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ 
                message: 'Please provide all required fields: username, email, password, vertical' 
            });
        }

        console.log('✅ Validation passed\n');
        
        console.log('🔍 Step 2: Checking for existing user...');
        // Check if user with this email already exists (across all organizations)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({ 
                message: 'A user with this email already exists.' 
            });
        }
        console.log('✅ No existing user found\n');

        // 1. Create Organization (Tenant)
        console.log('🔍 Step 3: Creating organization...');
        console.log('   Organization Name:', organizationName || `${username}'s Organization`);
        console.log('   Industry:', vertical);
        const organization = await Organization.create({
            name: organizationName || `${username}'s Organization`,
            industry: vertical,
            subscription: {
                status: 'trial',
                tier: 'trial',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
            },
            limits: {
                maxUsers: 3,
                maxContacts: 100,
                maxDeals: 50,
                maxStorageGB: 1
            },
            enabledModules: ['contacts', 'deals', 'tasks', 'events']
        });
        console.log('✅ ✅ ✅ ORGANIZATION CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', organization._id);
        console.log('   Name:', organization.name);
        console.log('   Subscription Status:', organization.subscription.status);
        console.log('   Trial End Date:', organization.subscription.trialEndDate);
        console.log('\n');

        // 2. Hash Password
        console.log('🔍 Step 4: Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('✅ Password hashed\n');

        // 3. Create Owner User
        console.log('🔍 Step 5: Creating owner user...');
        console.log('   Linking to Organization ID:', organization._id);
        const user = await User.create({
            organizationId: organization._id,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            vertical,
            role: 'owner',
            isOwner: true,
            status: 'active'
        });
        console.log('✅ ✅ ✅ USER CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', user._id);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   IsOwner:', user.isOwner);
        console.log('   Organization ID:', user.organizationId);
        console.log('\n');

        // 4. Set owner permissions
        console.log('🔍 Step 6: Setting owner permissions...');
        user.setPermissionsByRole('owner');
        await user.save();
        console.log('✅ Permissions set and user saved\n');

        // 5. Respond with Token and Organization Info
        console.log('🔍 Step 7: Preparing response...');
        const response = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isOwner: user.isOwner,
            organization: {
                _id: organization._id,
                name: organization.name,
                industry: organization.industry,
                subscription: organization.subscription,
                limits: organization.limits,
                enabledModules: organization.enabledModules
            },
            token: generateToken(user._id),
        };
        
        console.log('✅ Response prepared');
        console.log('📤 SENDING RESPONSE:');
        console.log('   - User ID:', response._id);
        console.log('   - Email:', response.email);
        console.log('   - Role:', response.role);
        console.log('   - IsOwner:', response.isOwner);
        console.log('   - Organization Name:', response.organization.name);
        console.log('   - Organization ID:', response.organization._id);
        console.log('========================================\n\n');
        
        res.status(201).json(response);
        
    } catch (error) {
        console.error('\n\n❌❌❌ REGISTRATION ERROR ❌❌❌');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        console.error('========================================\n\n');
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({ 
                message: 'User already exists with this email or username.' 
            });
        }
        
        res.status(500).json({ 
            message: 'Server error during registration.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- 2. Login Logic ---
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log('\n🔐 Login attempt for:', email);
        
        // 1. Find User by Email
        const user = await User.findOne({ email: email.toLowerCase() })
            .populate('organizationId', 'name industry subscription limits enabledModules settings isActive');

        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        console.log('✅ User found:', user.email);
        console.log('   Organization populated?', !!user.organizationId);
        console.log('   Organization ID:', user.organizationId?._id || 'NOT POPULATED');

        // 2. Check password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 3. Check if user is active
        if (user.status !== 'active') {
            console.log('❌ User status not active:', user.status);
            return res.status(403).json({ 
                message: 'Your account has been suspended. Please contact your administrator.',
                code: 'ACCOUNT_SUSPENDED'
            });
        }
        console.log('✅ User status: active');

        // 4. Check if organization exists and is populated
        if (!user.organizationId) {
            console.log('❌ Organization not found for user');
            return res.status(500).json({ 
                message: 'Organization data not found. Please contact support.',
                code: 'ORG_NOT_FOUND'
            });
        }
        console.log('✅ Organization found:', user.organizationId.name);
        
        // 5. Check if organization is active
        if (!user.organizationId.isActive) {
            console.log('❌ Organization not active:', user.organizationId.isActive);
            return res.status(403).json({ 
                message: 'Your organization account is inactive. Please contact support.',
                code: 'ORG_INACTIVE'
            });
        }
        console.log('✅ Organization is active');

        // 6. Update last login
        user.lastLogin = new Date();
        await user.save();

        console.log('✅ Login successful for:', email);

        // 7. Respond with Token and Organization Info
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isOwner: user.isOwner,
            permissions: user.permissions,
            organization: {
                _id: user.organizationId._id,
                name: user.organizationId.name,
                industry: user.organizationId.industry,
                subscription: user.organizationId.subscription,
                limits: user.organizationId.limits,
                enabledModules: user.organizationId.enabledModules,
                settings: user.organizationId.settings
            },
            token: generateToken(user._id),
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};