const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for tracking individual notes/interactions
const NoteSchema = new Schema({
    text: { type: String, required: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: false }, // Optional for system notes
    created_at: { type: Date, default: Date.now }
}, { _id: false }); // Using _id: false since we'll embed this

// Contact Schema Definition
const ContactSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    // **********************************
    organizationId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // 🧩 CORE IDENTIFICATION
    // **********************************
    first_name: { type: String, trim: true, required: true },
    last_name: { type: String, trim: true, required: false, default: '' }, // Optional for single-name contacts
    salutation: { 
        type: String, 
        enum: ["Mr.", "Ms.", "Mrs.", "Dr.", null], // RECOMMENDED ADDITION
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        trim: true 
    },
    phone: { type: String, trim: true },
    mobile: { type: String, trim: true },

    // 🏢 COMPANY / RELATIONSHIP
    // **********************************
    account_id: { type: Schema.Types.ObjectId, ref: "Account" }, // Foreign Key to the Company/Account
    company: { type: String, trim: true }, // Company name (text field)
    job_title: { type: String, trim: true },
    department: { type: String, trim: true },
    reports_to: { type: Schema.Types.ObjectId, ref: "Contact" }, // Self-referencing Foreign Key

    // 📬 ADDRESS (Embedded Sub-Document)
    // **********************************
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postal_code: { type: String, trim: true },
        country: { type: String, trim: true },
    },

    // 🧠 COMMUNICATION & SOCIAL
    // **********************************
    website: { type: String, trim: true },
    linkedin_url: { type: String, trim: true },
    twitter_handle: { type: String, trim: true },
    preferred_channel: {
        type: String,
        enum: ["email", "phone", "whatsapp", "sms", null],
        default: "email",
    },

    // ⚙️ CRM METADATA
    // **********************************
    lead_source: { type: String, trim: true }, // Consider making this an enum or ref table later
    lifecycle_stage: {
        type: String,
        enum: ["Lead", "Qualified", "Customer", "Lost", "Subscriber", "Opportunity"], // Expanded Enum
        default: "Lead",
    },
    owner_id: { type: Schema.Types.ObjectId, ref: "User" },
    tags: [{ type: String, trim: true }],
    status: {
        type: String,
        enum: ["Active", "Inactive", "Archived"],
        default: "Active",
    },
    do_not_contact: { type: Boolean, default: false }, // Compliance flag

    // 🗓️ ACTIVITY & ENGAGEMENT
    // **********************************
    last_contacted_at: { type: Date },
    last_activity_at: { type: Date },
    next_followup_at: { type: Date },
    score: { type: Number, default: 0 }, // Lead Score

    // 📝 INTERACTION HISTORY
    // **********************************
    notes: [NoteSchema], // Embedded array of notes

    // 💾 ADVANCED & EXTENSIBILITY
    // **********************************
    custom_fields: { type: Schema.Types.Mixed, default: {} }, // Flexible JSON/Object field for custom data
    integration_ids: { type: Schema.Types.Mixed, default: {} }, // For storing IDs from external systems (e.g., HubSpotID)
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Compound index for organization + email (unique within organization, not globally)
ContactSchema.index({ organizationId: 1, email: 1 }, { unique: true });

// Remove the unique constraint from email alone since we need it unique per organization
ContactSchema.path('email').index({ unique: false });

// Additional indexes for common queries
ContactSchema.index({ organizationId: 1, lifecycle_stage: 1 });
ContactSchema.index({ organizationId: 1, owner_id: 1 });
ContactSchema.index({ organizationId: 1, status: 1 });

// Create model
const Contact = mongoose.model("Contact", ContactSchema);

module.exports = Contact;