# 🚀 LiteDesk Scripts Guide

Three simple scripts to manage your local development environment!

---

## 📋 Available Scripts

### 1. **`start.sh`** - Start Everything
Starts MongoDB, Backend, and Frontend in one command.

### 2. **`stop.sh`** - Stop Everything
Stops all services and optionally cleans up data.

### 3. **`restart.sh`** - Restart Everything
Stops and starts all services.

---

## 🎯 Quick Start (Easiest Way!)

### Start LiteDesk

```bash
./start.sh
```

That's it! ✨

**What happens:**
1. ✅ Checks prerequisites (Docker, Node.js)
2. ✅ Starts MongoDB (Docker container)
3. ✅ Waits for MongoDB to be ready
4. ✅ Starts Backend server (port 3000)
5. ✅ Starts Frontend server (port 5173)
6. ✅ Opens browser automatically
7. ✅ Shows status of all services

**Expected output:**
```
╔════════════════════════════════════════════════════════════╗
║                    🚀 LiteDesk CRM                        ║
║              Starting All Services...                     ║
╚════════════════════════════════════════════════════════════╝

📋 Checking prerequisites...
✅ All prerequisites met!

🗄️  Starting MongoDB...
✅ MongoDB is ready!

🚀 Starting Backend Server...
✅ Backend is ready! (PID: 12345)

🎨 Starting Frontend Server...
✅ Frontend is ready! (PID: 12346)

╔════════════════════════════════════════════════════════════╗
║              ✅ All Services Running!                     ║
╚════════════════════════════════════════════════════════════╝

🌐 Frontend:  http://localhost:5173
🚀 Backend:   http://localhost:3000
🗄️  MongoDB:  mongodb://admin:password123@localhost:27017
```

---

### Stop LiteDesk

```bash
./stop.sh
```

**What happens:**
1. ✅ Stops Frontend server
2. ✅ Stops Backend server
3. ✅ Stops MongoDB container
4. ❓ Asks if you want to delete data (optional)
5. ❓ Asks if you want to delete log files (optional)

**Interactive prompts:**
```
❓ Do you want to remove the MongoDB container?
   (This will delete all data - databases, users, etc.)
   Remove container? (y/N): 

❓ Do you want to delete log files?
   Delete logs? (y/N): 
```

**Tips:**
- Answer **N** to keep your data (users, organizations, demos)
- Answer **Y** to start completely fresh next time

---

### Restart LiteDesk

```bash
./restart.sh
```

**What it does:**
- Stops all services
- Waits 2 seconds
- Starts all services again

Perfect for when you change server code!

---

## 📊 What Gets Started

```
┌─────────────────────────────────────────────┐
│     LiteDesk Local Environment              │
├─────────────────────────────────────────────┤
│                                             │
│  🗄️  MongoDB (Docker)                       │
│  → Port: 27017                              │
│  → Container: litedesk-mongo                │
│  → Credentials: admin/password123           │
│  → Status: Runs in background               │
│                                             │
│  🚀 Backend Server                          │
│  → Port: 3000                               │
│  → Process: node server.js                  │
│  → Logs: backend.log                        │
│  → Features:                                │
│     • Health Monitoring (every 5 min)       │
│     • Metrics Collection (every 15 min)     │
│     • REST API                              │
│                                             │
│  🎨 Frontend Server                         │
│  → Port: 5173                               │
│  → Process: npm run dev                     │
│  → Logs: frontend.log                       │
│  → Auto-reload on file changes              │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔍 View Logs

### Real-time Logs

```bash
# Backend logs
tail -f backend.log

# Frontend logs
tail -f frontend.log

# MongoDB logs
docker logs -f litedesk-mongo
```

### View Last 50 Lines

```bash
# Backend
tail -n 50 backend.log

# Frontend
tail -n 50 frontend.log
```

---

## 🛠️ Troubleshooting

### Script Won't Run: "Permission denied"

**Problem:** `bash: ./start.sh: Permission denied`

**Solution:**
```bash
chmod +x start.sh stop.sh restart.sh
```

---

### Port Already in Use

**Problem:** Backend or frontend won't start

**Solution:** The script automatically kills processes on ports 3000 and 5173. If it still fails:
```bash
# Manually kill processes
lsof -ti :3000 | xargs kill -9
lsof -ti :5173 | xargs kill -9

