const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { applyProjectionFilter } = require('../utils/appProjectionQuery');
const { getProjection } = require('../utils/moduleProjectionResolver');
const { mapOrganizationToSurface } = require('../utils/mappers/mapOrganizationToSurface');

const websiteHostnamePattern = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function isMasterLikeRequest(req, currentTenantOrg) {
  const orgName = String(currentTenantOrg?.name || '').trim().toLowerCase();
  const userEmail = String(req?.user?.email || '').trim().toLowerCase();
  const isInternalEmail =
    userEmail.endsWith('@arivusystems.com')
    || userEmail.endsWith('@arivu.com')
    || userEmail.endsWith('@arivu.io');
  return orgName === 'arivu master' || orgName.includes('arivu master') || isInternalEmail;
}

function isValidWebsite(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return true;

  const value = rawValue.trim();
  if (!value) return true;

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return websiteHostnamePattern.test(parsed.hostname);
  } catch (error) {
    return false;
  }
}

// Create (Sales organization)
exports.create = async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get user name for activity log (if user is authenticated)
    let userName = 'System';
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id).select('firstName lastName username');
      if (user) {
        userName = (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
      }
    }
    
    const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const { standardPayload, customFieldsSet } = extractCustomFields(req.body, Organization);

    const body = {
      ...standardPayload,
      // Set createdBy from authenticated user
      createdBy: req.user?._id || null,
      // Default assignedTo to creator if not provided (similar to tasks)
      assignedTo: standardPayload.assignedTo || req.user?._id || null,
      // Mark as Sales organization (not tenant)
      isTenant: false,
      ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user?._id || null,
        action: 'created this record',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };
    
    const org = await Organization.create(body);
    
    // Compute derived status (non-blocking)
    const { computeAndSetDerivedStatus } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    await computeAndSetDerivedStatus('organization', org, appKey);
    
    // Save if derivedStatus was computed
    if (org.derivedStatus !== undefined) {
      await org.save();
    }

    try {
      const { emitOrganizationEvents } = require('../services/domainEventHelpers');
      emitOrganizationEvents({
        previous: null,
        current: org.toObject ? org.toObject() : org,
        appKey,
        triggeredBy: req.user?._id ?? null,
        organizationId: req.user?.organizationId ?? null
      });
    } catch (emitErr) {
      console.error('[organizationV2Controller] emitOrganizationEvents on create failed:', emitErr?.message || emitErr);
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const tenantOrganizationId = req.user?.organizationId;
      if (tenantOrganizationId) {
        const fresh = await Organization.findById(org._id);
        if (fresh) {
          await runImmediateAssignmentForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            triggerSource: 'immediate',
            changedFields: [],
            tenantOrganizationId
          });
          await enqueueAssignmentJobsForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            changedFields: [],
            tenantOrganizationId
          });
        }
      }
    } catch (assignErr) {
      console.error('[organizationV2Controller] assignment on create failed:', assignErr?.message || assignErr);
    }
    
    const createdOrg = await Organization.findById(org._id);
    res.status(201).json({ success: true, data: flattenCustomFieldsForResponse(createdOrg || org) });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating organization', error: error.message });
  }
};

