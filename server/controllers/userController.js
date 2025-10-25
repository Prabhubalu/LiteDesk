const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// --- Get all users in the organization ---
exports.getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            roleId = ''
        } = req.query;

        // Build query
        const query = { organizationId: req.user.organizationId };

        // Add roleId filter if provided
        if (roleId) {
            query.roleId = roleId;
        }

        // Add search filter
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const users = await User.find(query)
            .select('-password')  // Exclude password
            .populate('roleId', 'name description color icon level')  // Populate role details
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Get total count
        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
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
        })
        .select('-password')
        .populate('roleId', 'name description color icon level permissions');

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
    const { email, firstName, lastName, roleId, role, phoneNumber, password, sendEmail } = req.body;

    try {
        // Validate required fields
        if (!email || !roleId) {
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

        // Fetch the Role document to get role details
        const Role = require('../models/Role');
        const roleDoc = await Role.findById(roleId);
        
        if (!roleDoc) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Use provided password or generate temporary password
        const tempPassword = password || crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create username from email
        const username = email.split('@')[0];

        // Map role name to legacy role enum for backward compatibility
        const legacyRole = roleDoc.name.toLowerCase();

        // Create new user
        const newUser = await User.create({
            organizationId: req.user.organizationId,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: firstName || '',
            lastName: lastName || '',
            phoneNumber,
            roleId: roleId,
            role: legacyRole, // Store legacy role for backward compatibility
            isOwner: roleDoc.name === 'Owner',
            status: 'active'
        });

        // Set permissions based on the dynamic role's permissions
        // Map the Role permissions to User permissions structure
        newUser.permissions = {
            contacts: {
                view: roleDoc.permissions.contacts.read,
                create: roleDoc.permissions.contacts.create,
                edit: roleDoc.permissions.contacts.update,
                delete: roleDoc.permissions.contacts.delete,
                viewAll: roleDoc.permissions.contacts.viewAll || false,
                exportData: roleDoc.permissions.contacts.export || false
            },
            deals: {
                view: roleDoc.permissions.deals.read,
                create: roleDoc.permissions.deals.create,
                edit: roleDoc.permissions.deals.update,
                delete: roleDoc.permissions.deals.delete,
                viewAll: roleDoc.permissions.deals.viewAll || false,
                exportData: roleDoc.permissions.deals.export || false
            },
            projects: {
                view: true,
                create: true,
                edit: true,
                delete: false,
                viewAll: false
            },
            tasks: {
                view: roleDoc.permissions.tasks.read,
                create: roleDoc.permissions.tasks.create,
                edit: roleDoc.permissions.tasks.update,
                delete: roleDoc.permissions.tasks.delete,
                viewAll: roleDoc.permissions.tasks.viewAll || false
            },
            imports: {
                view: true,
                create: roleDoc.permissions.contacts.import || roleDoc.permissions.deals.import,
                delete: false
            },
            settings: {
                manageUsers: roleDoc.permissions.settings.manageUsers || false,
                manageBilling: roleDoc.permissions.settings.manageBilling || false,
                manageIntegrations: false,
                customizeFields: false
            },
            reports: {
                viewStandard: roleDoc.permissions.reports.read,
                viewCustom: roleDoc.permissions.reports.read,
                createCustom: roleDoc.permissions.reports.create,
                exportReports: roleDoc.permissions.reports.export || false
            }
        };
        
        await newUser.save();
        
        // Increment the role's user count
        await Role.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });

        // TODO: Send invitation email with temporary password if sendEmail is true
        // For now, we'll return it in the response (ONLY FOR DEVELOPMENT)

        // Populate the role details
        await newUser.populate('roleId');

        res.status(201).json({
            success: true,
            data: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                roleId: newUser.roleId,
                status: newUser.status,
                tempPassword: tempPassword // Always return for now since email not implemented
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
    const { role, roleId, status, permissions, firstName, lastName, phoneNumber } = req.body;

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
        
        // Update role if roleId is provided (new dynamic role system)
        if (roleId !== undefined && roleId !== user.roleId?.toString()) {
            const Role = require('../models/Role');
            const roleDoc = await Role.findById(roleId);
            
            if (!roleDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Decrement old role's user count
            if (user.roleId) {
                await Role.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
            }

            // Update user's role
            user.roleId = roleId;
            user.role = roleDoc.name.toLowerCase(); // Update legacy role field
            user.isOwner = roleDoc.name === 'Owner';

            // Update permissions from role
            user.permissions = {
                contacts: {
                    view: roleDoc.permissions.contacts.read,
                    create: roleDoc.permissions.contacts.create,
                    edit: roleDoc.permissions.contacts.update,
                    delete: roleDoc.permissions.contacts.delete,
                    viewAll: roleDoc.permissions.contacts.viewAll || false,
                    exportData: roleDoc.permissions.contacts.export || false
                },
                deals: {
                    view: roleDoc.permissions.deals.read,
                    create: roleDoc.permissions.deals.create,
                    edit: roleDoc.permissions.deals.update,
                    delete: roleDoc.permissions.deals.delete,
                    viewAll: roleDoc.permissions.deals.viewAll || false,
                    exportData: roleDoc.permissions.deals.export || false
                },
                projects: {
                    view: true,
                    create: true,
                    edit: true,
                    delete: false,
                    viewAll: false
                },
                tasks: {
                    view: roleDoc.permissions.tasks.read,
                    create: roleDoc.permissions.tasks.create,
                    edit: roleDoc.permissions.tasks.update,
                    delete: roleDoc.permissions.tasks.delete,
                    viewAll: roleDoc.permissions.tasks.viewAll || false
                },
                imports: {
                    view: true,
                    create: roleDoc.permissions.contacts.import || roleDoc.permissions.deals.import,
                    delete: false
                },
                settings: {
                    manageUsers: roleDoc.permissions.settings.manageUsers || false,
                    manageBilling: roleDoc.permissions.settings.manageBilling || false,
                    manageIntegrations: false,
                    customizeFields: false
                },
                reports: {
                    viewStandard: roleDoc.permissions.reports.read,
                    viewCustom: roleDoc.permissions.reports.read,
                    createCustom: roleDoc.permissions.reports.create,
                    exportReports: roleDoc.permissions.reports.export || false
                }
            };

            // Increment new role's user count
            await Role.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });
        }
        // Fallback to legacy role update (for backward compatibility)
        else if (role !== undefined && role !== user.role) {
            user.role = role;
            user.setPermissionsByRole(role);
        }

        // Allow custom permissions override (if provided)
        if (permissions !== undefined) {
            user.permissions = { ...user.permissions, ...permissions };
        }

        await user.save();

        // Populate role details
        await user.populate('roleId', 'name description color icon level');

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                roleId: user.roleId,
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

        // Decrement role's user count if roleId exists
        if (user.roleId) {
            const Role = require('../models/Role');
            await Role.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
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
            .populate('organizationId', 'name subscription limits enabledModules settings')
            .populate('roleId', 'name description color icon level permissions');

        // If user has roleId, ensure permissions are synced from role
        if (user.roleId && user.roleId.permissions) {
            // Map role permissions to user permissions structure
            user.permissions = {
                contacts: {
                    view: user.roleId.permissions.contacts?.read || false,
                    create: user.roleId.permissions.contacts?.create || false,
                    edit: user.roleId.permissions.contacts?.update || false,
                    delete: user.roleId.permissions.contacts?.delete || false,
                    viewAll: user.roleId.permissions.contacts?.viewAll || false,
                    exportData: user.roleId.permissions.contacts?.export || false
                },
                organizations: {
                    view: user.roleId.permissions.organizations?.read || false,
                    create: user.roleId.permissions.organizations?.create || false,
                    edit: user.roleId.permissions.organizations?.update || false,
                    delete: user.roleId.permissions.organizations?.delete || false,
                    viewAll: user.roleId.permissions.organizations?.viewAll || false,
                    exportData: user.roleId.permissions.organizations?.export || false
                },
                deals: {
                    view: user.roleId.permissions.deals?.read || false,
                    create: user.roleId.permissions.deals?.create || false,
                    edit: user.roleId.permissions.deals?.update || false,
                    delete: user.roleId.permissions.deals?.delete || false,
                    viewAll: user.roleId.permissions.deals?.viewAll || false,
                    exportData: user.roleId.permissions.deals?.export || false
                },
                projects: {
                    view: user.roleId.permissions.deals?.read || false,
                    create: user.roleId.permissions.deals?.create || false,
                    edit: user.roleId.permissions.deals?.update || false,
                    delete: user.roleId.permissions.deals?.delete || false,
                    viewAll: user.roleId.permissions.deals?.viewAll || false
                },
                tasks: {
                    view: user.roleId.permissions.tasks?.read || false,
                    create: user.roleId.permissions.tasks?.create || false,
                    edit: user.roleId.permissions.tasks?.update || false,
                    delete: user.roleId.permissions.tasks?.delete || false,
                    viewAll: user.roleId.permissions.tasks?.viewAll || false
                },
                events: {
                    view: user.roleId.permissions.events?.read || false,
                    create: user.roleId.permissions.events?.create || false,
                    edit: user.roleId.permissions.events?.update || false,
                    delete: user.roleId.permissions.events?.delete || false,
                    viewAll: user.roleId.permissions.events?.viewAll || false
                },
                imports: {
                    view: user.roleId.permissions.contacts?.import || user.roleId.permissions.deals?.import || false,
                    create: user.roleId.permissions.contacts?.import || user.roleId.permissions.deals?.import || false,
                    delete: false
                },
                settings: {
                    manageUsers: user.roleId.permissions.settings?.manageUsers || false,
                    manageBilling: user.roleId.permissions.settings?.manageBilling || false,
                    manageIntegrations: false,
                    customizeFields: false
                },
                reports: {
                    viewStandard: user.roleId.permissions.reports?.read || false,
                    viewCustom: user.roleId.permissions.reports?.read || false,
                    createCustom: user.roleId.permissions.reports?.create || false,
                    exportReports: user.roleId.permissions.reports?.export || false
                }
            };
        }

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

// --- Reset user password (Admin only) ---
exports.resetUserPassword = async (req, res) => {
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

        // Prevent resetting owner password
        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot reset the organization owner password',
                code: 'CANNOT_RESET_OWNER_PASSWORD'
            });
        }

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        user.password = hashedPassword;
        await user.save();

        // TODO: Send password reset email
        // For now, we'll return it in the response (ONLY FOR DEVELOPMENT)

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
            }
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error resetting password' 
        });
    }
};