# Try again
./start.sh
```

---

### Docker Not Running

**Problem:** `❌ Docker daemon is not running`

**Solution:**
1. Open **Docker Desktop** from Applications
2. Wait for it to fully start
3. Run `./start.sh` again

---

### MongoDB Won't Start

**Problem:** `❌ MongoDB failed to start`

**Solution:**
```bash
# Remove old container
docker stop litedesk-mongo 2>/dev/null
docker rm litedesk-mongo 2>/dev/null

# Start fresh
./start.sh
```

---

### Frontend Not Loading

**Problem:** Frontend shows blank page or won't load

**Solution:**
```bash
# Check frontend log
tail -f frontend.log

# Restart just the frontend
lsof -ti :5173 | xargs kill -9
cd client
npm run dev
```

---

### Backend Shows MongoDB Connection Error

**Problem:** `MongoServerError: Authentication failed`

**Solution:**
```bash
# Check if MongoDB is running
docker ps | grep litedesk-mongo

# Check .env file
cat server/.env | grep MONGO_URI

# Should be:
# MONGO_URI=mongodb://admin:password123@localhost:27017/litedesk?authSource=admin

# Restart everything
./restart.sh
```

---

## 📁 Files Created by Scripts

The scripts create these temporary files:

```
/Users/Prabhu/Documents/GitHub/LiteDesk/
├── backend.log           # Backend server logs
├── frontend.log          # Frontend server logs
├── .backend.pid          # Backend process ID
└── .frontend.pid         # Frontend process ID
```

**These files are in `.gitignore`** - they won't be committed to Git.

---

## 🎯 Advanced Usage

### Start Without Auto-Opening Browser

Edit `start.sh` and comment out these lines:
```bash
# if command -v open &> /dev/null; then
#     open http://localhost:5173
# elif command -v xdg-open &> /dev/null; then
#     xdg-open http://localhost:5173
# fi
```

---

### Change Ports

Edit `server/.env`:
```bash
PORT=3001  # Backend port
```

Edit `client/vite.config.js` if needed.

Then restart:
```bash
./restart.sh
```

---

### Keep MongoDB Data Between Restarts

When running `./stop.sh`, answer **N** when asked:
```
Remove container? (y/N): N
```

This keeps your:
- User accounts
- Organizations
- Demo requests
- Instance registry
- All other data

---

### Completely Clean Restart

Want to start with a fresh database?

```bash
# Stop everything and remove all data
./stop.sh
# Answer Y to both prompts

# Start fresh
./start.sh
```

---

## 🚀 Typical Workflow

### Daily Development

```bash
# Morning: Start everything
./start.sh

# Make changes to code...
# Frontend auto-reloads
# Backend needs manual restart

# After changing backend code:
./restart.sh

# Evening: Stop everything (keep data)
./stop.sh
# Answer N to keep data
```

---

### Testing Demo Conversion

```bash
# Start fresh
./stop.sh  # Y to remove data
./start.sh

# 1. Register account
# 2. Submit demo request
# 3. Convert to instance
# 4. Check instances dashboard

# Keep data for next session
./stop.sh  # N to keep data
```

---

## 💡 Pro Tips

1. **Keep multiple terminal tabs:**
   - Tab 1: `tail -f backend.log`
   - Tab 2: `tail -f frontend.log`
   - Tab 3: For commands

2. **Quick health check:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Check what's running:**
   ```bash
   docker ps              # MongoDB
   lsof -i :3000          # Backend
   lsof -i :5173          # Frontend
   ```

4. **Quick database check:**
   ```bash
   docker exec -it litedesk-mongo mongosh \
     -u admin -p password123 \
     --authenticationDatabase admin
   ```

---

## ✅ Summary

| Script | Command | When to Use |
|--------|---------|-------------|
| **Start** | `./start.sh` | First time or after stopping |
| **Stop** | `./stop.sh` | End of work session |
| **Restart** | `./restart.sh` | After code changes |

---

## 🎉 You're Ready!

Just run:
```bash
./start.sh
```

And start building! 🚀

**Questions? Check:**
- `START_HERE.md` - Manual step-by-step guide
- `LOCAL_TESTING_GUIDE.md` - Complete testing workflow
- `README.md` - Project overview

---

**Happy coding! 💻**