// List (Sales organizations only)
// CRITICAL: Filter by tenant organization context to prevent data leakage
// Sales organizations created by users from tenant org A should only be visible to users from tenant org A
exports.list = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    const currentTenantOrg = await Organization.findById(tenantOrganizationId)
      .select('name')
      .lean();
    const isMasterOrganization = isMasterLikeRequest(req, currentTenantOrg);

    // Build query:
    // - Organizations module is business-record scope only.
    // - Always exclude tenant/platform organizations from this module list.
    // - Regular tenants: business orgs created by their users only.
    // - Master-like users: all business orgs, regardless of createdBy.
    let query = { deletedAt: null };
    if (isMasterOrganization) {
      query.isTenant = false;
    } else {
      query.createdBy = { $in: userIds };
      query.isTenant = false;
    }

    // Restrict list to specific id(s), e.g. paired contact→org UI (lookup combobox shows one org)
    if (req.query.ids) {
      const parts = String(req.query.ids)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const valid = parts.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (valid.length === 1) {
        query._id = valid[0];
      } else if (valid.length > 1) {
        query._id = { $in: valid };
      }
    }
    
    // Note: Organizations use 'types' array field, not 'type'
    // For query params, we'll filter on the types array
    if (req.query.type) {
      // Convert single type to array format for types field
      query.types = req.query.type;
    }
    // Handle search/name filter (supports both 'search' and 'name' query params)
    // Store search term to apply after projection filter to avoid conflicts
    let searchFilter = null;
    const searchTerm = req.query.search || req.query.name;
    if (searchTerm && searchTerm.trim()) {
      const trimmedSearch = searchTerm.trim();
      searchFilter = { name: new RegExp(trimmedSearch, 'i') };
      console.log('[organizationV2Controller] Search term received:', trimmedSearch);
    }
    
    // Handle assignedTo filter (identity-based filter for saved views)
    // NOTE: This must be applied AFTER projection filter to avoid conflicts
    // We'll store it separately and apply it after projection
    let assignedToFilter = null;
    if (req.query.assignedTo !== undefined) {
      if (req.query.assignedTo === 'null' || req.query.assignedTo === null || req.query.assignedTo === '') {
        // Filter for unassigned (null or missing)
        assignedToFilter = {
          $or: [
            { assignedTo: null },
            { assignedTo: { $exists: false } }
          ]
        };
      } else {
        // Filter for specific user
        assignedToFilter = { assignedTo: req.query.assignedTo };
      }
    }
    
    // Handle isActive filter (boolean)
    if (req.query.isActive !== undefined) {
      if (req.query.isActive === 'true' || req.query.isActive === true) {
        query.isActive = true;
      } else if (req.query.isActive === 'false' || req.query.isActive === false) {
        query.isActive = false;
      }
    }
    
    // Handle other filters
    if (req.query.industry) query.industry = req.query.industry;
    if (req.query.tier) {
      // Handle subscription tier filter
      query['subscription.tier'] = req.query.tier;
    }
    if (req.query.status) {
      // Handle subscription status filter
      query['subscription.status'] = req.query.status;
    }

    // Phase 2A.2: Apply projection filter (read-time filtering only)
    // SAFETY: Projection filtering is read-only.
    // SAFETY: No record ownership or permissions are enforced here.
    const appKey = req.appKey || 'SALES'; // From resolveAppContext middleware
    const moduleKey = 'organizations';
    const projectionMeta = getProjection(appKey, moduleKey);
    
    // Debug logging
    console.log('[organizationV2Controller] Before projection filter:', {
      appKey,
      moduleKey,
      hasProjection: !!projectionMeta,
      queryBefore: JSON.stringify(query, null, 2),
      assignedToFilter: req.query.assignedTo,
      userIds: userIds.length
    });
    
    query = applyProjectionFilter({
      appKey,
      moduleKey,
      baseQuery: query,
      projectionMeta
    });
    
    // Apply search filter AFTER projection filter to avoid conflicts
    // Combine with assignedTo filter if both exist
    if (searchFilter || assignedToFilter) {
      // If query already has $or (from projection), we need to combine with $and
      if (query.$or) {
        const conditionsToAdd = [];
        if (searchFilter) conditionsToAdd.push(searchFilter);
        if (assignedToFilter) conditionsToAdd.push(assignedToFilter);
        
        // Combine existing $or with search and assignedTo filters using $and
        query.$and = [
          { $or: query.$or },
          ...conditionsToAdd
        ];
        delete query.$or; // Remove the old $or since we've moved it to $and
        console.log('[organizationV2Controller] Combined $or with search/assignedTo using $and');
      } else if (query.$and) {
        // If $and already exists, add to it
        if (searchFilter) query.$and.push(searchFilter);
        if (assignedToFilter) query.$and.push(assignedToFilter);
        console.log('[organizationV2Controller] Added search/assignedTo to existing $and');
      } else {
        // No existing $or or $and, just add the filters directly
        if (searchFilter) {
          Object.assign(query, searchFilter);
          console.log('[organizationV2Controller] Search filter applied directly');
        }
        if (assignedToFilter) {
          // If assignedToFilter has $or, we need to merge it properly
          if (assignedToFilter.$or) {
            query.$or = assignedToFilter.$or;
          } else {
            Object.assign(query, assignedToFilter);
          }
          console.log('[organizationV2Controller] AssignedTo filter applied directly');
        }
      }
    }
    
    // Debug: Log final query
    if (searchFilter || assignedToFilter) {
      console.log('[organizationV2Controller] Final query after all filters:', JSON.stringify(query, null, 2));
      if (searchFilter) {
        console.log('[organizationV2Controller] Search filter:', JSON.stringify(searchFilter, null, 2));
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Handle sort
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const data = await Organization.find(query)
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username')
      .sort(sort)
      .limit(limit)
      .skip(skip);
    const total = await Organization.countDocuments(query);
    
    // Debug logging
    const orgIds = data.map(org => ({
      _id: org._id.toString(),
      name: org.name,
      assignedTo: org.assignedTo ? (org.assignedTo._id ? org.assignedTo._id.toString() : org.assignedTo.toString()) : null
    }));
    
    console.log('[organizationV2Controller] Query result:', {
      dataLength: data.length,
      total,
      page,
      limit,
      assignedToFilter: req.query.assignedTo,
      query: JSON.stringify(query, null, 2),
      returnedOrgIds: orgIds
    });
    
    // Convert Mongoose documents to plain objects
    const plainData = data.map(doc => doc.toObject ? doc.toObject() : doc);
    
    const response = { 
      success: true, 
      data: plainData,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: limit
      },
      meta: { page, limit, total } // Keep for backward compatibility
    };
    
    // Debug logging - log the actual response object structure
    console.log('[organizationV2Controller] Response object:', JSON.stringify({
      success: response.success,
      dataLength: response.data.length,
      hasPagination: !!response.pagination,
      pagination: response.pagination,
      hasMeta: !!response.meta,
      meta: response.meta,
      responseKeys: Object.keys(response)
    }, null, 2));
    
    // Return response with pagination object (matching ModuleList expectations)
    res.json(response);
  } catch (error) {
    console.error('Error listing Sales organizations:', error);
    res.status(500).json({ success: false, message: 'Error fetching organizations', error: error.message });
  }
};

