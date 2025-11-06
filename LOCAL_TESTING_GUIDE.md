# 🧪 Local Single-Instance Testing Guide

Complete guide for testing LiteDesk in single-instance mode locally.

---

## ✅ Prerequisites

1. **Node.js** 20.19+ or 22.12+
2. **MongoDB** 6.0+ (local installation)
3. **npm** (comes with Node.js)

---

## 🚀 Step-by-Step Setup

### Step 1: Start MongoDB Locally

**macOS (using Homebrew):**
```bash
# Install MongoDB (if not installed)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb
# Should show: mongodb-community started
```

**Linux:**
```bash
# Start MongoDB service
sudo systemctl start mongod

# Verify it's running
sudo systemctl status mongod
```

**Windows:**
```bash
# Start MongoDB service
net start MongoDB

# Or use MongoDB Compass GUI
```

**Verify MongoDB is accessible:**
```bash
# Test connection
mongosh mongodb://localhost:27017

# Or using mongo client
mongo --eval "db.version()"
```

---

### Step 2: Configure Environment

Your `.env` file is already configured for local testing:
- ✅ `MONGO_URI=mongodb://localhost:27017/litedesk`
- ✅ `ENABLE_INSTANCE_PROVISIONING=false` (single-instance mode)
- ✅ `ENABLE_DEMO_CONVERSION=true`

---

### Step 3: Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

---

### Step 4: Create Admin User

```bash
# From server directory
cd server
node scripts/createDefaultAdmin.js
```

**Expected output:**
```
✅ Admin user created successfully!
Email: admin@litedesk.com
Password: Admin@123456
```

**Save these credentials!**

---

### Step 5: Start the Application

**Option A: Using the start script (Recommended)**

```bash
# From project root
./start.sh
```

This will:
- Start MongoDB (if using Docker)
- Start backend on port 3000
- Start frontend on port 5173

**Option B: Manual Start (Two Terminals)**

**Terminal 1 - Backend:**
```bash
cd server
npm start

# You should see:
# ✅ MongoDB connected successfully
# ✅ Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev

# You should see:
# ➜  Local:   http://localhost:5173/
```

---

## 🧪 Testing the Application

### Test 1: Health Check

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "service": "LiteDesk Master Control Plane",
  "database": {
    "connected": true,
    "state": "connected"
  }
}
```

---

### Test 2: Login

1. Open browser: **http://localhost:5173**
2. Click **"Admin Login"** tab
3. Login with:
   - **Email:** `admin@litedesk.com`
   - **Password:** `Admin@123456`
4. ✅ You should see the dashboard

---

### Test 3: Demo Request Flow

**3.1 Submit Demo Request:**
1. Open incognito window: **http://localhost:5173**
2. Fill out "Request for Demo" form:
   - Company Name: "Acme Corp"
   - Industry: "Technology"
   - Contact Name: "John Doe"
   - Email: "john@acme.com"
   - Phone: "123-456-7890"
3. Submit the form

**3.2 View Demo Request (as Admin):**
1. Login as admin
2. Navigate to **Demo Requests** (in sidebar)
3. You should see "Acme Corp" demo request
4. Status: "pending"

**3.3 Convert Demo Request:**
1. Click on the demo request
2. Click **"Convert to Organization"** button
3. Enter password: `SecurePass123`
4. Select subscription tier: `trial` or `paid`
5. Click **"Convert"**

**What happens:**
- ✅ Organization is marked as `isTenant: true`
- ✅ `customerStatus` updated to "Active"
- ✅ Subscription tier set
- ⚠️ Instance provisioning is **simulated** (since `ENABLE_INSTANCE_PROVERSIONING=false`)

---

### Test 4: Create Organization Manually

**Via Registration:**
1. Open **http://localhost:5173** (incognito)
2. Click **"Register"** tab
3. Fill in:
   - Username: "testuser"
   - Email: "test@example.com"
   - Password: "Test123456"
   - Organization Name: "Test Org"
   - Industry: "Technology"
4. Submit

**What happens:**
- ✅ New Organization created
- ✅ User created as Owner
- ✅ Default roles created
- ✅ Module definitions initialized
- ✅ User logged in automatically

---

### Test 5: Multi-Tenancy Verification

**Test Data Isolation:**
1. Create two organizations (via registration)
2. Login as user from Organization A
3. Create a contact
4. Logout
5. Login as user from Organization B
6. You should **NOT** see Organization A's contact

**Verify in Database:**
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/litedesk

# Check organizations
db.organizations.find().pretty()

# Check users (each has organizationId)
db.users.find({}, {email: 1, organizationId: 1}).pretty()

# Check contacts (each has organizationId)
db.contacts.find({}, {name: 1, organizationId: 1}).pretty()
```

