const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// --- Get all users in the organization ---
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ 
            organizationId: req.user.organizationId 
        })
        .select('-password')  // Exclude password
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users' 
        });
    }
};

// --- Get single user ---
exports.getUser = async (req, res) => {
    try {
        const user = await User.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        }).select('-password');

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching user' 
        });
    }
};

// --- Invite/Create new user ---
exports.inviteUser = async (req, res) => {
    const { email, firstName, lastName, role, phoneNumber } = req.body;

    try {
        // Validate required fields
        if (!email || !role) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and role are required' 
            });
        }

        // Check if organization has reached user limit
        const organization = req.organization;
        const currentUserCount = await User.countDocuments({ 
            organizationId: organization._id,
            status: 'active'
        });

        if (organization.limits.maxUsers !== -1 && currentUserCount >= organization.limits.maxUsers) {
            return res.status(403).json({ 
                success: false,
                message: `User limit reached (${organization.limits.maxUsers}). Please upgrade your plan.`,
                code: 'USER_LIMIT_REACHED'
            });
        }

        // Check if user already exists in this organization
        const existingUser = await User.findOne({ 
            email: email.toLowerCase(),
            organizationId: req.user.organizationId 
        });

        if (existingUser) {
            return res.status(409).json({ 
                success: false,
                message: 'User with this email already exists in your organization' 
            });
        }

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create username from email
        const username = email.split('@')[0];

        // Create new user
        const newUser = await User.create({
            organizationId: req.user.organizationId,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: firstName || '',
            lastName: lastName || '',
            phoneNumber,
            role: role || 'user',
            isOwner: false,
            status: 'active'
        });

        // Set permissions based on role
        newUser.setPermissionsByRole(role);
        await newUser.save();

        // TODO: Send invitation email with temporary password
        // For now, we'll return it in the response (ONLY FOR DEVELOPMENT)

        res.status(201).json({
            success: true,
            data: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                status: newUser.status,
                tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
            },
            message: 'User invited successfully'
        });

    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error inviting user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Update user role and permissions ---
exports.updateUser = async (req, res) => {
    const { role, status, permissions, firstName, lastName, phoneNumber } = req.body;

    try {
        const user = await User.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Prevent changing owner role
        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot modify the organization owner',
                code: 'CANNOT_MODIFY_OWNER'
            });
        }

        // Update fields
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (status !== undefined) user.status = status;
        
        // Update role and reset permissions
        if (role !== undefined && role !== user.role) {
            user.role = role;
            user.setPermissionsByRole(role);
        }

        // Allow custom permissions override (if provided)
        if (permissions !== undefined) {
            user.permissions = { ...user.permissions, ...permissions };
        }

        await user.save();

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                permissions: user.permissions
            },
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating user' 
        });
    }
};

// --- Delete/Deactivate user ---
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        // Prevent deleting owner
        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot delete the organization owner',
                code: 'CANNOT_DELETE_OWNER'
            });
        }

        // Soft delete: just deactivate the user
        user.status = 'inactive';
        await user.save();

        // For hard delete, use: await user.remove();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error deleting user' 
        });
    }
};

// --- Get current user profile ---
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('organizationId', 'name subscription limits enabledModules settings');

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching profile' 
        });
    }
};

// --- Update current user profile ---
exports.updateProfile = async (req, res) => {
    const { firstName, lastName, phoneNumber, avatar } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                avatar: user.avatar
            },
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating profile' 
        });
    }
};

// --- Change password ---
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Current password and new password are required' 
            });
        }

        const user = await User.findById(req.user._id);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error changing password' 
        });
    }
};