// Get by ID (Sales organization, filtered by tenant context)
exports.getById = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    // Only allow access to Sales organizations created by users from this tenant
    const org = await Organization.findOne({ 
      _id: req.params.id, 
      isTenant: false,
      createdBy: { $in: userIds },
      deletedAt: null
    })
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username');
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    res.json({ success: true, data: flattenCustomFieldsForResponse(org) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organization', error: error.message });
  }
};

// Update (Sales organization, filtered by tenant context)
exports.update = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    const { buildUpdateWithCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const previous = await Organization.findOne({
      _id: req.params.id,
      isTenant: false,
      deletedAt: null,
      createdBy: { $in: userIds }
    }).lean();

    const $set = buildUpdateWithCustomFields(req.body, Organization);

    // Only allow update of Sales organizations created by users from this tenant
    const updated = await Organization.findOneAndUpdate(
      { 
        _id: req.params.id, 
        isTenant: false,
        deletedAt: null,
        createdBy: { $in: userIds } // CRITICAL: Filter by tenant context
      }, 
      { $set }, 
      { new: true }
    )
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username');
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });

    try {
      const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
      const ModuleDefinition = require('../models/ModuleDefinition');
      const moduleDef = await ModuleDefinition.findOne({ organizationId: tenantOrganizationId, key: 'organizations' });
      await appendFieldChangeLogs({
        organizationId: tenantOrganizationId,
        moduleKey: 'organizations',
        recordId: req.params.id,
        authorId: req.user._id,
        previous: previous || {},
        updated: updated.toObject ? updated.toObject() : updated,
        updateDataKeys: Object.keys(req.body || {}),
        fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
      });
    } catch (logErr) {
      console.warn('Record activity log (organization update) failed:', logErr?.message || logErr);
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const assignDoc = await Organization.findById(updated._id);
      if (assignDoc) {
        const changedKeys = Object.keys(req.body || {});
        await runImmediateAssignmentForSalesRecord({
          record: assignDoc,
          moduleKey: 'organizations',
          actorId: req.user._id,
          triggerSource: 'immediate',
          changedFields: changedKeys,
          tenantOrganizationId
        });
        await enqueueAssignmentJobsForSalesRecord({
          record: assignDoc,
          moduleKey: 'organizations',
          actorId: req.user._id,
          changedFields: changedKeys,
          tenantOrganizationId
        });
      }
    } catch (assignErr) {
      console.error('[organizationV2Controller] assignment on update failed:', assignErr?.message || assignErr);
    }

    const out = await Organization.findById(updated._id)
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username');
    res.json({ success: true, data: flattenCustomFieldsForResponse(out || updated) });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error updating organization', error: error.message });
  }
};

