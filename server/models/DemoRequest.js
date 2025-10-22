const mongoose = require('mongoose');

const DemoRequestSchema = new mongoose.Schema({
    // Company Information
    companyName: { 
        type: String, 
        required: true 
    },
    industry: { 
        type: String, 
        required: true 
    },
    companySize: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
        required: true
    },
    
    // Contact Information
    contactName: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true,
        lowercase: true,
        unique: true
    },
    phone: String,
    jobTitle: String,
    
    // Demo Details
    preferredDemoDate: Date,
    timeZone: String,
    message: String,
    
    // Lead Tracking
    status: {
        type: String,
        enum: ['pending', 'contacted', 'demo_scheduled', 'demo_completed', 'converted', 'rejected'],
        default: 'pending'
    },
    source: {
        type: String,
        default: 'website'
    },
    
    // Follow-up
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: String,
    
    // CRM Integration (Auto-created on submission)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    },
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact'
    },
    
    // Conversion (Multi-Instance Architecture)
    convertedToInstanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InstanceRegistry'
    },
    convertedAt: Date
}, { 
    timestamps: true 
});

// Index for faster queries
DemoRequestSchema.index({ email: 1 });
DemoRequestSchema.index({ status: 1 });
DemoRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DemoRequest', DemoRequestSchema);

