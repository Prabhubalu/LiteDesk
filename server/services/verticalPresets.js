'use strict';

/**
 * Vertical preset packs — module labels, custom fields, pipelines, org types.
 * Derived from docs/VERTICAL_IMPLEMENTATION_PLAYBOOKS.md.
 *
 * Keys match templateKey in onboardingVerticalTemplates.js (plus sales_default).
 */

function picklistOptions(...values) {
  return values.map((value) => ({ value, label: value }));
}

function field(key, label, dataType, options) {
  const def = {
    key,
    label,
    dataType,
    required: false,
    defaultValue: null,
    visibility: { list: true, detail: true },
    validations: [],
    dependencies: [],
    owner: 'tenant',
    context: 'vertical_preset',
  };
  if (options) {
    def.options = picklistOptions(...options);
  }
  return def;
}

const VERTICAL_PRESETS = Object.freeze({
  sales_default: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Contact', plural: 'Contacts' },
      deals: { singular: 'Deal', plural: 'Deals' },
      organizations: { singular: 'Account', plural: 'Accounts' },
      tasks: { singular: 'Task', plural: 'Tasks' },
    },
    modules: {
      deals: {
        pipelineName: 'Sales Pipeline',
        pipelineStages: [
          { name: 'Qualification', probability: 25 },
          { name: 'Proposal', probability: 50 },
          { name: 'Negotiation', probability: 70 },
          { name: 'Closed Won', status: 'won', probability: 100 },
          { name: 'Closed Lost', status: 'lost', probability: 0 },
        ],
      },
    },
  },

  retail: {
    version: 1,
    enabledApps: ['SALES'],
    optionalApps: ['INVENTORY'],
    moduleLabels: {
      people: { singular: 'Customer', plural: 'Customers' },
      deals: { singular: 'Sale', plural: 'Sales' },
      items: { singular: 'Product', plural: 'Products' },
      organizations: { singular: 'Partner', plural: 'Partners' },
    },
    modules: {
      people: {
        customFields: [
          field('preferredStore', 'Preferred Store', 'Text'),
          field('loyaltyTier', 'Loyalty Tier', 'Picklist', 'Bronze', 'Silver', 'Gold', 'Platinum'),
          field('customerSince', 'Customer Since', 'Date'),
        ],
      },
      organizations: {
        organizationTypes: ['Customer', 'Supplier', 'Retail Partner'],
        customFields: [
          field('storeCode', 'Store Code', 'Text'),
          field('region', 'Region', 'Text'),
        ],
      },
      deals: {
        pipelineName: 'Retail Sales Pipeline',
        pipelineStages: [
          { name: 'Inquiry', probability: 10 },
          { name: 'Qualified', probability: 25 },
          { name: 'Proposal', probability: 50 },
          { name: 'Negotiation', probability: 70 },
          { name: 'Won', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
        customFields: [
          field('channel', 'Channel', 'Picklist', 'Store', 'Online', 'Marketplace'),
          field('storeLocation', 'Store Location', 'Text'),
        ],
      },
    },
  },

  real_estate: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Buyer & Agent', plural: 'Buyers & Agents' },
      organizations: { singular: 'Developer & Agency', plural: 'Developers & Agencies' },
      deals: { singular: 'Property Deal', plural: 'Property Deals' },
      tasks: { singular: 'Site Visit', plural: 'Site Visits' },
    },
    modules: {
      organizations: {
        organizationTypes: ['Developer', 'Broker Agency', 'Channel Partner', 'Customer'],
        customFields: [
          field('reraId', 'RERA ID', 'Text'),
          field('primaryMarkets', 'Primary Markets', 'Text'),
          field('commissionStructure', 'Commission Structure', 'Text-Area'),
        ],
      },
      people: {
        customFields: [
          field('budgetMin', 'Budget Min', 'Currency'),
          field('budgetMax', 'Budget Max', 'Currency'),
          field('preferredLocations', 'Preferred Locations', 'Text'),
          field('propertyType', 'Property Type', 'Picklist', '1BHK', '2BHK', 'Villa', 'Commercial'),
        ],
      },
      deals: {
        pipelineName: 'Property Sales Pipeline',
        pipelineStages: [
          { name: 'Inquiry', probability: 10 },
          { name: 'Site Visit Scheduled', probability: 25 },
          { name: 'Negotiation', probability: 50 },
          { name: 'Token Paid', probability: 70 },
          { name: 'Agreement', probability: 85 },
          { name: 'Registered', probability: 95 },
          { name: 'Won', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
        customFields: [
          field('projectName', 'Project Name', 'Text'),
          field('unitNumber', 'Unit Number', 'Text'),
          field('carpetArea', 'Carpet Area', 'Text'),
          field('agreementValue', 'Agreement Value', 'Currency'),
          field('expectedRegistrationDate', 'Expected Registration Date', 'Date'),
        ],
      },
      tasks: {
        customFields: [
          field('visitType', 'Visit Type', 'Picklist', 'Site Visit', 'Document Collection', 'Loan Follow-up'),
        ],
      },
    },
  },

  services: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Member', plural: 'Members' },
      tasks: { singular: 'Appointment', plural: 'Appointments' },
      deals: { singular: 'Membership', plural: 'Memberships' },
    },
    modules: {
      people: {
        customFields: [
          field('membershipPlan', 'Membership Plan', 'Picklist', 'Basic', 'Standard', 'Premium', 'VIP'),
          field('membershipStart', 'Membership Start', 'Date'),
          field('membershipExpiry', 'Membership Expiry', 'Date'),
          field('preferredTrainer', 'Preferred Trainer', 'Text'),
          field('visitCount', 'Visit Count', 'Integer'),
        ],
        tags: ['Active', 'Expired', 'Trial'],
      },
      tasks: {
        taskStatuses: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
        customFields: [
          field('serviceType', 'Service Type', 'Picklist', 'Haircut', 'PT Session', 'Class', 'Consultation'),
          field('duration', 'Duration (minutes)', 'Integer'),
          field('station', 'Station / Room', 'Text'),
        ],
      },
      deals: {
        pipelineName: 'Membership Pipeline',
        pipelineStages: [
          { name: 'Inquiry', probability: 20 },
          { name: 'Trial', probability: 40 },
          { name: 'Upgraded', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
      },
    },
  },

  education: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Student & Parent', plural: 'Students & Parents' },
      deals: { singular: 'Application', plural: 'Applications' },
      events: { singular: 'Open Day', plural: 'Open Days & Events' },
      tasks: { singular: 'Counselor Task', plural: 'Counselor Tasks' },
    },
    modules: {
      people: {
        customFields: [
          field('gradeApplying', 'Grade Applying', 'Picklist', 'Nursery', 'Primary', 'Secondary', 'Undergraduate', 'Postgraduate'),
          field('academicYear', 'Academic Year', 'Text'),
          field('parentName', 'Parent Name', 'Text'),
          field('parentPhone', 'Parent Phone', 'Phone'),
          field('leadStage', 'Admission Stage', 'Picklist', 'Inquiry', 'Counseling', 'Applied', 'Admitted', 'Enrolled', 'Lost'),
        ],
      },
      deals: {
        pipelineName: 'Admissions Pipeline',
        pipelineStages: [
          { name: 'Inquiry', probability: 10 },
          { name: 'Counseling', probability: 25 },
          { name: 'Application Submitted', probability: 45 },
          { name: 'Interview', probability: 65 },
          { name: 'Offer', probability: 85 },
          { name: 'Enrolled', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
        customFields: [
          field('course', 'Course', 'Text'),
          field('campus', 'Campus', 'Text'),
          field('scholarshipEligible', 'Scholarship Eligible', 'Checkbox'),
        ],
      },
      events: {
        customFields: [
          field('eventType', 'Event Type', 'Picklist', 'Open Day', 'Webinar', 'Campus Tour'),
          field('targetGrade', 'Target Grade', 'Text'),
        ],
      },
      tasks: {
        customFields: [
          field('counselorNotes', 'Counselor Notes', 'Text-Area'),
          field('documentType', 'Document Type', 'Picklist', 'Transcript', 'ID Proof', 'Fee Receipt'),
        ],
      },
    },
  },

  healthcare: {
    version: 1,
    enabledApps: ['SALES'],
    optionalApps: ['HELPDESK'],
    moduleLabels: {
      people: { singular: 'Patient', plural: 'Patients' },
      tasks: { singular: 'Appointment', plural: 'Appointments' },
      deals: { singular: 'Treatment Plan', plural: 'Treatment Plans' },
    },
    modules: {
      people: {
        customFields: [
          field('patientId', 'Patient ID', 'Text'),
          field('dateOfBirth', 'Date of Birth', 'Date'),
          field('bloodGroup', 'Blood Group', 'Picklist', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
          field('primaryPhysician', 'Primary Physician', 'Text'),
          field('insuranceProvider', 'Insurance Provider', 'Text'),
        ],
        tags: ['New', 'Returning', 'Chronic Care'],
      },
      tasks: {
        taskStatuses: ['Scheduled', 'Checked-in', 'Completed', 'No-show', 'Cancelled'],
        customFields: [
          field('appointmentType', 'Appointment Type', 'Picklist', 'Consultation', 'Follow-up', 'Procedure', 'Lab'),
          field('room', 'Room', 'Text'),
          field('duration', 'Duration (minutes)', 'Integer'),
        ],
      },
    },
  },

  saas: {
    version: 1,
    enabledApps: ['SALES'],
    optionalApps: ['MARKETING'],
    moduleLabels: {
      people: { singular: 'Contact', plural: 'Contacts' },
      organizations: { singular: 'Account', plural: 'Accounts' },
      deals: { singular: 'Opportunity', plural: 'Opportunities' },
      tasks: { singular: 'Delivery Task', plural: 'Delivery Tasks' },
    },
    modules: {
      organizations: {
        organizationTypes: ['Prospect', 'Customer', 'Partner'],
        customFields: [
          field('annualContractValue', 'Annual Contract Value', 'Currency'),
          field('techStack', 'Tech Stack', 'Text'),
          field('contractRenewalDate', 'Contract Renewal Date', 'Date'),
        ],
      },
      people: {
        customFields: [
          field('contactRole', 'Contact Role', 'Picklist', 'Decision Maker', 'Champion', 'Billing Contact', 'Technical Contact'),
        ],
      },
      deals: {
        pipelineName: 'SaaS Sales Pipeline',
        pipelineStages: [
          { name: 'Discovery', probability: 15 },
          { name: 'Demo', probability: 30 },
          { name: 'Proposal', probability: 50 },
          { name: 'Negotiation', probability: 75 },
          { name: 'Closed Won', status: 'won', probability: 100 },
          { name: 'Closed Lost', status: 'lost', probability: 0 },
        ],
        customFields: [
          field('mrr', 'MRR', 'Currency'),
          field('arr', 'ARR', 'Currency'),
          field('contractTerm', 'Contract Term (months)', 'Integer'),
          field('champion', 'Champion', 'Text'),
          field('competitor', 'Competitor', 'Text'),
        ],
      },
      tasks: {
        customFields: [
          field('deliveryPhase', 'Delivery Phase', 'Picklist', 'Kickoff', 'Implementation', 'Training', 'Go-live'),
        ],
      },
    },
  },

  audit: {
    version: 1,
    enabledApps: ['AUDIT', 'SALES'],
    moduleLabels: {
      assignments: { singular: 'Inspection', plural: 'Inspections' },
      people: { singular: 'Site Contact', plural: 'Site Contacts' },
      organizations: { singular: 'Client Site', plural: 'Client Sites' },
    },
    modules: {
      organizations: {
        organizationTypes: ['Client', 'Site Owner', 'Regulatory Body'],
      },
      people: {
        customFields: [
          field('siteRole', 'Site Role', 'Picklist', 'Site Manager', 'Safety Officer', 'Facility Manager'),
        ],
      },
    },
  },

  automotive: {
    version: 1,
    enabledApps: ['SALES'],
    optionalApps: ['INVENTORY'],
    moduleLabels: {
      people: { singular: 'Buyer', plural: 'Buyers' },
      organizations: { singular: 'Partner', plural: 'Partners' },
      deals: { singular: 'Vehicle Sale', plural: 'Vehicle Sales' },
      items: { singular: 'Vehicle', plural: 'Vehicles' },
      events: { singular: 'Test Drive', plural: 'Test Drives' },
    },
    modules: {
      organizations: {
        organizationTypes: ['OEM', 'Finance Partner', 'Insurance Partner', 'Corporate Fleet'],
      },
      people: {
        customFields: [
          field('licenseNumber', 'License Number', 'Text'),
          field('interestedModel', 'Interested Model', 'Text'),
          field('tradeInVehicle', 'Trade-in Vehicle', 'Text'),
        ],
      },
      deals: {
        pipelineName: 'Vehicle Sales Pipeline',
        pipelineStages: [
          { name: 'Inquiry', probability: 10 },
          { name: 'Test Drive', probability: 25 },
          { name: 'Quote', probability: 50 },
          { name: 'Finance Approved', probability: 75 },
          { name: 'Delivery', probability: 90 },
          { name: 'Won', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
        customFields: [
          field('vin', 'VIN', 'Text'),
          field('exShowroomPrice', 'Ex-Showroom Price', 'Currency'),
          field('discount', 'Discount', 'Currency'),
          field('deliveryDate', 'Delivery Date', 'Date'),
          field('financingRequired', 'Financing Required', 'Checkbox'),
        ],
      },
      events: {
        customFields: [
          field('testDriveModel', 'Test Drive Model', 'Text'),
          field('testDriveLocation', 'Test Drive Location', 'Text'),
        ],
      },
    },
  },

  events: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Client & Vendor', plural: 'Clients & Vendors' },
      organizations: { singular: 'Venue & Vendor', plural: 'Venues & Vendors' },
      events: { singular: 'Client Event', plural: 'Client Events' },
      deals: { singular: 'Event Contract', plural: 'Event Contracts' },
      tasks: { singular: 'Run-sheet Task', plural: 'Run-sheet Tasks' },
    },
    modules: {
      events: {
        customFields: [
          field('eventType', 'Event Type', 'Picklist', 'Wedding', 'Corporate', 'Concert', 'Exhibition'),
          field('venue', 'Venue', 'Text'),
          field('guestCount', 'Guest Count', 'Integer'),
          field('eventBudget', 'Budget', 'Currency'),
          field('eventDate', 'Event Date', 'Date'),
        ],
        eventStatuses: ['Planning', 'Confirmed', 'Live', 'Wrapped', 'Cancelled'],
      },
      deals: {
        pipelineName: 'Event Contract Pipeline',
        pipelineStages: [
          { name: 'Proposal', probability: 20 },
          { name: 'Contract Signed', probability: 50 },
          { name: 'Deposit Received', probability: 75 },
          { name: 'Final Payment', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
      },
      tasks: {
        customFields: [
          field('runSheetPhase', 'Run-sheet Phase', 'Picklist', 'T-30 Days', 'T-7 Days', 'T-1 Day', 'Event Day'),
        ],
      },
    },
  },

  field_service: {
    version: 1,
    enabledApps: ['SALES'],
    moduleLabels: {
      people: { singular: 'Site Contact', plural: 'Site Contacts' },
      organizations: { singular: 'Service Site', plural: 'Service Sites' },
      tasks: { singular: 'Service Visit', plural: 'Service Visits' },
      deals: { singular: 'Service Contract', plural: 'Service Contracts' },
    },
    modules: {
      organizations: {
        organizationTypes: ['Commercial Site', 'Residential Account', 'Corporate Account'],
        customFields: [
          field('serviceAddress', 'Service Address', 'Text-Area'),
          field('accessInstructions', 'Access Instructions', 'Text-Area'),
          field('contractTier', 'Contract Tier', 'Picklist', 'Basic', 'Standard', 'Premium'),
        ],
      },
      tasks: {
        taskStatuses: ['Scheduled', 'En Route', 'In Progress', 'Completed', 'Cancelled'],
        customFields: [
          field('serviceType', 'Service Type', 'Picklist', 'Initial Treatment', 'Recurring Visit', 'Emergency Call-out'),
          field('serviceWindow', 'Service Window', 'Text'),
          field('technician', 'Technician', 'Text'),
          field('chemicalsUsed', 'Chemicals Used', 'Text'),
          field('nextVisitDate', 'Next Visit Date', 'Date'),
        ],
      },
      deals: {
        pipelineName: 'Service Contract Pipeline',
        pipelineStages: [
          { name: 'Quote', probability: 25 },
          { name: 'Contract Sent', probability: 50 },
          { name: 'Won', status: 'won', probability: 100 },
          { name: 'Lost', status: 'lost', probability: 0 },
        ],
      },
    },
  },
});

function getVerticalPreset(templateKey) {
  const key = String(templateKey || 'sales_default').trim();
  return VERTICAL_PRESETS[key] || VERTICAL_PRESETS.sales_default;
}

module.exports = {
  VERTICAL_PRESETS,
  getVerticalPreset,
};
