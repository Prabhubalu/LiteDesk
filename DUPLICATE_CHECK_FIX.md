# 🔧 Duplicate Check Error - QUICK FIX

**Error:** `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Cause:** Server needs to be restarted to load new routes

---

## ✅ SOLUTION

### **Step 1: Restart the Backend Server**

```bash
cd server

# Stop the server (Ctrl+C if running)
# Then restart:
npm start
```

**OR** if using nodemon:
```bash
# It should auto-restart, but if not:
npx nodemon server.js
```

### **Step 2: Verify Server Started**

Look for these messages in the console:
```
MongoDB connected successfully.
Server running on http://localhost:3000
```

### **Step 3: Test the Duplicate Check Endpoint**

Open a new terminal and test:

```bash
# Test if the route exists (should return 401 Unauthorized, not 404)
curl http://localhost:3000/api/csv/check-duplicates/contacts
```

**Expected response:**
```json
{"message": "Not authorized, no token"}
```

**If you get HTML (<!DOCTYPE...)**: Server not restarted properly

---

## 🔍 TROUBLESHOOTING

### **If Server Won't Start:**

**Check for syntax errors:**
```bash
cd server
node -c controllers/csvController.js
node -c routes/csvRoutes.js
```

**Check if port 3000 is in use:**
```bash
lsof -i :3000
# If something is using it, kill it:
kill -9 <PID>
```

### **If Still Getting Error:**

1. **Hard refresh browser:**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + F5`

2. **Check browser console for actual endpoint being called:**
   - Should be: `/api/csv/check-duplicates/contacts`
   - Not: `/csv/check-duplicates/contacts` (missing /api)

3. **Verify all files saved:**
   - `server/controllers/csvController.js`
   - `server/routes/csvRoutes.js`
   - `server/server.js`

---

## 📝 VERIFICATION CHECKLIST

- [ ] Server restarted
- [ ] MongoDB connected message shown
- [ ] No error messages in server console
- [ ] Browser hard refreshed
- [ ] CSV Import modal loads
- [ ] Can click through to step 2 (Map Fields)

---

## 🚀 EXPECTED BEHAVIOR AFTER FIX

1. Upload CSV file ✅
2. Map fields ✅
3. Click "Check Duplicates" ✅
4. **See loading spinner** (not error)
5. **See duplicate check results**
6. Choose handling option
7. Click "Import Now"
8. Success!

---

## 🛠️ FULL RESTART COMMANDS

```bash
# Terminal 1: Backend
cd /Users/Prabhu/Documents/GitHub/LiteDesk/server
npm start

# Terminal 2: Frontend (if needed)
cd /Users/Prabhu/Documents/GitHub/LiteDesk/client
npm run dev
```

---

## ✅ QUICK TEST

After server restart, try this in browser console:

```javascript
// This should work if server is running
fetch('/api/csv/check-duplicates/contacts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
  body: JSON.stringify({
    csvData: 'email\ntest@example.com',
    fieldMapping: { 'email': 'email' }
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

---

**Most Common Fix:** Just restart the server! 🔄

