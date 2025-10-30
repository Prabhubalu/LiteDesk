# 🚀 Contact Update - Quick Guide

**TL;DR: How contacts get updated in LiteDesk**

---

## 📝 Quick Answer

Contacts get updated based on:

1. **User clicks "Edit" button** on contact detail page
2. **User modifies fields** in the edit form modal
3. **User clicks "Save"**
4. **System checks:**
   - ✅ User is authenticated
   - ✅ User has "contacts:edit" permission
   - ✅ Contact belongs to user's organization
   - ✅ All fields are valid
5. **Database updates** the contact
6. **Page refreshes** with new data

---

## 🎯 What Triggers an Update?

### User Actions:
```
Contact Detail Page → Edit Button → Form Modal → Save Button
                                         ↓
                                   PUT /contacts/:id
                                         ↓
                                   Backend Update
```

---

## 🔄 Update Flow (Simple)

```
1. User sees contact detail page
2. User clicks "Edit" button
3. Modal opens with current data
4. User changes fields
5. User clicks "Save"
6. Form validates data
7. PUT request to /contacts/:id
8. Backend checks permissions
9. Backend validates data
10. Database updates record
11. Backend returns updated contact
12. Modal closes
13. Page reloads with new data
```

---

## 📊 What Fields Can Be Updated?

### ✅ Updatable Fields:
- **Personal Info:** first_name, last_name, salutation
- **Contact:** email, phone, mobile
- **Company:** organization, job_title, department
- **Address:** street, city, state, postal_code, country
- **Social:** website, linkedin_url, twitter_handle
- **CRM:** lifecycle_stage, status, lead_source, tags
- **Settings:** preferred_channel, do_not_contact

### ❌ Protected Fields (Cannot Update):
- `organizationId` - Multi-tenancy protection
- `_id` - MongoDB ID
- `createdAt` - Creation timestamp
- `updatedAt` - System manages automatically
- `__v` - Version key

---

## 🔒 Security Checks

### Before Update:
1. **Authentication** - User must be logged in
2. **Permission** - User must have "contacts:edit" permission
3. **Organization** - Contact must belong to user's organization
4. **Validation** - All fields must pass validation rules

### If any check fails:
- ❌ Update is rejected
- ❌ Error message returned
- ❌ No database changes made

---

## 📋 Example Update

### Scenario: Change contact from "Lead" to "Customer"

**User Action:**
1. View contact "John Doe"
2. Click "Edit" button
3. Change "Lifecycle Stage" from "Lead" to "Customer"
4. Click "Save"

**System Action:**
```javascript
PUT /contacts/507f1f77bcf86cd799439011
{
  lifecycle_stage: "Customer"
}

↓

Database Update:
- lifecycle_stage: "Lead" → "Customer"
- updatedAt: 2025-10-26T12:34:56.789Z

↓

Response:
{
  success: true,
  data: { /* updated contact */ }
}

↓

Frontend:
- Modal closes
- Contact detail refreshes
- Shows "Customer" badge
```

---

## 🎨 Visual Flow

```
┌──────────────────────────────────────────────────────────┐
│                 Contact Detail Page                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  👤 John Doe                           [Edit] ✎ │    │
│  │  Manager at Acme Corp                            │    │
│  │  🏷️  Lead                                         │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                        ↓ Click Edit
┌──────────────────────────────────────────────────────────┐
│                   Edit Contact Modal                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ First Name: John                                 │    │
│  │ Last Name: Doe                                   │    │
│  │ Email: john@example.com                          │    │
│  │ Lifecycle Stage: [Lead ▼] → [Customer ▼]       │    │
│  │                                                  │    │
│  │              [Cancel]  [Save ✓]                 │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                        ↓ Click Save
┌──────────────────────────────────────────────────────────┐
│                    Backend Update                         │
│  1. ✓ Check authentication                               │
│  2. ✓ Check permission                                   │
│  3. ✓ Validate data                                      │
│  4. ✓ Update database                                    │
│  5. ✓ Return updated contact                             │
└──────────────────────────────────────────────────────────┘
                        ↓ Success
┌──────────────────────────────────────────────────────────┐
│                 Contact Detail Page                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │  👤 John Doe                           [Edit] ✎ │    │
│  │  Manager at Acme Corp                            │    │
│  │  🏷️  Customer ← Updated!                          │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 🔍 How to Check Updates

### In Browser Console:
```javascript
// When you click Save, look for:
console.log('Submitting contact form:', formData);  // What's being sent
console.log('Contact saved successfully:', data);    // What's returned
```

### In Network Tab:
```
Request:
  PUT /api/contacts/507f1f77bcf86cd799439011
  Body: { lifecycle_stage: "Customer", ... }

Response:
  { success: true, data: { ...updated contact... } }
```

### In MongoDB:
```javascript
db.contacts.find({ _id: ObjectId("507f1f77bcf86cd799439011") })
// Should show updated fields
```

---

## ⚡ Common Update Scenarios

### 1. Change Contact Status
```
Lead → Qualified → Opportunity → Customer
```

### 2. Update Organization
```
No organization → "Acme Corp"
```

### 3. Add/Update Contact Info
```
No phone → "+1-555-0123"
```

### 4. Mark Do Not Contact
```
do_not_contact: false → true
```

### 5. Add Tags
```
tags: [] → ["VIP", "Partner"]
```

---

## 🚨 Why Update Might Fail

### Common Reasons:
1. ❌ **No permission** - User doesn't have "contacts:edit"
2. ❌ **Wrong organization** - Contact belongs to different org
3. ❌ **Invalid email** - Email format is wrong
4. ❌ **Duplicate email** - Email already exists
5. ❌ **Missing required field** - first_name or email missing
6. ❌ **Invalid enum value** - lifecycle_stage not in allowed list
7. ❌ **Contact not found** - Invalid ID

### Error Messages:
```
"Contact not found or access denied."
"Email already exists"
"Error updating contact."
"Validation failed"
```

---

## 📚 Quick Links

- **Full Documentation:** `CONTACT_UPDATE_FLOW.md`
- **Frontend Form:** `client/src/components/contacts/ContactFormModal.vue`
- **Backend Controller:** `server/controllers/contactController.js`
- **People Model:** `server/models/People.js`

---

## 🎉 Summary

**In one sentence:**  
Contacts get updated when a user with "edit" permission clicks the Edit button, modifies fields in the form modal, and clicks Save, which triggers a PUT request that updates the database after passing all validation and security checks.

**The key basis for updates:**
1. ✅ User action (Edit → Modify → Save)
2. ✅ Permission check (contacts:edit)
3. ✅ Organization match (multi-tenancy)
4. ✅ Field validation (required, unique, enum)
5. ✅ Database operation (findOneAndUpdate)

That's it! 🚀

