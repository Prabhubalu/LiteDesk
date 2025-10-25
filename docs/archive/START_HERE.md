# 🚀 LiteDesk - Quick Start Guide

**Last Updated:** October 22, 2025

Follow these steps to run your multi-instance CRM locally!

---

## ✅ Everything is Clean - Ready for Fresh Start!

All processes have been stopped. Let's start fresh!

---

## 📋 Step-by-Step Manual Guide

### **Step 1: Start MongoDB** (Terminal 1)

Open your **first terminal** and run:

```bash
docker run -d \
  --name litedesk-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:6.0
```

**What this does:**
- ✅ Starts MongoDB on port 27017
- ✅ Creates admin user (username: admin, password: password123)
- ✅ Runs in background (-d flag)

**Verify it's running:**
```bash
docker ps | grep litedesk-mongo
```

You should see: `litedesk-mongo` with status `Up`

---

### **Step 2: Start Backend Server** (Terminal 2)

Open your **second terminal** and run:

```bash
cd /Users/Prabhu/Documents/GitHub/LiteDesk/server
node server.js
```

**What you should see:**
```
MongoDB connected successfully.
🏥 Starting health checker service...
✅ Health checker started (interval: 300s)
📊 Starting metrics collector service...
✅ Metrics collector started (interval: 900s)
🔍 Running health checks on all active instances...
ℹ️  No instances to check
✅ Health check complete. Summary: {}
Server running on http://localhost:3000
```

**This means:**
- ✅ Backend connected to MongoDB
- ✅ Health monitoring started (checks every 5 minutes)
- ✅ Metrics collection started (collects every 15 minutes)
- ✅ Server ready on port 3000

**Leave this terminal running!**

---

### **Step 3: Start Frontend** (Terminal 3)

Open your **third terminal** and run:

```bash
cd /Users/Prabhu/Documents/GitHub/LiteDesk/client
npm run dev
```

**What you should see:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**Leave this terminal running!**

---

### **Step 4: Verify Everything is Running**

Open a **fourth terminal** (or new tab) and test:

```bash
# Test backend root
curl http://localhost:3000/

# Expected: "CRM API is operational."

# Test health endpoint
curl http://localhost:3000/health

# Expected: JSON with status: "healthy"

# Test system status
curl http://localhost:3000/health/status

# Expected: Detailed system info
```

---

## 🌐 Access Your Application

Open your browser and go to:

**Frontend:** http://localhost:5173

You should see the **LiteDesk Landing Page**! 🎉

---

## 🎯 What's Now Running

```
┌─────────────────────────────────────────────┐
│     Your Local LiteDesk Environment         │
├─────────────────────────────────────────────┤
│                                             │
│  Terminal 1: MongoDB (Docker)               │
│  → Port: 27017                              │
│  → Status: ✅ Running in background         │
│                                             │
│  Terminal 2: Backend Server                 │
│  → Port: 3000                               │
│  → Health Monitoring: ✅ Active             │
│  → Metrics Collection: ✅ Active            │
│                                             │
│  Terminal 3: Frontend Server                │
│  → Port: 5173                               │
│  → Status: ✅ Ready                         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🧪 Test the Complete Workflow

### **Test 1: Register Your Account**

1. Go to http://localhost:5173
2. Click "Register" or fill the registration form
3. Enter:
   - **Email:** admin@test.com
   - **Password:** Test123!
   - **Organization Name:** My Company
   - **Industry:** Technology
4. Click "Register"

**Expected Result:**
- ✅ Organization created in database
- ✅ You're logged in as Owner
- ✅ Redirected to Dashboard

---

### **Test 2: Submit a Demo Request**

1. Logout (or open incognito window)
2. Go to http://localhost:5173
3. Fill out the "Request for Demo" form:
   - **Company Name:** Acme Corporation
   - **Industry:** Retail
   - **Company Size:** 50-200
   - **Contact Name:** John Doe
   - **Email:** john@acme.com
   - **Phone:** +1234567890
   - **Job Title:** CEO
   - **Message:** Interested in your CRM
4. Submit

**Expected Result:**
- ✅ Demo request saved
- ✅ Success message displayed

---

### **Test 3: View Demo Requests**

1. Login as admin@test.com
2. Click "Demo Requests" in navigation
3. You should see Acme Corporation request

**Expected Result:**
- ✅ Demo request listed
- ✅ Status: "pending"
- ✅ Can view details

---

### **Test 4: Convert Demo to Instance**

1. In Demo Requests, click "View Details" on Acme Corp
2. Update status to "qualified" (optional)
3. Click "Convert to Organization"

**Expected Result:**
- ✅ Conversion starts
- ✅ Message: "Instance provisioning started"
- ✅ New entry in InstanceRegistry

---

### **Test 5: View Instance Dashboard**

1. Click "Instances" in navigation
2. You should see:
   - Statistics cards (Total, Active, etc.)
   - Instance table with Acme Corporation
   - Status: "provisioning" or "active" (simulated)

**Expected Result:**
- ✅ Instance dashboard loads
- ✅ Statistics displayed
- ✅ Can filter and search

---

## 🛑 How to Stop Everything

When you're done testing:

### **Stop Frontend** (Terminal 3)
```
Press: Ctrl + C
```

### **Stop Backend** (Terminal 2)
```
Press: Ctrl + C
```

### **Stop MongoDB** (Terminal 4)
```bash
docker stop litedesk-mongo
docker rm litedesk-mongo
```

---

## 🔄 How to Restart Everything

Just follow Steps 1-3 again!

The data persists in the Docker container volume, so your organizations and demo requests will still be there (unless you remove the container with `docker rm`).

---

## 🐛 Troubleshooting

### **Problem:** MongoDB won't start

**Error:** `port is already allocated`

**Solution:**
```bash
# Find what's using port 27017
lsof -i :27017

