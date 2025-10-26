# 📋 Contact Update Flow - How Contacts Get Updated

**Last Updated:** October 26, 2025

---

## 🔄 Overview

Contacts can be updated through **two main methods** in your LiteDesk CRM:

1. **Edit Modal** - User clicks "Edit" button on contact detail page
2. **API Endpoint** - Direct PUT request to `/contacts/:id`

---

## 📊 Update Flow Diagram

```
User Action → Frontend Form → API Client → Backend Controller → Database
     ↓              ↓              ↓              ↓              ↓
  Click Edit    Validate     HTTP PUT      Process       Update Record
    Button       Data         Request      Request       with new data
```

---

## 🎯 Method 1: Edit Modal (Primary Method)

### 1. User Initiates Edit

**Location:** `ContactDetail.vue`

```javascript
// User clicks "Edit" button
const editContact = () => {
  showEditModal.value = true;  // Opens ContactFormModal
};
```

### 2. Form Modal Opens

**Component:** `ContactFormModal.vue`

The modal pre-fills with existing contact data:
- Name, email, phone
- Organization
- Job title, department
- Address
- Social links
- Lifecycle stage, status
- Tags

### 3. User Modifies Data

User can change any of these fields:
- ✅ `first_name`, `last_name`
- ✅ `email`, `phone`, `mobile`
- ✅ `organization` (dropdown)
- ✅ `job_title`, `department`
- ✅ `address` (street, city, state, postal_code, country)
- ✅ `website`, `linkedin_url`, `twitter_handle`
- ✅ `preferred_channel`
- ✅ `lead_source`
- ✅ `lifecycle_stage` (Lead, Qualified, Customer, etc.)
- ✅ `status` (Active, Inactive, Archived)
- ✅ `tags`
- ✅ `do_not_contact` (checkbox)

### 4. Form Submission

**File:** `ContactFormModal.vue` (Line 419-468)

```javascript
const handleSubmit = async () => {
  // Prepare form data - only send fields we want to update
  const formData = {
    salutation: form.value.salutation,
    first_name: form.value.first_name,
    last_name: form.value.last_name,
    email: form.value.email,
    phone: form.value.phone || '',
    mobile: form.value.mobile || '',
    organization: form.value.organization || null,
    job_title: form.value.job_title || '',
    department: form.value.department || '',
    address: form.value.address,
    website: form.value.website || '',
    linkedin_url: form.value.linkedin_url || '',
    twitter_handle: form.value.twitter_handle || '',
    preferred_channel: form.value.preferred_channel,
    lead_source: form.value.lead_source || '',
    lifecycle_stage: form.value.lifecycle_stage,
    status: form.value.status,
    tags: form.value.tags || [],
    do_not_contact: form.value.do_not_contact || false
  };
  
  // PUT request to update contact
  if (isEditing.value) {
    data = await apiClient.put(`/contacts/${props.contact._id}`, formData);
  }
};
```

### 5. Backend Processing

**File:** `server/controllers/contactController.js` (Line 197-272)

```javascript
exports.updateContact = async (req, res) => {
  try {
    // 🔒 Security: Prevent changing protected fields
    delete req.body.organizationId;  // Can't change organization
    delete req.body.createdAt;       // Can't change creation date
    delete req.body.updatedAt;       // System manages this
    delete req.body._id;             // Can't change ID
    delete req.body.__v;             // Version key
    
    // 🧹 Clean populated fields (convert objects to IDs)
    if (req.body.owner_id && typeof req.body.owner_id === 'object') {
      req.body.owner_id = req.body.owner_id._id;
    }
    if (req.body.organization && typeof req.body.organization === 'object') {
      req.body.organization = req.body.organization._id;
    }
    if (req.body.reports_to && typeof req.body.reports_to === 'object') {
      req.body.reports_to = req.body.reports_to._id;
    }
    
    // 📝 Clean notes array
    if (req.body.notes && Array.isArray(req.body.notes)) {
      req.body.notes = req.body.notes.map(note => {
        if (note.created_by && typeof note.created_by === 'object') {
          return { ...note, created_by: note.created_by._id };
        }
        return note;
      });
    }
    
    // 💾 Update in database
    const updatedContact = await Contact.findOneAndUpdate(
      { 
        _id: req.params.id, 
        organizationId: req.user.organizationId // 🔒 Multi-tenancy isolation
      },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedContact) {
      return res.status(404).json({ 
        success: false,
        message: 'Contact not found or access denied.' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedContact
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Error updating contact.', 
      error: error.message 
    });
  }
};
```

### 6. Frontend Updates

**File:** `ContactDetail.vue` (Line 512-515)

```javascript
const handleContactUpdated = () => {
  showEditModal.value = false;  // Close modal
  fetchContact();               // Reload contact data
};
```

---

## 🔑 Update Criteria

### What Determines if a Contact Gets Updated?

1. **Contact ID Match**
   ```javascript
   _id: req.params.id  // Must match the contact being edited
   ```

2. **Organization Match** (Multi-tenancy)
   ```javascript
   organizationId: req.user.organizationId  // Must belong to user's org
   ```

3. **Validation Rules**
   - `first_name` - Required
   - `email` - Required, unique, valid email format
   - `lifecycle_stage` - Must be one of: Lead, Qualified, Customer, Lost, Subscriber, Opportunity
   - `status` - Must be one of: Active, Inactive, Archived
   - `preferred_channel` - Must be one of: email, phone, whatsapp, sms

---

## 🚫 Fields That Cannot Be Changed

