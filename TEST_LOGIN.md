# 🔍 Debug Login Issue

## Test if You're Logged In

Open browser console (F12) and run:

```javascript
// Check if user is stored
const user = localStorage.getItem('user');
console.log('User in localStorage:', user);

// Parse it
if (user) {
    const parsed = JSON.parse(user);
    console.log('Token:', parsed.token);
    console.log('Email:', parsed.email);
    console.log('Role:', parsed.role);
}
```

## What You Should See:

If logged in correctly:
```
User in localStorage: {"email":"admin@litedesk.com", "token":"eyJhbGc...", ...}
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Email: admin@litedesk.com
Role: owner
```

If NOT logged in:
```
User in localStorage: null
```

---

## If NOT Logged In - Login Again:

1. **Logout** (if button available) or clear storage:
   ```javascript
   localStorage.clear()
   ```

2. **Refresh page** - Go to http://localhost:5173

3. **Click "Admin Login"**

4. **Enter:**
   - Email: `admin@litedesk.com`
   - Password: `Admin@123`

5. **Check console for errors**

---

## Common Issues:

### Issue 1: Login succeeds but token not saved
**Check:** Browser console for errors during login

### Issue 2: 403 Forbidden
**Means:** You're logged in but don't have permissions

### Issue 3: "Not authorized, token failed"
**Means:** Token is invalid or JWT_SECRET changed

---

## Quick Fix - Re-create Admin:

```bash
cd server
node scripts/createDefaultAdmin.js
```

This will warn if admin exists. You can delete the user first:

```bash
# In mongosh or MongoDB Compass
db.users.deleteOne({email: "admin@litedesk.com"})
db.organizations.deleteOne({name: "LiteDesk Master"})

# Then create admin again
node scripts/createDefaultAdmin.js
```

