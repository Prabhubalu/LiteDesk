const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PeopleSchema = new Schema({
  // Multi-tenancy
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  // System fields
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  legacyContactId: { type: Schema.Types.ObjectId, index: true },

  // Core
  source: { type: String, trim: true },
  type: { type: String, enum: ['Lead', 'Contact'], required: true },

  first_name: { type: String, trim: true },
  last_name: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !!(this.first_name || v);
      },
      message: 'Last Name is required if First Name is missing'
    }
  },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  mobile: { type: String, trim: true },

  organization: { type: Schema.Types.ObjectId, ref: 'Organization' },

  tags: [{ type: String, trim: true }],
  do_not_contact: { type: Boolean, default: false },

  // Lead-specific
  lead_status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage']
  },
  lead_owner: { type: Schema.Types.ObjectId, ref: 'User' },
  lead_score: { type: Number, min: 0 },

  interest_products: [{ type: String, trim: true }],
  qualification_date: { type: Date },
  qualification_notes: { type: String, trim: true },
  estimated_value: { type: Number, min: 0 },

  // Contact-specific
  contact_status: {
    type: String,
    enum: ['Active', 'Inactive', 'DoNotContact']
  },
  role: {
    type: String,
    enum: ['Decision Maker', 'Influencer', 'Support', 'Other']
  },
  birthday: { type: Date },
  preferred_contact_method: {
    type: String,
    enum: ['Email', 'Phone', 'WhatsApp', 'SMS', 'None']
  },
  
  // Notes & Activities
  notes: [{
    text: { type: String, required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    created_at: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

PeopleSchema.index({ organizationId: 1, assignedTo: 1 });
PeopleSchema.index({ organizationId: 1, type: 1 });
PeopleSchema.index({ organizationId: 1, email: 1 }, { unique: false, sparse: true });
PeopleSchema.index({ organizationId: 1, lead_status: 1 });
PeopleSchema.index({ organizationId: 1, contact_status: 1 });
PeopleSchema.index({ organizationId: 1, legacyContactId: 1 }, { unique: false, sparse: true });

// Prevent createdBy from being modified after creation
PeopleSchema.pre('findOneAndUpdate', function() {
  // Remove createdBy from update if it exists
  const update = this.getUpdate();
  if (update && update.createdBy !== undefined) {
    delete update.createdBy;
  }
  // Also handle $set operations
  if (update && update.$set && update.$set.createdBy !== undefined) {
    delete update.$set.createdBy;
  }
});

PeopleSchema.pre('save', async function(next) {
  // If this is an update (not new document) and createdBy is being changed, prevent it
  if (!this.isNew && this.isModified('createdBy')) {
    try {
      // Fetch the original document to get the original createdBy value
      const original = await this.constructor.findById(this._id).select('createdBy').lean();
      if (original && original.createdBy) {
        // Restore the original value
        this.createdBy = original.createdBy;
        // Mark the field as unmodified
        this.unmarkModified('createdBy');
      }
      next();
    } catch (error) {
      // If we can't fetch the original, prevent the save
      next(new Error('createdBy field cannot be modified after creation'));
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('People', PeopleSchema);


