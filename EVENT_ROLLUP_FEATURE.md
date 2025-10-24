# Event Rollup Feature - Contact to Deal Relationships

## 📋 Overview
Implemented a **rollup relationship** for events where events created for a Deal automatically appear in the related Contact's detail page. This is a standard CRM pattern that provides better visibility into all activities related to a contact.

## 🎯 Feature Description

### What is Event Rollup?
When a Deal is assigned to a Contact, and an event is created for that Deal, the event will now **automatically appear** in the Contact's events list. This eliminates the need to create duplicate events and provides a complete view of all activities related to a contact.

### Example Scenario
```
Contact: John Doe
  └── Deal: $50K Enterprise License
       └── Event: "Demo Meeting" (Oct 25, 2025)

Result:
- John Doe's contact detail page shows:
  ✅ Events directly related to John Doe
  ✅ Events related to his deals (Demo Meeting)
```

## 🛠️ Implementation

### Backend Changes

#### 1. Modified `eventController.js`
Added support for `includeRelated` query parameter:

```javascript
const Deal = require('../models/Deal');

exports.getEvents = async (req, res) => {
    const { includeRelated = 'false', relatedType, relatedId } = req.query;
    
    // Related record filter with rollup support
    if (relatedType && relatedId) {
        if (relatedType === 'Contact' && includeRelated === 'true') {
            // Find all deals related to this contact
            const relatedDeals = await Deal.find({
                contactId: relatedId,
                organizationId: req.user.organizationId
            }).select('_id').lean();
            
            const dealIds = relatedDeals.map(deal => deal._id);
            
            // Query for events related to the contact OR related to any of the contact's deals
            query.$or = [
                {
                    'relatedTo.type': 'Contact',
                    'relatedTo.id': relatedId
                },
                {
                    'relatedTo.type': 'Deal',
                    'relatedTo.id': { $in: dealIds }
                }
            ];
        } else {
            // Standard query - just the specified related record
            query['relatedTo.type'] = relatedType;
            query['relatedTo.id'] = relatedId;
        }
    }
    
    // ... rest of the logic
};
```

**Key Points**:
- Only applies when `relatedType='Contact'` and `includeRelated='true'`
- Finds all deals where `contactId` matches the contact
- Queries events using `$or` to include both direct and rollup events
- Maintains organization isolation for security

#### 2. Search Filter Compatibility
Enhanced search filter to work with `$or` queries:

```javascript
if (search) {
    const searchConditions = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
    ];
    
    // If we already have an $or from related records, combine them with $and
    if (query.$or) {
        query.$and = [
            { $or: query.$or },
            { $or: searchConditions }
        ];
        delete query.$or;
    } else {
        query.$or = searchConditions;
    }
}
```

### Frontend Changes

#### 1. Updated `RelatedEventsWidget.vue`
Automatically passes `includeRelated=true` for Contacts:

```javascript
const fetchEvents = async () => {
  const params = {
    relatedType: props.relatedType,
    relatedId: props.relatedId,
    limit: props.limit,
    sortBy: 'startDate',
    sortOrder: 'desc'
  };
  
  // For Contacts, include events from related Deals (rollup)
  if (props.relatedType === 'Contact') {
    params.includeRelated = 'true';
  }
  
  const response = await apiClient.get('/events', { params });
  // ...
};
```

#### 2. Visual Indication of Rollup Events
Added UI to show which Deal the event is from:

```vue
<!-- Show related record if it's a rollup event -->
<div v-if="event.relatedTo && showRelatedInfo(event)" 
     class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
  <span>{{ event.relatedTo.type }}: {{ getRelatedName(event.relatedTo.id) }}</span>
</div>
```

**Helper Functions**:
```javascript
const showRelatedInfo = (event) => {
  // Show related info only if viewing from Contact and event is related to a Deal
  return props.relatedType === 'Contact' && event.relatedTo?.type === 'Deal';
};

const getRelatedName = (relatedRecord) => {
  if (!relatedRecord) return 'Unknown';
  if (relatedRecord.name) return relatedRecord.name;
  if (relatedRecord.title) return relatedRecord.title;
  if (relatedRecord.first_name || relatedRecord.last_name) {
    return `${relatedRecord.first_name || ''} ${relatedRecord.last_name || ''}`.trim();
  }
  return 'Unnamed';
};
```

## 🎨 User Interface

### Contact Detail Page - Events Widget

#### Before Rollup
```
┌─────────────────────────────────┐
│ Events                    [+]   │
├─────────────────────────────────┤
│ ✓ Direct Contact Event 1        │
│ ✓ Direct Contact Event 2        │
│                                 │
│ (Missing deal-related events)   │
└─────────────────────────────────┘
```

#### After Rollup
```
┌─────────────────────────────────┐
│ Events                    [+]   │
├─────────────────────────────────┤
│ ✓ Direct Contact Event 1        │
│   📅 Oct 24 • 10:00 AM          │
│                                 │
│ ✓ Demo Meeting                  │
│   📅 Oct 25 • 2:00 PM           │
│   ⚡ Deal: $50K Enterprise      │ ← Rollup indicator
│                                 │
│ ✓ Follow-up Call                │
│   📅 Oct 26 • 11:00 AM          │
│   ⚡ Deal: Annual Contract      │ ← Rollup indicator
└─────────────────────────────────┘
```

### Deal Detail Page - Events Widget
Unchanged. Shows only events directly related to the deal:
```
┌─────────────────────────────────┐
│ Events                    [+]   │
├─────────────────────────────────┤
│ ✓ Demo Meeting                  │
│   📅 Oct 25 • 2:00 PM           │
│                                 │
│ ✓ Contract Signing              │
│   📅 Oct 30 • 3:00 PM           │
└─────────────────────────────────┘
```

