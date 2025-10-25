# 🚀 Start & Stop Scripts - Updated for Smart Environment

## ✅ What Changed

Your `start.sh` and `stop.sh` scripts have been updated to work with the new smart environment configuration!

---

## 🎯 Key Updates

### 1. **Correct Port Numbers**
- ✅ Backend now uses port **5000** (was 3000)
- ✅ Frontend still uses port **5173**
- ✅ Matches your `.env` configuration

### 2. **Smart MongoDB Detection**
- ✅ Automatically detects if you're using:
  - Local MongoDB (`localhost:27017`)
  - MongoDB Atlas (cloud)
- ✅ Only tries to start/stop local MongoDB if configured
- ✅ Shows which MongoDB you're using

### 3. **Development Mode**
- ✅ Sets `NODE_ENV=development` automatically
- ✅ Uses local MongoDB for development
- ✅ Clear indication that it's development environment

### 4. **Better Error Handling**
- ✅ Shows last 20 lines of logs if startup fails
- ✅ Clearer error messages
- ✅ Helpful troubleshooting tips

### 5. **Environment Awareness**
- ✅ Reads settings from your `.env` file
- ✅ Adapts to your MongoDB configuration
- ✅ Shows which environment mode is active

---

## 🚀 Usage

### Start Development Environment

```bash
./start.sh
```

**What it does:**
1. ✅ Checks prerequisites (Node.js, .env file)
2. ✅ Detects MongoDB setup (local or Atlas)
3. ✅ Starts local MongoDB if needed
4. ✅ Starts backend on port 5000 (development mode)
5. ✅ Starts frontend on port 5173
6. ✅ Opens browser automatically
7. ✅ Shows helpful info and logs

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║           ✅ Development Environment Running!             ║
╚════════════════════════════════════════════════════════════╝

🌐 Frontend:  http://localhost:5173
🚀 Backend:   http://localhost:5000
💚 Health:    http://localhost:5000/health
🗄️  MongoDB:  mongodb://localhost:27017/litedesk
```

---

### Stop All Services

```bash
./stop.sh
```

**What it does:**
1. ✅ Stops frontend (port 5173)
2. ✅ Stops backend (port 5000)
3. ✅ Asks if you want to stop local MongoDB
4. ✅ Asks if you want to delete log files
5. ✅ Shows what was stopped

**Interactive prompts:**
- Stop MongoDB? (optional)
- Delete logs? (optional)

---

## 📊 Comparison: Old vs New

| Feature | Old Script | New Script |
|---------|-----------|------------|
| **Backend Port** | 3000 | 5000 ✅ |
| **MongoDB** | Docker required | Flexible (local or Atlas) ✅ |
| **Environment** | Not specified | DEVELOPMENT mode ✅ |
| **MongoDB Setup** | Always Docker | Auto-detects setup ✅ |
| **Error Messages** | Basic | Detailed with logs ✅ |
| **Port Cleanup** | Port 3000 only | Ports 3000 & 5000 ✅ |

---

## 🔍 MongoDB Detection

The scripts automatically detect your MongoDB setup:

### Local MongoDB
```env
MONGO_URI=mongodb://localhost:27017/litedesk
```
**Script behavior:**
- ✅ Tries to start local MongoDB
- ✅ Waits for MongoDB to be ready
- ✅ Asks before stopping MongoDB

### MongoDB Atlas
```env
MONGO_URI=mongodb+srv://litedeskadmin:...
```
**Script behavior:**
- ✅ Skips local MongoDB setup
- ✅ Uses cloud database
- ✅ No local MongoDB management needed

---

## 📝 What Each Script Does

### start.sh Flow

```
1. Check Prerequisites
   ├─ Node.js installed?
   ├─ .env file exists?
   └─ MongoDB setup?

2. Start MongoDB (if local)
   ├─ Is MongoDB installed?
   ├─ Is it already running?
   └─ Start if needed

3. Start Backend
   ├─ Install dependencies if needed
   ├─ Kill old process on port 5000
   ├─ Set NODE_ENV=development
   ├─ Start backend
   └─ Wait for health check

4. Start Frontend
   ├─ Install dependencies if needed
   ├─ Kill old process on port 5173
   ├─ Start frontend
   └─ Wait for ready

5. Success!
   ├─ Show URLs
   ├─ Save PIDs
   └─ Open browser
```

### stop.sh Flow

```
1. Stop Frontend
   ├─ Kill by PID
   └─ Kill by port 5173

2. Stop Backend
   ├─ Kill by PID
   ├─ Kill port 5000
   └─ Kill port 3000 (old)