# Kill it
kill -9 <PID>

# Or use a different port
docker run -d \
  --name litedesk-mongo \
  -p 27018:27017 \  # Changed to 27018
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:6.0

# Then update server/.env:
# MONGO_URI=mongodb://admin:password123@localhost:27018/litedesk?authSource=admin
```

---

### **Problem:** Backend shows MongoDB connection error

**Error:** `MongoServerError: Authentication failed`

**Solution:**
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Check .env file has correct credentials
cat server/.env | grep MONGO_URI

# Should be:
# MONGO_URI=mongodb://admin:password123@localhost:27017/litedesk?authSource=admin
```

---

### **Problem:** Frontend can't reach backend

**Error:** Network error or 404

**Solution:**
```bash
# Check backend is running
curl http://localhost:3000/

# Check vite.config.js has proxy configured
# Should proxy /api to http://localhost:3000

# Restart frontend
cd client
npm run dev
```

---

### **Problem:** Port 3000 already in use

**Solution:**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port in server/.env
# PORT=3001
```

---

## 📊 Useful Commands

### **Check What's Running**
```bash
# Check Docker containers
docker ps

# Check processes on port 3000
lsof -i :3000

# Check processes on port 5173
lsof -i :5173

# Check processes on port 27017
lsof -i :27017
```

### **View Logs**
```bash
# MongoDB logs
docker logs litedesk-mongo -f

# Backend logs
# (visible in Terminal 2)

# Frontend logs
# (visible in Terminal 3)
```

### **Connect to MongoDB**
```bash
# Using mongosh (if installed)
mongosh mongodb://admin:password123@localhost:27017/litedesk?authSource=admin

# Or using Docker exec
docker exec -it litedesk-mongo mongosh -u admin -p password123 --authenticationDatabase admin

# Then in mongosh:
use litedesk
show collections
db.users.find()
db.organizations.find()
db.demorequests.find()
db.instanceregistries.find()
```

---

## 🎉 You're All Set!

You now have a fully functional multi-instance CRM running locally!

**What's Working:**
- ✅ Registration & Login
- ✅ Organization management
- ✅ Demo request system
- ✅ Instance provisioning workflow
- ✅ Instance management dashboard
- ✅ Health monitoring (every 5 min)
- ✅ Metrics collection (every 15 min)
- ✅ Complete REST API

**What's Simulated (no Kubernetes locally):**
- ⚠️ Actual container deployment
- ⚠️ DNS record creation
- ⚠️ Real subdomain routing
- ⚠️ SSL certificates

**These features will work when deployed to AWS with Kubernetes!**

---

## 🚀 Next Steps

1. **Test locally** - Create accounts, submit demos, convert to instances
2. **Review code** - Understand how everything works
3. **Deploy to AWS** - Follow `DEPLOYMENT_GUIDE.md`
4. **Add features** - Stripe, email, custom domains

---

**Need help? Check:**
- `README.md` - Project overview
- `TECHNICAL_SPEC.md` - Complete technical details
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `LOCAL_TESTING_GUIDE.md` - Detailed testing guide

---

**Happy coding! 🎊**