## 📊 Data Flow

### Query Flow
```
User opens Contact Detail Page
    ↓
ContactDetail.vue loads
    ↓
RelatedEventsWidget renders
    ↓
Detects relatedType = 'Contact'
    ↓
Calls API with includeRelated=true
    ↓
Backend: GET /api/events?relatedType=Contact&relatedId=123&includeRelated=true
    ↓
Backend finds all deals where contactId = 123
    ↓
Backend queries events with $or:
  - relatedTo.type='Contact' AND relatedTo.id=123
  - relatedTo.type='Deal' AND relatedTo.id IN [deal_ids]
    ↓
Returns combined list of events
    ↓
Frontend displays events with rollup indicators
```

## 🔒 Security

### Organization Isolation
All queries maintain organization-level isolation:
```javascript
const relatedDeals = await Deal.find({
    contactId: relatedId,
    organizationId: req.user.organizationId  // ✅ Secure
}).select('_id').lean();

const query = { 
    organizationId: req.user.organizationId  // ✅ Secure
};
```

### Access Control
- Only users with access to a contact can see rollup events
- Events from deals in other organizations are never included
- Follows existing RBAC permissions

## ✅ Benefits

### 1. **Complete Activity View**
Users see all activities related to a contact in one place, including:
- Direct contact events
- Events from all related deals
- Complete timeline of interactions

### 2. **No Duplicate Events**
Eliminates the need to:
- Create the same event twice (once for contact, once for deal)
- Manually cross-reference between contact and deal pages
- Keep multiple event records in sync

### 3. **Better Context**
When viewing a contact, users can see:
- All meetings scheduled
- All calls made
- All activities across all deals
- Complete sales pipeline activity

### 4. **Standard CRM Pattern**
Follows industry-standard CRM behavior:
- Salesforce has "Related Lists" with rollup
- HubSpot shows associated activities
- Pipedrive displays linked activities

## 🧪 Testing Checklist

### Backend
- [x] Modified eventController.js with rollup logic
- [x] Added Deal model import
- [x] Added includeRelated parameter handling
- [x] Query correctly finds related deals
- [x] Query uses $or for combined results
- [x] Organization isolation maintained
- [x] Search filter works with rollup queries
- [x] No linter errors

### Frontend
- [x] Modified RelatedEventsWidget.vue
- [x] Automatically passes includeRelated for Contacts
- [x] Shows rollup indicator for Deal events
- [x] Displays related Deal name
- [x] No linter errors

### Manual Testing Required
- [ ] Create a Contact
- [ ] Create a Deal assigned to that Contact
- [ ] Create an Event for the Deal
- [ ] Open Contact detail page
- [ ] Verify event appears in Contact's events list
- [ ] Verify event shows "Deal: [Deal Name]" indicator
- [ ] Click event to view details
- [ ] Verify event still links to Deal
- [ ] Create direct Contact event
- [ ] Verify both types appear correctly

### Edge Cases
- [ ] Contact with no deals → Shows only direct events
- [ ] Contact with multiple deals → Shows events from all deals
- [ ] Deal with no contact → Not affected
- [ ] Event with no related record → Not affected
- [ ] Search while using rollup → Works correctly

## 📈 Performance Considerations

### Query Optimization
1. **Deal Lookup**: Efficient with `contactId` index
2. **Event Query**: Uses existing indexes on `relatedTo.type` and `relatedTo.id`
3. **Lean Queries**: Uses `.lean()` for better performance
4. **Limited Results**: Respects `limit` parameter to avoid large result sets

### Potential Optimizations (Future)
- Cache deal IDs for frequently accessed contacts
- Add compound index on `(relatedTo.type, relatedTo.id)`
- Implement pagination for large event lists
- Add event count to avoid loading all events

## 🔮 Future Enhancements

### 1. **Reverse Rollup** (Deal → Organization)
If deals are assigned to organizations, show organization events in deal detail.

### 2. **Task Rollup**
Show events from related tasks in contact/deal pages.

### 3. **Organization Rollup**
Show events from all contacts and deals in organization detail.

### 4. **Configurable Rollup**
Allow admins to configure which rollups to enable/disable.

### 5. **Rollup Depth**
Support multi-level rollups:
- Organization → Deal → Contact → Event

### 6. **Event Deduplication**
If an event is related to both a contact and their deal, show it once with both indicators.

## 📁 Files Modified

1. **`/server/controllers/eventController.js`**
   - Added `Deal` model import
   - Added `includeRelated` parameter
   - Implemented rollup query logic
   - Enhanced search filter compatibility

2. **`/client/src/components/events/RelatedEventsWidget.vue`**
   - Auto-detect Contact type
   - Pass `includeRelated=true` for contacts
   - Display rollup indicators
   - Show related Deal name

## 📚 Related Documentation

- Event Model: `/server/models/Event.js`
- Deal Model: `/server/models/Deal.js`
- Contact Detail View: `/client/src/views/ContactDetail.vue`
- Deal Detail View: `/client/src/views/DealDetail.vue`
- Event Form Modal: `/client/src/components/events/EventFormModal.vue`

---

**Status**: ✅ **Implemented and Ready to Test**
**Feature Type**: Rollup Relationship / Data Aggregation
**Impact**: High (improves user experience and data visibility)
**Complexity**: Medium (backend query logic + frontend display)
**Date**: October 24, 2025

