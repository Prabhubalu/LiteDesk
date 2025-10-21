const mongoose = require('mongoose');

const ProcessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  vertical: { type: String, required: true },
  triggerFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  // The core of the workflow: an array defining stages, conditions, and actions
  steps: [{
    stepName: String,
    type: { type: String, enum: ['Condition', 'Action', 'ModuleCreation'] },
    // For 'Condition' type
    conditionalLogic: String, // e.g., "contact.status === 'Hot'" 
    nextStep: String,
    // For 'Action' type (Automation Triggers)
    actionType: { type: String, enum: ['SendEmail', 'SendWhatsApp', 'CreateEvent', 'ChangeStatus', 'AssignUser'] }, // [cite: 1]
    actionDetails: { type: mongoose.Schema.Types.Mixed }, // flexible object, e.g., { template: 'WelcomeEmail', recipient: 'contact.email' }
  }],
}, { timestamps: true });

module.exports = mongoose.model('Process', ProcessSchema);