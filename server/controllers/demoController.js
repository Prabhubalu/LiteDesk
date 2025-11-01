const DemoRequest = require('../models/DemoRequest');
const Organization = require('../models/Organization');
const People = require('../models/People');
const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const updatePeopleModuleFields = require('../scripts/updatePeopleModuleFields');

// --- Submit Demo Request (Public) ---
exports.submitDemoRequest = async (req, res) => {
    const { companyName, industry, companySize, contactName, email, phone, jobTitle, message } = req.body;
    
    try {
        console.log('📝 Demo request received from:', email);
        
        // Validate required fields
        if (!companyName || !contactName || !email || !industry || !companySize) {
            return res.status(400).json({ 
                success: false,
                message: 'Please provide all required fields' 
            });
        }
        
        // Check if email already requested
        const existing = await DemoRequest.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ 
                success: false,
                message: 'A demo request with this email already exists. We will contact you soon!' 
            });
        }
        
        // Step 1: Create Organization for the prospect company
        console.log('📋 Creating organization for:', companyName);
        
        // Generate unique slug to avoid conflicts
        let baseSlug = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        
        // Check if slug exists and make it unique if needed
        let slug = baseSlug;
        let counter = 1;
        while (await Organization.findOne({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        
        const organization = await Organization.create({
            name: companyName,
            slug: slug,
            industry: industry,
            isActive: true, // Active for tracking
            subscription: {
                tier: 'trial',
                status: 'trial', // In trial until they convert
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
            },
            limits: {
                maxUsers: 5,
                maxContacts: 100,
                maxStorageGB: 1,
                maxApiRequests: 1000
            },
            settings: {
                timeZone: 'UTC',
                currency: 'USD'
            },
            enabledModules: ['contacts', 'deals'] // Limited modules for prospects
        });
        
        console.log('✅ Organization created:', organization._id, organization.name, 'slug:', slug);
        
        // Step 1.5: Create Default Roles for the organization
        console.log('🔐 Creating default roles...');
        try {
            const roles = await Role.createDefaultRoles(organization._id);
            console.log('✅ Default roles created:', roles.length, 'roles');
        } catch (roleError) {
            console.warn('⚠️  Failed to create default roles:', roleError.message);
            // Continue even if role creation fails
        }
        
        // Step 1.6: Initialize People Module Definition with dependencies
        console.log('🔍 Initializing People module definition...');
        try {
            await updatePeopleModuleFields(organization._id);
            console.log('✅ People module definition initialized with dependencies');
        } catch (moduleError) {
            console.warn('⚠️  Failed to initialize People module:', moduleError.message);
            // Continue even if module initialization fails - can be run manually later
        }
        
        // Step 2: Create People for the requester
        console.log('👤 Creating person for:', contactName);
        const person = await People.create({
            organizationId: organization._id,
            createdBy: null,
            assignedTo: null,
            type: 'Lead',
            first_name: contactName.split(' ')[0] || contactName,
            last_name: contactName.split(' ').slice(1).join(' ') || '',
            email: email.toLowerCase(),
            phone: phone || '',
            source: 'Website - Demo Request',
            lead_score: 50,
            tags: ['demo-request', industry, companySize]
        });
        
        console.log('✅ People created:', person._id, person.email);
        
        // Step 3: Create demo request with references
        const demoRequest = await DemoRequest.create({
            companyName,
            industry,
            companySize,
            contactName,
            email: email.toLowerCase(),
            phone,
            jobTitle,
            message,
            status: 'pending',
            source: 'website',
            organizationId: organization._id, // Link to organization
            contactId: person._id // Link to people
        });
        
        console.log('✅ Demo request created:', demoRequest._id);
        console.log('🔗 Linked to Organization:', organization._id);
        console.log('🔗 Linked to People:', person._id);
        
        // TODO: Send email notification to sales team
        // TODO: Send confirmation email to requester
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your interest! Our team will contact you within 24 hours.',
            requestId: demoRequest._id,
            organizationId: organization._id,
            contactId: contact._id
        });
        
    } catch (error) {
        console.error('❌ Demo request error:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error name:', error.name);
        res.status(500).json({ 
            success: false,
            message: 'Error submitting demo request. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get All Demo Requests (Admin Only) ---
exports.getDemoRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        
        const requests = await DemoRequest.find(query)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry')
            .populate('contactId', 'first_name last_name email phone lifecycle_stage')
            .populate('convertedToInstanceId', 'instanceName subdomain status');
        
        res.json({
            success: true,
            count: requests.length,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching demo requests:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching demo requests' 
        });
    }
};

// --- Get Single Demo Request ---
exports.getDemoRequest = async (req, res) => {
    try {
        const request = await DemoRequest.findById(req.params.id)
            .populate('assignedTo', 'username email firstName lastName')
            .populate('organizationId', 'name industry subscription')
            .populate('contactId', 'first_name last_name email phone job_title lifecycle_stage lead_score')
            .populate('convertedToInstanceId', 'instanceName subdomain status urls');
        
        if (!request) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Update Demo Request Status ---
exports.updateDemoRequest = async (req, res) => {
    try {
        const { status, notes, assignedTo, preferredDemoDate } = req.body;
        
        const updateData = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (preferredDemoDate) updateData.preferredDemoDate = preferredDemoDate;
        
        const demoRequest = await DemoRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'username email');
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('✅ Demo request updated:', demoRequest._id, '- Status:', demoRequest.status);
        
        res.json({
            success: true,
            data: demoRequest,
            message: 'Demo request updated successfully'
        });
    } catch (error) {
        console.error('Error updating demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating demo request' 
        });
    }
};

// --- Convert Demo Request to Instance (Multi-Instance Architecture) ---
exports.convertToOrganization = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findById(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        if (demoRequest.status === 'converted') {
            return res.status(400).json({ 
                success: false,
                message: 'This demo request has already been converted' 
            });
        }
        
        const { password, subscriptionTier = 'trial' } = req.body;
        
        if (!password) {
            return res.status(400).json({ 
                success: false,
                message: 'Password is required for conversion' 
            });
        }
        
        console.log('🔄 Converting demo request to INSTANCE:', demoRequest.email);
        
        // Import the Instance Provisioner
        const InstanceProvisioner = require('../services/provisioning/instanceProvisioner');
        console.log('✅ InstanceProvisioner imported successfully');
        
        const provisioner = new InstanceProvisioner();
        console.log('✅ InstanceProvisioner instantiated successfully');
        
        // Start provisioning in background (async)
        // This returns immediately and provisioning continues in background
        provisioner.provisionInstance({
            companyName: demoRequest.companyName,
            industry: demoRequest.industry,
            ownerEmail: demoRequest.email,
            ownerName: demoRequest.contactName,
            ownerPassword: password,
            ownerPhone: demoRequest.phone,
            subscriptionTier: subscriptionTier,
            demoRequestId: demoRequest._id,
            createdBy: req.user._id
        }).then(result => {
            console.log('✅ Instance provisioning completed:', result.subdomain);
        }).catch(error => {
            console.error('❌ Instance provisioning failed:', error.message);
            console.error('❌ Stack trace:', error.stack);
        });
        
        // Update demo request immediately
        demoRequest.status = 'converted';
        demoRequest.convertedAt = new Date();
        await demoRequest.save();
        
        // Return immediately - provisioning continues in background
        res.json({
            success: true,
            message: 'Instance provisioning started. This will take 5-10 minutes.',
            data: {
                demoRequestId: demoRequest._id,
                status: 'provisioning',
                estimatedTime: '5-10 minutes',
                note: 'You will receive an email when the instance is ready'
            }
        });
        
    } catch (error) {
        console.error('❌ Conversion error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            success: false,
            message: 'Error converting demo request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Delete Demo Request ---
exports.deleteDemoRequest = async (req, res) => {
    try {
        const demoRequest = await DemoRequest.findByIdAndDelete(req.params.id);
        
        if (!demoRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Demo request not found' 
            });
        }
        
        console.log('🗑️ Demo request deleted:', demoRequest.email);
        
        res.json({
            success: true,
            message: 'Demo request deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting demo request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// --- Get Demo Request Statistics ---
exports.getStats = async (req, res) => {
    try {
        const stats = await DemoRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const total = await DemoRequest.countDocuments();
        const thisMonth = await DemoRequest.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(1)) }
        });
        
        res.json({
            success: true,
            data: {
                total,
                thisMonth,
                byStatus: stats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

