# 🚀 LiteDesk Deployment Summary

## ✅ Configuration Complete!

Your LiteDesk CRM is now properly configured for both **local development** and **production deployment**.

---

## 📋 Key Changes Made

### 1. **Local Development (Port 3000)**
- ✅ Backend now uses **port 3000** (avoids Apple AirPlay conflict on port 5000)
- ✅ `.env` configured for local MongoDB or MongoDB Atlas
- ✅ `start.sh` and `stop.sh` updated for port 3000
- ✅ Local `.env` is **NEVER** uploaded to production

### 2. **Production Deployment (Port 5000)**
- ✅ Backend uses **port 5000** on EC2 (no Apple AirPlay there!)
- ✅ Production `.env` created **directly on EC2** with proper settings
- ✅ Local `.env` is **excluded** from deployment
- ✅ Frontend built locally and uploaded (optimized for Free Tier)

---

## 🗂️ Environment Files

### Local: `server/.env`
```env
NODE_ENV=development
PORT=3000

# Option 1: Local MongoDB
MONGO_URI_LOCAL=mongodb://localhost:27017/litedesk

# Option 2: MongoDB Atlas (Cloud) - Currently Active
#MONGO_URI_ATLAS=mongodb+srv://...

# Active Connection (currently using local MongoDB)
MONGO_URI=mongodb://localhost:27017/litedesk

# Local URLs
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:3000
```

### Production: `.env` (Created on EC2)
```env
NODE_ENV=production
PORT=5000

MONGO_URI=mongodb+srv://litedeskadmin:...@litedeskdb...
CLIENT_URL=http://13.203.208.47
CORS_ORIGINS=http://13.203.208.47,https://13.203.208.47
```

---

## 🛠️ Usage Commands

### Local Development

#### Start All Services
```bash
./start.sh
```
- Starts backend on **http://localhost:3000**
- Starts frontend on **http://localhost:5173**
- Auto-detects MongoDB (local or Atlas)

#### Stop All Services
```bash
./stop.sh
```

#### Switch Port (Optional)
```bash
./switch-to-port-3000.sh  # Already configured!
```

### Production Deployment

#### Deploy to AWS EC2
```bash
./deploy-local-build.sh
```

**What it does:**
1. ✅ Builds frontend **locally** (avoids EC2 memory issues)
2. ✅ Uploads only built files to EC2
3. ✅ **Excludes** local `.env` from upload
4. ✅ Creates production `.env` directly on EC2
5. ✅ Installs backend dependencies on EC2
6. ✅ Starts backend with PM2
7. ✅ Configures Nginx

**Perfect for AWS Free Tier (t2.micro with 1GB RAM)!**

---

## 🔐 Environment Security

### ✅ What's Protected

| File | Status | Why |
|------|--------|-----|
| **`server/.env`** | ❌ **NOT UPLOADED** | Contains local MongoDB settings |
| **`.env.*`** | ❌ **NOT UPLOADED** | All environment files excluded |
| **Production `.env`** | ✅ **Created on EC2** | Never exists locally |

### Deployment Script Exclusions
```bash
rsync --exclude '.env' --exclude '.env.*' ...
```

---

## 🌐 URLs

### Local Development
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3000
- **API:** http://localhost:3000/api
- **Health:** http://localhost:3000/health

### Production (AWS EC2)
- **Frontend:** http://13.203.208.47
- **Backend:** http://13.203.208.47/api
- **Health:** http://13.203.208.47/api/health

---

## 📊 Port Configuration

| Environment | Backend Port | Frontend Port | Why |
|-------------|-------------|---------------|-----|
| **Local** | 3000 | 5173 | Avoids Apple AirPlay on 5000 |
| **Production** | 5000 | (built dist) | No Apple AirPlay on EC2 |

---

## 🗄️ Database Options

### Local Development - Two Options:

#### Option 1: Local MongoDB (Current)
```env
MONGO_URI=mongodb://localhost:27017/litedesk
```

**To use:**
1. Install: `brew install mongodb-community`
2. Start: `brew services start mongodb-community`
3. Set in `.env`: `MONGO_URI=mongodb://localhost:27017/litedesk`
4. Run: `./start.sh`

#### Option 2: MongoDB Atlas (Cloud)
```env
MONGO_URI=mongodb+srv://litedeskadmin:...
```

**To use:**
1. Uncomment Atlas URI in `.env`
2. Comment out local URI
3. Run: `./start.sh`

### Production - Always MongoDB Atlas
```env
MONGO_URI=mongodb+srv://litedeskadmin:...
```

---

## 🎯 Common Tasks

### Deploy Updates to Production
```bash
# Make your changes locally
git add .
git commit -m "Your changes"
git push

# Deploy to EC2 (builds locally, uploads artifacts)
./deploy-local-build.sh
```

### Switch Between Local & Atlas (Development)
```bash
# Edit server/.env
# Option 1: Use Local MongoDB
MONGO_URI=mongodb://localhost:27017/litedesk

# Option 2: Use MongoDB Atlas
MONGO_URI=mongodb+srv://litedeskadmin:...

# Restart
./stop.sh
./start.sh
```

### Check Deployment Status
```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@13.203.208.47

# Check backend
pm2 logs litedesk-api

# Check .env
cat /home/ubuntu/LiteDesk/server/.env
```

---

## 🚨 Troubleshooting

### Local: Port 3000 Blocked
```bash
# Kill process on port 3000
lsof -ti :3000 | xargs kill -9

# Restart
./start.sh
```

### Local: Wrong MongoDB Connection
```bash
# Check your .env
cat server/.env | grep MONGO_URI

# Should show ONE active connection
# Edit to change between local/Atlas
```

### Production: 502 Error
```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@13.203.208.47

# Check backend logs
pm2 logs litedesk-api

# Check .env exists
ls -la /home/ubuntu/LiteDesk/server/.env

# Restart backend
pm2 restart litedesk-api
```

### Production: 403 Error
```bash
# Fix permissions on EC2
ssh -i your-key.pem ubuntu@13.203.208.47
chmod 755 /home/ubuntu /home/ubuntu/LiteDesk /home/ubuntu/LiteDesk/client /home/ubuntu/LiteDesk/client/dist
```

---

## 📚 Default Credentials

**Both Local & Production:**
- Email: `admin@litedesk.com`
- Password: `Admin@123456`

*Change password after first login!*

---

## ✨ Benefits of This Setup

### Local Development
✅ Port 3000 avoids Apple AirPlay conflicts  
✅ Can use local MongoDB OR Atlas  
✅ Fast development with hot reload  
✅ Separate environment from production  

### Production Deployment
✅ Optimized for AWS Free Tier (1GB RAM)  
✅ Frontend built locally (no EC2 memory issues)  
✅ Production .env created on EC2 (not uploaded)  
✅ Secure secrets generated per deployment  
✅ Automated Nginx configuration  

---

## 🎉 You're Ready!

### Start Local Development:
```bash
./start.sh
```
Open: http://localhost:5173

### Deploy to Production:
```bash
./deploy-local-build.sh
```
Open: http://13.203.208.47

---

## 📝 Notes

1. **Local `.env` is never uploaded to EC2** - keeps your development settings safe
2. **Production `.env` is created fresh on each deployment** - always has correct settings
3. **Port 3000 locally, port 5000 in production** - no conflicts!
4. **Frontend builds locally** - works perfectly with Free Tier!

---

**Happy Coding! 🚀**

