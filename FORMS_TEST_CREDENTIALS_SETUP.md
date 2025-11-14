# Forms Module Testing - Credentials Setup

## Option 1: Use Correct Credentials

### Step 1: Determine Your Admin Password

The admin user exists (`admin@litedesk.com`), but the password may have been changed from the default.

**Option A: Reset Password to Known Value**

```bash
cd server
node scripts/resetAdminPassword.js Admin@123
```

This will reset the password to `Admin@123` (or you can specify a different password).

**Option B: Use Your Current Password**

If you know the current password, skip to Step 2.

### Step 2: Set Environment Variables

```bash
export TEST_EMAIL=admin@litedesk.com
export TEST_PASSWORD=Admin@123  # Or your actual password
```

### Step 3: Run Tests

```bash
cd /Users/darshan/sideline/LiteDesk
node server/scripts/testFormsAPI.js
```

## Alternative: Test with Different User

If you have another user account:

```bash
export TEST_EMAIL=your-email@example.com
export TEST_PASSWORD=your-password
node server/scripts/testFormsAPI.js
```

## Quick Test Script

I've created a password reset script at:
- `server/scripts/resetAdminPassword.js`

**Usage:**
```bash
# Reset to default password
node server/scripts/resetAdminPassword.js Admin@123

# Or set custom password
node server/scripts/resetAdminPassword.js YourNewPassword123
```

## Verification

After setting credentials, verify they work:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Bypass-Rate-Limit: true" \
  -d '{"email":"admin@litedesk.com","password":"Admin@123"}'
```

Should return a token (200 OK) instead of 401 Unauthorized.

## Next Steps

Once authentication succeeds:
1. ✅ All Forms Module tests will run automatically
2. ✅ You'll see test results for all 17+ endpoints
3. ✅ Forms will be created and tested end-to-end

## Summary

**Current Status:**
- ✅ Server restarted and running
- ✅ Rate limit bypass working
- ✅ Test script ready
- ⏳ Need correct credentials

**To proceed:**
1. Reset password: `node server/scripts/resetAdminPassword.js Admin@123`
2. Or set TEST_PASSWORD with your known password
3. Run: `node server/scripts/testFormsAPI.js`