---

## 🔍 Verify Configuration

### Check Current Mode

```bash
# Check if single-instance mode is active
grep ENABLE_INSTANCE_PROVISIONING server/.env
# Should show: ENABLE_INSTANCE_PROVISIONING=false
```

### Check Database Connection

```bash
# From server directory
cd server
node scripts/test-connection.js
```

---

## 📊 What to Test

### ✅ Core Features
- [ ] User registration
- [ ] User login
- [ ] Organization creation
- [ ] Demo request submission
- [ ] Demo request conversion
- [ ] Contact creation
- [ ] Deal creation
- [ ] Task creation
- [ ] Event creation

### ✅ Multi-Tenancy
- [ ] Data isolation between organizations
- [ ] Users can only see their organization's data
- [ ] Organization middleware working correctly

### ✅ Permissions
- [ ] Owner has full access
- [ ] Admin has most access
- [ ] User has limited access
- [ ] Viewer has read-only access

### ✅ Subscription
- [ ] Trial organizations have unlimited limits
- [ ] Trial status check
- [ ] Subscription tier validation

---

## 🐛 Troubleshooting

### MongoDB Not Running

**Error:** `MongoServerError: connect ECONNREFUSED`

**Solution:**
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Verify
mongosh mongodb://localhost:27017
```

---

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Find process using port 3000
lsof -ti :3000

# Kill the process
kill -9 $(lsof -ti :3000)

# Or change port in .env
PORT=3001
```

---

### Database Connection Failed

**Error:** `MongoServerError: Authentication failed`

**Solution:**
```bash
# Check if MongoDB requires authentication
# If yes, update MONGO_URI in .env:
MONGO_URI=mongodb://username:password@localhost:27017/litedesk?authSource=admin
```

---

### Frontend Not Loading

**Error:** CORS errors or connection refused

**Solution:**
1. Check backend is running: `curl http://localhost:3000/health`
2. Check CORS_ORIGINS in `.env` includes `http://localhost:5173`
3. Restart both frontend and backend

---

## 📝 Useful Commands

### Backend Commands

```bash
cd server

# Start server
npm start

# Check database data
node scripts/checkData.js

# Create admin user
node scripts/createDefaultAdmin.js

# Reset database (⚠️ DELETES ALL DATA)
node scripts/resetDatabase.js

# Test connection
node scripts/test-connection.js
```

### Frontend Commands

```bash
cd client

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Commands

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/litedesk

# List all collections
show collections

# Count documents
db.organizations.countDocuments()
db.users.countDocuments()
db.contacts.countDocuments()

# View organizations
db.organizations.find().pretty()

# View users
db.users.find({}, {email: 1, organizationId: 1, role: 1}).pretty()
```

---

## 🎯 Expected Behavior (Single-Instance Mode)

### What Works:
- ✅ All organizations share the same database
- ✅ Data isolated by `organizationId` field
- ✅ Users can login and access their organization's data
- ✅ Demo requests can be converted (simulated)
- ✅ Multi-tenancy via application-level filtering

### What Doesn't Work (Expected):
- ❌ No separate databases per organization
- ❌ No subdomain routing
- ❌ No Kubernetes provisioning
- ❌ Instance provisioning is simulated only

---

## ✅ Success Checklist

After following this guide, you should have:

- [x] MongoDB running locally
- [x] Backend running on port 3000
- [x] Frontend running on port 5173
- [x] Admin user created
- [x] Can login as admin
- [x] Can submit demo request
- [x] Can convert demo request
- [x] Can create organizations
- [x] Data isolation working correctly

---

## 🚀 Next Steps

Once local testing is working:

1. **Test all features** - Contacts, Deals, Tasks, Events
2. **Test permissions** - Create users with different roles
3. **Test subscriptions** - Trial vs Paid tiers
4. **Test limits** - Verify unlimited limits in trial
5. **Test demo flow** - Complete demo request → conversion flow

---

## 📚 Additional Resources

- **Developer Setup:** `docs/DEVELOPER_SETUP.md`
- **MongoDB Setup:** `MONGODB_SETUP_GUIDE.md`
- **API Documentation:** `docs/API_V2_QUICK_START.md`
- **Troubleshooting:** `TROUBLESHOOTING.md`

---

**Happy Testing! 🎉**

