/**
 * ============================================================================
 * PLATFORM CORE: Global Search Service
 * ============================================================================
 * 
 * Fast, reliable search across all enabled modules for a tenant.
 * Searches: People, Organizations, Deals, Tasks, Events, Forms, Items
 * 
 * Rules:
 * - Only search enabled modules
 * - Respect organization isolation
 * - Return limited results per module (5-10)
 * - Fast response time (<200ms target)
 * - Case-insensitive search
 * 
 * ============================================================================
 */

// Lazy load models to avoid startup errors
let People, Organization, Deal, Task, Event, Form, Item;

try {
  People = require('../models/People');
  Organization = require('../models/Organization');
  Deal = require('../models/Deal');
  Task = require('../models/Task');
  Event = require('../models/Event');
} catch (error) {
  console.error('[SearchService] Error loading core models:', error);
}

try {
  Form = require('../models/Form');
} catch (error) {
  console.warn('[SearchService] Form model not available:', error.message);
}

try {
  Item = require('../models/Item');
} catch (error) {
  console.warn('[SearchService] Item model not available:', error.message);
}

class SearchService {
  /**
   * Search across all enabled modules
   * @param {String} organizationId - Organization ID
   * @param {String} query - Search query
   * @param {Object} options - Search options (limit per module, etc.)
   * @returns {Promise<Object>} Search results grouped by module type
   */
  async searchAll(organizationId, query, options = {}) {
    const limit = options.limitPerModule || 5;
    const searchRegex = new RegExp(query, 'i');
    
    // Build search promises array (only include available models)
    const searchPromises = [
      this.searchPeople(organizationId, searchRegex, limit),
      this.searchOrganizations(organizationId, searchRegex, limit),
      this.searchDeals(organizationId, searchRegex, limit),
      this.searchTasks(organizationId, searchRegex, limit),
      this.searchEvents(organizationId, searchRegex, limit)
    ];
    
    // Add optional models if available
    if (Form) {
      searchPromises.push(this.searchForms(organizationId, searchRegex, limit));
    } else {
      searchPromises.push(Promise.resolve([]));
    }
    
    if (Item) {
      searchPromises.push(this.searchItems(organizationId, searchRegex, limit));
    } else {
      searchPromises.push(Promise.resolve([]));
    }
    
    // Run all searches in parallel for speed
    const [
      people,
      organizations,
      deals,
      tasks,
      events,
      forms,
      items
    ] = await Promise.all(searchPromises);

    return {
      query,
      results: {
        people,
        organizations,
        deals,
        tasks,
        events,
        forms,
        items
      },
      total: people.length + organizations.length + deals.length + 
             tasks.length + events.length + forms.length + items.length
    };
  }