3. Stop MongoDB (optional)
   ├─ Detect if local MongoDB
   ├─ Ask user
   └─ Stop if confirmed

4. Clean Logs (optional)
   ├─ Show log sizes
   ├─ Ask user
   └─ Delete if confirmed
```

---

## 💡 Pro Tips

### 1. Quick Start

```bash
# One command to start everything!
./start.sh

# Opens browser automatically
# Shows all URLs and info
```

### 2. Check Logs

```bash
# While services are running:
tail -f backend.log   # Backend logs
tail -f frontend.log  # Frontend logs
```

### 3. Restart Just Backend

```bash
# Kill backend process
lsof -ti :5000 | xargs kill -9

# Start it manually
cd server
node server.js
```

### 4. Keep MongoDB Running

```bash
# When prompted by stop.sh:
Stop MongoDB? (y/N): N  # Press N

# MongoDB stays running for next start
```

### 5. Clean Restart

```bash
./stop.sh
# Say Yes to delete logs
./start.sh
# Fresh start!
```

---

## 🚨 Troubleshooting

### Issue: "Port 5000 already in use"

```bash
# Find what's using the port
lsof -ti :5000

# Kill it
lsof -ti :5000 | xargs kill -9

# Or use stop.sh
./stop.sh
```

### Issue: "MongoDB connection failed"

**For Local MongoDB:**
```bash
# Check if MongoDB is running
pgrep mongod

# If not, start it:
brew services start mongodb-community
# or
mongod
```

**For MongoDB Atlas:**
- Check your internet connection
- Verify connection string in `.env`
- Check MongoDB Atlas network access settings

### Issue: "Backend won't start"

```bash
# Check the logs
cat backend.log

# Common issues:
# - MONGO_URI not set
# - Port already in use
# - Dependencies not installed
```

### Issue: "Frontend shows blank page"

```bash
# Check frontend logs
cat frontend.log

# Rebuild dependencies
cd client
rm -rf node_modules
npm install
```

---

## 📊 Port Reference

| Service | Port | URL |
|---------|------|-----|
| **Frontend** | 5173 | http://localhost:5173 |
| **Backend** | 5000 | http://localhost:5000 |
| **Backend Health** | 5000 | http://localhost:5000/health |
| **MongoDB Local** | 27017 | mongodb://localhost:27017 |

---

## 🎯 Workflow Examples

### Morning Workflow

```bash
# Start everything
./start.sh

# Code, test, develop...
# Check logs: tail -f backend.log

# Done for the day
./stop.sh
```

### Testing Workflow

```bash
# Clean start
./stop.sh  # Say yes to delete logs
./start.sh

# Test features
# Check logs for errors

# Stop when done
./stop.sh
```

### Update Dependencies

```bash
# Stop services
./stop.sh

# Update backend
cd server
npm update
npm install

# Update frontend
cd ../client
npm update
npm install

# Restart
cd ..
./start.sh
```

---

## ✨ Benefits of New Scripts

### Before:
- ❌ Used wrong ports (3000 instead of 5000)
- ❌ Required Docker for MongoDB
- ❌ No environment awareness
- ❌ Basic error messages
- ❌ Didn't match new configuration

### Now:
- ✅ Uses correct ports (5000 for backend)
- ✅ Flexible MongoDB (local or Atlas)
- ✅ Development mode automatic
- ✅ Detailed error messages with logs
- ✅ Matches smart environment setup
- ✅ Auto-detects configuration
- ✅ Helpful tips and URLs
- ✅ Interactive cleanup options

---

## 📚 Related Documentation

- `ENVIRONMENT_GUIDE.md` - How environment system works
- `SETUP_COMPLETE.md` - Overview of all changes
- `FREE_TIER_DEPLOY.md` - Production deployment

---

## 🎉 Summary

Your start and stop scripts are now:
- ✅ **Aligned** with new environment configuration
- ✅ **Smarter** with auto-detection
- ✅ **Clearer** with better messages
- ✅ **Flexible** supporting local and Atlas MongoDB
- ✅ **Helpful** with troubleshooting tips

**Just run `./start.sh` and you're ready to code!** 🚀

---

## 🔄 Quick Commands

```bash
# Start development environment
./start.sh

# Stop all services
./stop.sh

# View logs
tail -f backend.log
tail -f frontend.log

# Check what's running
lsof -ti :5000  # Backend
lsof -ti :5173  # Frontend
ps aux | grep mongod  # MongoDB
```

**Happy coding!** 💚