// Delete (Sales organization only - move to trash)
exports.remove = async (req, res) => {
  try {
    const tenantOrganizationId = req.user?.organizationId;
    if (!tenantOrganizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'organizations',
      recordId: req.params.id,
      organizationId: tenantOrganizationId,
      userId: req.user._id,
      appKey: req.body?.appKey || 'SALES',
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed
    });

    if (!result.ok) {
      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          dependencies: result.dependencies,
          message: result.message
        });
      }
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to delete organization'
      });
    }
    res.json({ success: true, data: req.params.id, message: 'Moved to trash', retentionExpiresAt: result.retentionExpiresAt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting organization', error: error.message });
  }
};

// Get activity logs for an organization (filtered by tenant context)
exports.getActivityLogs = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    // Only allow access to activity logs of Sales organizations created by users from this tenant
    const org = await Organization.findOne({ 
      _id: req.params.id, 
      isTenant: false,
      createdBy: { $in: userIds },
      deletedAt: null
    }).select('activityLogs');
    
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }
    
    // Sort by timestamp (newest first)
    const logs = (org.activityLogs || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
};

// Add activity log to an organization (filtered by tenant context)
exports.addActivityLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    
    if (!user || !action) {
      return res.status(400).json({
        success: false,
        message: 'User and action are required'
      });
    }
    
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);
    
    // Only allow adding activity logs to Sales organizations created by users from this tenant
    const org = await Organization.findOneAndUpdate(
      { 
        _id: req.params.id, 
        isTenant: false,
        createdBy: { $in: userIds } // CRITICAL: Filter by tenant context
      },
      {
        $push: {
          activityLogs: {
            user: user,
            userId: req.user?._id || null,
            action: action,
            details: details || null,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }
    
    // Return the newly added log
    const newLog = org.activityLogs[org.activityLogs.length - 1];
    
    res.status(200).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    console.error('Add activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding activity log',
      error: error.message
    });
  }
};

/**
 * Get Editable Organization Data
 * GET /api/organizations/:id/editable
 * 
 * ARCHITECTURAL INTENT:
 * Returns ONLY editable business fields for CreateOrganizationSurface edit mode.
 * 
 * MUST:
 * - Return ONLY: name, address, website, phone, industry, types
 * - Reject tenant organizations (isTenant: false only)
 * - Filter by tenant context (createdBy must be from tenant)
 * 
 * MUST NOT:
 * - Return tenant fields (subscription, limits, enabledApps, etc.)
 * - Return system fields (createdBy, assignedTo, etc.)
 * - Return app participation data
 * 
 * If API returns forbidden fields → show generic error (defensive UX)
 */
exports.getEditable = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    // Fetch organization - MUST be business org (isTenant: false)
    const org = await Organization.findOne({ 
      _id: req.params.id, 
      isTenant: false, // CRITICAL: Reject tenant orgs
      createdBy: { $in: userIds } // CRITICAL: Filter by tenant context
    }).lean();
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be edited via this endpoint' 
      });
    }
    
    // Return ONLY editable business fields
    const editableData = {
      name: org.name || '',
      address: org.address || '',
      website: org.website || '',
      phone: org.phone || '',
      industry: org.industry || '',
      types: org.types || []
    };
    
    res.json({
      success: true,
      data: editableData
    });
  } catch (error) {
    console.error('Error fetching editable organization:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching organization data',
      error: error.message 
    });
  }
};

/**
 * Update Business Organization
 * PATCH /api/organizations/:id
 * 
 * ARCHITECTURAL INTENT:
 * Updates ONLY editable business fields for CreateOrganizationSurface edit mode.
 * 
 * MUST:
 * - Accept business-editable fields (including custom fields) while blocking tenant/system fields
 * - Reject tenant organizations (isTenant: false only)
 * - Filter by tenant context (createdBy must be from tenant)
 * - Ignore any extra fields silently
 * - Reject tenant-only fields if provided
 * 
 * MUST NOT:
 * - Accept tenant fields (subscription, limits, enabledApps, etc.)
 * - Accept system fields (createdBy, assignedTo, etc.)
 * - Accept app participation data
 */