  /**
   * Search People/Contacts
   */
  async searchPeople(organizationId, searchRegex, limit) {
    try {
      const results = await People.find({
        organizationId,
        $or: [
          { first_name: searchRegex },
          { last_name: searchRegex },
          { email: searchRegex },
          { company: searchRegex },
          { phone: searchRegex }
        ]
      })
      .select('first_name last_name email company phone avatar')
      .limit(limit)
      .lean();

      return results.map(person => ({
        id: person._id,
        type: 'people',
        title: `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email,
        subtitle: person.company || person.email,
        first_name: person.first_name,
        last_name: person.last_name,
        avatar: person.avatar || null,
        route: `/people/${person._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching people:', error);
      return [];
    }
  }

  /**
   * Search Organizations (CRM entities only, not tenant organizations)
   * Note: CRM organizations are filtered by createdBy (users from tenant), not organizationId
   * This matches the pattern used in organizationV2Controller.list()
   */
  async searchOrganizations(organizationId, searchRegex, limit) {
    try {
      const User = require('../models/User');
      
      // Get all users from this tenant organization
      const tenantUserIds = await User.find({ organizationId })
        .select('_id')
        .lean();
      const userIds = tenantUserIds.map(u => u._id);
      
      if (userIds.length === 0) {
        console.log(`[SearchService] No users found for tenant organization ${organizationId}, skipping organization search`);
        return [];
      }

      // Build query matching organizationV2Controller.list() pattern
      // CRM organizations created by users from this tenant organization
      const query = {
        isTenant: false, // Only CRM organizations
        createdBy: { $in: userIds }, // Only orgs created by users from this tenant
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { website: searchRegex },
          { industry: searchRegex }
        ]
      };

      const results = await Organization.find(query)
        .select('name email website industry avatar logo image')
        .limit(limit)
        .lean();

      console.log(`[SearchService] Found ${results.length} organizations matching "${searchRegex}" for tenant ${organizationId}`);

      return results.map(org => ({
        id: org._id,
        type: 'organizations',
        title: org.name,
        subtitle: org.industry || org.email,
        avatar: org.avatar || org.logo || org.image || null,
        route: `/organizations/${org._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching organizations:', error);
      return [];
    }
  }

  /**
   * Search Deals
   */
  async searchDeals(organizationId, searchRegex, limit) {
    try {
      const results = await Deal.find({
        organizationId,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { stage: searchRegex }
        ]
      })
      .select('name description stage value currency')
      .limit(limit)
      .lean();

      return results.map(deal => ({
        id: deal._id,
        type: 'deals',
        title: deal.name,
        subtitle: `${deal.stage} • ${deal.currency || '$'}${deal.value || 0}`,
        route: `/deals/${deal._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching deals:', error);
      return [];
    }
  }

  /**
   * Search Tasks
   */
  async searchTasks(organizationId, searchRegex, limit) {
    try {
      const results = await Task.find({
        organizationId,
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ]
      })
      .select('title description status priority')
      .limit(limit)
      .lean();

      return results.map(task => ({
        id: task._id,
        type: 'tasks',
        title: task.title,
        subtitle: `${task.status} • ${task.priority || 'medium'}`,
        route: `/tasks/${task._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching tasks:', error);
      return [];
    }
  }

  /**
   * Search Events
   */
  async searchEvents(organizationId, searchRegex, limit) {
    try {
      const results = await Event.find({
        organizationId,
        $or: [
          { eventName: searchRegex }, // Events use 'eventName', not 'title'
          { notes: searchRegex }, // Events have 'notes' field
          { location: searchRegex }, // Events have 'location' field
          { eventType: searchRegex } // Events use 'eventType', not 'type'
        ]
      })
      .select('eventName eventType notes location startDateTime endDateTime')
      .limit(limit)
      .lean();

      console.log(`[SearchService] Found ${results.length} events matching "${searchRegex}" for tenant ${organizationId}`);

      return results.map(event => ({
        id: event._id,
        type: 'events',
        title: event.eventName, // Map eventName to title for display
        subtitle: event.eventType || 'Event',
        route: `/events/${event._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching events:', error);
      return [];
    }
  }

  /**
   * Search Forms
   */
  async searchForms(organizationId, searchRegex, limit) {
    if (!Form) {
      return [];
    }
    try {
      // Form model uses 'name' and 'description' fields
      const results = await Form.find({
        organizationId,
        $or: [
          { name: searchRegex },
          { description: searchRegex }
        ]
      })
      .select('name description')
      .limit(limit)
      .lean();

      return results.map(form => ({
        id: form._id,
        type: 'forms',
        title: form.name || 'Form',
        subtitle: form.description || 'Form',
        route: `/forms/${form._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching forms:', error);
      return [];
    }
  }

  /**
   * Search Items
   */
  async searchItems(organizationId, searchRegex, limit) {
    if (!Item) {
      return [];
    }
    try {
      // Item model uses 'item_name' and 'description' fields
      const results = await Item.find({
        organizationId,
        $or: [
          { item_name: searchRegex },
          { description: searchRegex },
          { item_code: searchRegex }
        ]
      })
      .select('item_name description item_code')
      .limit(limit)
      .lean();

      return results.map(item => ({
        id: item._id,
        type: 'items',
        title: item.item_name || 'Item',
        subtitle: item.description || item.item_code || 'Item',
        route: `/items/${item._id}`
      }));
    } catch (error) {
      console.error('[SearchService] Error searching items:', error);
      return [];
    }
  }
}

module.exports = new SearchService();