The backend explicitly **prevents** updating these fields:

1. `organizationId` - Contact's organization (multi-tenancy)
2. `createdAt` - Original creation timestamp
3. `updatedAt` - System manages this automatically
4. `_id` - MongoDB document ID
5. `__v` - Mongoose version key

---

## 📝 Additional Update Methods

### Method 2: Adding Notes

**Endpoint:** `POST /contacts/:id/notes`

```javascript
const addNote = async () => {
  const data = await apiClient.post(`/contacts/${route.params.id}/notes`, {
    text: newNote.value.trim()
  });
  
  // Adds a note to contact.notes array
  // Updates contact.last_activity_at
};
```

### Method 3: CSV Import (Bulk Update)

**File:** `server/controllers/csvController.js`

During CSV import, contacts can be updated if:
- Email matches existing contact
- Organization matches
- Update mode is enabled

---

## 🔄 Update Triggers

### Automatic Updates

Some fields update automatically:

1. **updatedAt**
   - Updated on every save
   - Managed by Mongoose timestamps

2. **last_activity_at**
   - Updated when note is added
   - Updated when email is sent
   - Updated when task is completed

3. **last_contacted_at**
   - Updated when contact is reached
   - Updated via communication tracking

---

## 🎯 Field Update Examples

### Example 1: Change Lifecycle Stage

**User Action:**
```
Contact Detail → Edit → Lifecycle Stage: "Lead" → "Customer" → Save
```

**API Request:**
```javascript
PUT /contacts/507f1f77bcf86cd799439011
{
  lifecycle_stage: "Customer"
}
```

**Backend Processing:**
```javascript
// Validates: "Customer" is a valid enum value
// Updates: Only lifecycle_stage field
// Returns: Updated contact with all fields
```

### Example 2: Update Organization

**User Action:**
```
Contact Detail → Edit → Organization: "Acme Corp" → Save
```

**API Request:**
```javascript
PUT /contacts/507f1f77bcf86cd799439011
{
  organization: "507f191e810c19729de860ea"  // Organization ObjectId
}
```

**Backend Processing:**
```javascript
// Validates: Organization exists and belongs to user's org
// Converts: Object to ObjectId if needed
// Updates: organization field
```

### Example 3: Bulk Field Update

**User Action:**
```
Contact Detail → Edit → 
  - Email: john@example.com → john.doe@newcompany.com
  - Phone: +1-555-0123 → +1-555-9876
  - Job Title: "Manager" → "Director"
  - Status: "Lead" → "Customer"
→ Save
```

**API Request:**
```javascript
PUT /contacts/507f1f77bcf86cd799439011
{
  email: "john.doe@newcompany.com",
  phone: "+1-555-9876",
  job_title: "Director",
  lifecycle_stage: "Customer"
}
```

**Backend Processing:**
```javascript
// Validates all fields
// Updates all specified fields atomically
// Returns complete updated contact
```

---

## 🔒 Security & Permissions

### Permission Check

**Route:** `server/routes/contactRoutes.js`

```javascript
router.put('/:id', 
  authenticate,                           // Must be logged in
  checkPermission('contacts', 'edit'),   // Must have edit permission
  contactController.updateContact
);
```

### Multi-tenancy Isolation

**Backend ensures:**
```javascript
// Can only update contacts in your organization
{ 
  _id: req.params.id, 
  organizationId: req.user.organizationId 
}
```

**Result:** Users cannot update contacts from other organizations, even if they know the ID.

---

## 📊 Update Response

### Success Response:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "lifecycle_stage": "Customer",
    "updatedAt": "2025-10-26T12:34:56.789Z",
    ...
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error updating contact.",
  "error": "Email already exists"
}
```

---

## 🎯 Summary

### Contact Updates Based On:

1. **User Action**
   - Click "Edit" button
   - Modify fields in form
   - Click "Save"

2. **Permission Check**
   - User must be authenticated
   - User must have "contacts:edit" permission

3. **Validation**
   - Required fields present
   - Valid enum values
   - Unique constraints (email)

4. **Organization Match**
   - Contact belongs to user's organization
   - Multi-tenancy isolation enforced

5. **Field Filtering**
   - Protected fields removed (organizationId, _id, etc.)
   - Populated objects converted to IDs
   - Only allowed fields updated

6. **Database Operation**
   - MongoDB `findOneAndUpdate`
   - Validators run
   - New document returned

7. **Frontend Refresh**
   - Modal closes
   - Contact data reloaded
   - UI updates with new values

---

## 🔧 Debugging Contact Updates

### Check if update is triggered:
```javascript
// In ContactFormModal.vue
console.log('Submitting contact form:', formData);
```

### Check backend receives request:
```javascript
// In contactController.js
console.log('Updating contact with data:', JSON.stringify(req.body, null, 2));
```

### Check database update:
```javascript
// Check MongoDB directly
db.contacts.find({ _id: ObjectId("507f1f77bcf86cd799439011") })
```

### Check frontend receives response:
```javascript
// In ContactFormModal.vue
console.log('Contact saved successfully:', data);
```

---

## 📚 Related Files

- **Frontend Form:** `client/src/components/contacts/ContactFormModal.vue`
- **Frontend Detail:** `client/src/views/ContactDetail.vue`
- **Backend Controller:** `server/controllers/contactController.js`
- **Backend Routes:** `server/routes/contactRoutes.js`
- **Database Model:** `server/models/Contact.js`
- **API Client:** `client/src/utils/apiClient.js`

---

**That's how contacts get updated in your CRM! 🎉**