exports.update = async (req, res) => {
  try {
    const User = require('../models/User');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    // Fetch organization - MUST be business org (isTenant: false)
    const org = await Organization.findOne({ 
      _id: req.params.id, 
      isTenant: false, // CRITICAL: Reject tenant orgs
      createdBy: { $in: userIds } // CRITICAL: Filter by tenant context
    });
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be edited via this endpoint' 
      });
    }
    
    // Block tenant/system/infrastructure fields from generic record-page updates.
    // All other business fields (including custom fields) are allowed.
    const blockedFields = new Set([
      '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy',
      'deletedAt', 'deletedBy', 'deletionReason', 'activityLogs', 'legacyOrganizationId',
      'subscription', 'limits', 'enabledApps', 'enabledModules', 'slug', 'settings', 'security',
      'billing', 'isTenant', 'database', 'integrations', 'moduleOverrides', 'crmInitialized', 'dataRegion'
    ]);

    const updatePayload = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (blockedFields.has(key)) continue;
      updatePayload[key] = value;
    }

    if (updatePayload.website !== undefined) {
      if (typeof updatePayload.website !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Website must be a string',
          errors: { website: 'Website must be a string' }
        });
      }

      updatePayload.website = updatePayload.website.trim();
      if (updatePayload.website && !isValidWebsite(updatePayload.website)) {
        return res.status(400).json({
          success: false,
          message: 'Website must be a valid URL',
          errors: { website: 'Enter a valid website URL (e.g., example.com or https://example.org)' }
        });
      }
    }
    
    // REJECT tenant-only fields if provided
    const tenantOnlyFields = [
      'subscription', 'limits', 'enabledApps', 'enabledModules',
      'slug', 'settings', 'security', 'billing', 'isTenant'
    ];
    
    const providedTenantFields = tenantOnlyFields.filter(field => req.body[field] !== undefined);
    if (providedTenantFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tenant-only fields are not allowed: ${providedTenantFields.join(', ')}`,
        errors: { _general: 'Tenant-only fields cannot be updated' }
      });
    }
    
    // Validate status write protection (if config exists, block direct status writes)
    // Note: This endpoint only allows specific fields, but check for completeness
    const { validateStatusWriteProtection } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    const statusWriteProtectionResult = await validateStatusWriteProtection('organization', updatePayload, appKey);
    
    if (statusWriteProtectionResult && !statusWriteProtectionResult.valid) {
      return res.status(400).json({
        success: false,
        code: statusWriteProtectionResult.code,
        message: statusWriteProtectionResult.message,
        errors: statusWriteProtectionResult.errors
      });
    }
    
    // Validate status invariant (fail-closed: block if status !== derivedStatus when config exists)
    const { validateStatusInvariant } = require('../services/systemInvariants');
    const statusInvariantResult = await validateStatusInvariant({
      moduleKey: 'organizations',
      recordId: req.params.id,
      organizationId: tenantOrganizationId,
      updateData: updatePayload,
      appKey
    });
    
    if (!statusInvariantResult.valid) {
      return res.status(400).json({
        success: false,
        code: statusInvariantResult.code,
        message: statusInvariantResult.message,
        errors: statusInvariantResult.errors
      });
    }
    
    // Validate type mutation invariants if types are being updated
    if (updatePayload.types !== undefined && Array.isArray(updatePayload.types)) {
      const { validateTypeMutation, validateRoleInvariant } = require('../services/systemInvariants');
      
      // Validate type mutation (additive only)
      const typeMutationResult = await validateTypeMutation({
        moduleKey: 'organizations',
        recordId: req.params.id,
        organizationId: tenantOrganizationId,
        updateData: { types: updatePayload.types }
      });
      
      if (!typeMutationResult.valid) {
        return res.status(400).json({
          success: false,
          code: typeMutationResult.code,
          message: typeMutationResult.message,
          errors: typeMutationResult.errors
        });
      }
      
      // Validate role invariant if primaryContact is also being updated
      if (updatePayload.primaryContact !== undefined) {
        const roleInvariantResult = await validateRoleInvariant({
          moduleKey: 'organizations',
          recordId: req.params.id,
          organizationId: tenantOrganizationId,
          updateData: { types: updatePayload.types, primaryContact: updatePayload.primaryContact }
        });
        
        if (!roleInvariantResult.valid) {
          return res.status(400).json({
            success: false,
            code: roleInvariantResult.code,
            message: roleInvariantResult.message,
            errors: roleInvariantResult.errors
          });
        }
      }
    }
    
    // Snapshot before mutation (for domain events)
    const previousSnapshot = org.toObject ? org.toObject() : { ...org };

    // Update only allowed fields
    let hasChanges = false;
    const updatedKeys = [];
    Object.entries(updatePayload).forEach(([field, fieldValue]) => {
      if (fieldValue !== undefined) {
        // Handle array fields specially
        if (field === 'types' || field === 'tags') {
          if (Array.isArray(fieldValue)) {
            const nextArray = field === 'tags'
              ? fieldValue.map((tag) => String(tag || '').trim()).filter(Boolean)
              : fieldValue;
            const currentArray = Array.isArray(org[field]) ? org[field] : [];
            if (JSON.stringify(currentArray) !== JSON.stringify(nextArray)) {
              org[field] = nextArray;
              hasChanges = true;
              updatedKeys.push(field);
            }
          }
        } else if (Array.isArray(fieldValue)) {
          const currentArray = Array.isArray(org[field]) ? org[field] : [];
          if (JSON.stringify(currentArray) !== JSON.stringify(fieldValue)) {
            org[field] = fieldValue;
            hasChanges = true;
            updatedKeys.push(field);
          }
        } else if (field === 'description') {
          if (!org.customFields || typeof org.customFields !== 'object') {
            org.customFields = {};
          }
          const nextDescription = fieldValue == null ? '' : String(fieldValue);
          const currentDescription = org.customFields?.description == null ? '' : String(org.customFields.description);
          if (currentDescription !== nextDescription) {
            org.customFields.description = nextDescription;
            // customFields is Mixed; mark modified so Mongoose persists nested updates.
            org.markModified('customFields');
            hasChanges = true;
            updatedKeys.push(field);
          }
        } else {
          // For other fields, allow empty strings (will be stored as empty)
          const newValue = fieldValue !== null ? (fieldValue || '') : '';
          if (org[field] !== newValue) {
            org[field] = newValue;
            hasChanges = true;
            updatedKeys.push(field);
          }
        }
      }
    });
    
    // Validate required field
    if (org.name === undefined || org.name === null || org.name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
        errors: { name: 'Name is required' }
      });
    }
    
    // Only save if there are changes
    if (hasChanges) {
      // Trim name
      org.name = org.name.trim();

      // Generic description versioning: push previous content before saving new description.
      if (updatedKeys.includes('description')) {
        try {
          const prevDesc = String(previousSnapshot?.description ?? previousSnapshot?.customFields?.description ?? '');
          const nextDesc = String(org.customFields?.description ?? org.description ?? '');
          if (prevDesc !== nextDesc) {
            if (!Array.isArray(org.descriptionVersions)) org.descriptionVersions = [];
            org.descriptionVersions.push({
              content: prevDesc,
              createdAt: new Date(),
              createdBy: req.user?._id
            });
          }
        } catch (versionErr) {
          console.warn('Description version push (organization) failed:', versionErr?.message || versionErr);
        }
      }
      
      // Get user name for activity log
      let userName = 'System';
      if (req.user && req.user._id) {
        const user = await User.findById(req.user._id).select('firstName lastName username');
        if (user) {
          userName = (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
        }
      }
      
      // Add activity log
      if (!org.activityLogs) {
        org.activityLogs = [];
      }
      org.activityLogs.push({
        user: userName,
        userId: req.user?._id || null,
        action: 'updated this record',
        details: { type: 'update', fields: updatedKeys },
        timestamp: new Date()
      });

      try {
        const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
        const ModuleDefinition = require('../models/ModuleDefinition');
        const moduleDef = await ModuleDefinition.findOne({ organizationId: tenantOrganizationId, key: 'organizations' });
        await appendFieldChangeLogs({
          organizationId: tenantOrganizationId,
          moduleKey: 'organizations',
          recordId: req.params.id,
          authorId: req.user._id,
          previous: previousSnapshot,
          updated: org.toObject ? org.toObject() : { ...org },
          updateDataKeys: updatedKeys,
          fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
        });
      } catch (logErr) {
        console.warn('Record activity log (organization update) failed:', logErr?.message || logErr);
      }
      
      // Check if lifecycle or type fields changed and compute derived status
      const { hasLifecycleOrTypeChanged, computeAndSetDerivedStatus, hasConfiguration } = require('../services/derivedStatusService');
      const shouldComputeDerivedStatus = hasLifecycleOrTypeChanged('organization', org, updatePayload);
      const appKey = req.appKey || req.query.appKey || 'SALES';
      
      await org.save();
      
      // Compute derived status if lifecycle/type fields changed
      if (shouldComputeDerivedStatus) {
        const computedDerivedStatus = await computeAndSetDerivedStatus('organization', org, appKey);
        
        // If config exists and derivedStatus was computed, update status field to match
        const configExists = await hasConfiguration('organization', appKey);
        if (configExists && computedDerivedStatus) {
          // Update the appropriate status field based on types
          // For organizations, we need to determine which status field to update
          // based on the types array (customerStatus, partnerStatus, vendorStatus)
          if (org.types && org.types.length > 0) {
            const firstType = org.types[0].toLowerCase();
            if (firstType === 'customer' && org.customerStatus !== computedDerivedStatus) {
              org.customerStatus = computedDerivedStatus;
            } else if (firstType === 'partner' && org.partnerStatus !== computedDerivedStatus) {
              org.partnerStatus = computedDerivedStatus;
            } else if (firstType === 'vendor' && org.vendorStatus !== computedDerivedStatus) {
              org.vendorStatus = computedDerivedStatus;
            }
          }
        }
        
        // Save if derivedStatus or status was updated
        if (org.derivedStatus !== undefined && org.isModified('derivedStatus')) {
          await org.save();
        } else if (org.isModified('customerStatus') || org.isModified('partnerStatus') || org.isModified('vendorStatus')) {
          await org.save();
        }
      }

      try {
        const { emitOrganizationEvents } = require('../services/domainEventHelpers');
        emitOrganizationEvents({
          previous: previousSnapshot,
          current: org.toObject ? org.toObject() : org,
          appKey,
          triggeredBy: req.user?._id ?? null,
          organizationId: req.user?.organizationId ?? null
        });
      } catch (emitErr) {
        console.error('[organizationV2Controller] emitOrganizationEvents on update failed:', emitErr?.message || emitErr);
      }
    }
    
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    res.json({
      success: true,
      data: flattenCustomFieldsForResponse(org)
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors || {}).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Error updating organization',
      error: error.message
    });
  }
};

// OrganizationSurface API
// Returns a curated, UI-safe projection.
// Never return the raw Organization model to the UI.
// 
// This endpoint enforces OrganizationSurface discipline:
// - Only business organizations (isTenant: false)
// - Only business context fields
// - No platform/tenant fields
// See docs/architecture/organization-surface-invariants.md
exports.getSurface = async (req, res) => {
  try {
    const User = require('../models/User');
    const People = require('../models/People');
    const RelationshipInstance = require('../models/RelationshipInstance');
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Get all users from this tenant organization
    const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
      .select('_id')
      .lean();
    const userIds = tenantUserIds.map(u => u._id);

    // Fetch organization - MUST be business org (isTenant: false)
    const org = await Organization.findOne({ 
      _id: req.params.id, 
      isTenant: false, // CRITICAL: Reject tenant orgs
      createdBy: { $in: userIds } // CRITICAL: Filter by tenant context
    })
      .populate('primaryContact', 'first_name last_name email')
      .lean();
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be accessed via OrganizationSurface' 
      });
    }
    
    // Fetch related data for surface
    
    // 1. People count and preview from relationship instances (source of truth).
    const peopleRelationshipFilter = {
      organizationId: tenantOrganizationId,
      relationshipKey: 'people_organizations',
      'source.appKey': 'sales',
      'source.moduleKey': 'people',
      'target.appKey': 'sales',
      'target.moduleKey': 'organizations',
      'target.recordId': org._id
    };

    const linkedPeopleIds = await RelationshipInstance.distinct('source.recordId', peopleRelationshipFilter);

    const peopleCount = linkedPeopleIds.length > 0
      ? await People.countDocuments({
          _id: { $in: linkedPeopleIds },
          organizationId: tenantOrganizationId
        })
      : 0;

    const recentPeopleLinks = await RelationshipInstance.find(peopleRelationshipFilter)
      .select('source.recordId createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const previewCandidateIds = [];
    const seenIds = new Set();
    for (const link of recentPeopleLinks) {
      const personId = String(link?.source?.recordId || '');
      if (!personId || seenIds.has(personId)) continue;
      seenIds.add(personId);
      previewCandidateIds.push(personId);
      if (previewCandidateIds.length >= 10) break;
    }

    const previewPeopleDocs = previewCandidateIds.length > 0
      ? await People.find({
          _id: { $in: previewCandidateIds },
          organizationId: tenantOrganizationId
        })
          .select('_id first_name last_name email role')
          .lean()
      : [];

    const previewPeopleById = new Map(
      previewPeopleDocs.map((person) => [String(person._id), person])
    );

    const peoplePreview = previewCandidateIds
      .map((personId) => previewPeopleById.get(String(personId)))
      .filter(Boolean)
      .slice(0, 5)
      .map((person) => ({
        id: person._id.toString(),
        name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Unknown',
        role: person.role || undefined
      }));
    
    // 2. App participation summary
    const apps = [];
    
    // Check SALES app participation (Deals)
    try {
      const Deal = require('../models/Deal');
      const dealCount = await Deal.countDocuments({ 
        accountId: org._id,
        organizationId: tenantOrganizationId 
      });
      
      if (dealCount > 0) {
        apps.push({
          appKey: 'SALES',
          hasWork: true,
          counts: { deals: dealCount }
        });
      }
    } catch (err) {
      // Deal model might not exist - skip
    }
    
    // Check HELPDESK app participation (Tickets/Cases)
    try {
      const Ticket = require('../models/Ticket');
      const ticketCount = await Ticket.countDocuments({ 
        organizationId: org._id,
        tenantOrganizationId: tenantOrganizationId 
      });
      
      if (ticketCount > 0) {
        apps.push({
          appKey: 'HELPDESK',
          hasWork: true,
          counts: { tickets: ticketCount }
        });
      }
    } catch (err) {
      // Ticket model might not exist - skip
    }
    
    // Check AUDIT app participation (Audits)
    try {
      const Audit = require('../models/Audit');
      const auditCount = await Audit.countDocuments({ 
        organizationId: org._id,
        tenantOrganizationId: tenantOrganizationId 
      });
      
      if (auditCount > 0) {
        apps.push({
          appKey: 'AUDIT',
          hasWork: true,
          counts: { audits: auditCount }
        });
      }
    } catch (err) {
      // Audit model might not exist - skip
    }
    
    // 3. Recent activity (limited to last 20 entries)
    // Enhance activity logs with person information when available
    const recentActivityLogs = (org.activityLogs || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20); // Limit to 20 most recent
    
    // Process activity logs and enrich with person information
    const recentActivity = await Promise.all(
      recentActivityLogs.map(async (log) => {
        const activityEntry = {
          timestamp: log.timestamp,
          user: log.user || 'System',
          userId: log.userId ? log.userId.toString() : undefined,
          action: log.action || 'unknown',
          summary: `${log.user || 'System'} ${log.action || 'performed an action'}`,
          personId: undefined,
          personName: undefined
        };
        
        // Extract person ID from action or details if available
        let personId = null;
        
        // Check if details contains person information
        if (log.details) {
          if (log.details.personId) {
            personId = log.details.personId;
          } else if (log.details.person) {
            personId = log.details.person;
          } else if (log.details.peopleId) {
            personId = log.details.peopleId;
          }
        }
        
        // Also try to extract ObjectId from action string (e.g., "created people '695d51f4f9e9e6cc9e10bf47'")
        if (!personId && log.action) {
          const objectIdMatch = log.action.match(/['"]?([0-9a-fA-F]{24})['"]?/);
          if (objectIdMatch && (log.action.includes('people') || log.action.includes('person'))) {
            personId = objectIdMatch[1];
          }
        }
        
        // Fetch person name if we have a person ID
        if (personId) {
          try {
            const person = await People.findOne({ 
              _id: personId,
              organizationId: tenantOrganizationId 
            }).select('first_name last_name email').lean();
            
            if (person) {
              activityEntry.personId = personId.toString();
              activityEntry.personName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Unknown';
            }
          } catch (err) {
            // Person not found or error fetching - continue without person info
            console.warn(`[getSurface] Could not fetch person ${personId}:`, err.message);
          }
        }
        
        return activityEntry;
      })
    );
    
    // Map to OrganizationSurfaceData projection
    const surfaceData = mapOrganizationToSurface(org, {
      peopleCount,
      peoplePreview,
      apps,
      recentActivity
    });
    
    res.json({ 
      success: true, 
      data: surfaceData 
    });
  } catch (error) {
    console.error('Error fetching organization surface:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching organization surface', 
      error: error.message 
    });
  }
};


