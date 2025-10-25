# 🚨 Fix 502 Bad Gateway Error

## What This Error Means

**502 Bad Gateway** = Nginx can't connect to your backend API

```
✅ Frontend (Nginx):  Working
✅ Permissions:       Fixed (no more 403!)
❌ Backend (API):     NOT responding on port 5000
```

## Quick Fix (1 Command)

```bash
./fix-backend.sh
```

This script will:
1. ✅ Check if backend is running
2. ✅ Check MongoDB connection
3. ✅ Restart backend with PM2
4. ✅ Show you the status
5. ✅ Test if it works

---

## Why Backend Might Not Be Running

Common causes:

1. **Backend crashed** - Out of memory or code error
2. **Dependencies missing** - node_modules not installed
3. **MongoDB connection failed** - Wrong connection string
4. **Port already in use** - Another process on port 5000
5. **Environment variables missing** - No .env file

---

## Manual Fix Steps

If you prefer to do it manually:

```bash
# SSH into EC2
ssh -i ~/path/to/key.pem ubuntu@13.203.208.47

# Check PM2 status
pm2 status

# Should see litedesk-api process. If not running:
pm2 restart litedesk-api

# If process doesn't exist, start it:
cd /home/ubuntu/LiteDesk/server
pm2 start server.js --name litedesk-api

# Check logs for errors
pm2 logs litedesk-api

# Test backend directly
curl http://localhost:5000/api/health
# Should return: {"status":"OK"}
```

---

## Check Backend Logs

To see what went wrong:

```bash
ssh -i ~/key.pem ubuntu@13.203.208.47

# View last 50 lines of logs
pm2 logs litedesk-api --lines 50

# Or watch logs in real-time
pm2 logs litedesk-api
```

Common errors in logs:

### Error: "Cannot connect to MongoDB"
**Fix:** Check MongoDB Atlas connection string in `.env`

```bash
cat /home/ubuntu/LiteDesk/server/.env | grep MONGODB_URI
```

Should have your correct connection string.

### Error: "Port 5000 already in use"
**Fix:** Kill the process using port 5000

```bash
sudo lsof -ti:5000 | xargs kill -9
pm2 restart litedesk-api
```

### Error: "Cannot find module"
**Fix:** Install dependencies

```bash
cd /home/ubuntu/LiteDesk/server
npm install --production
pm2 restart litedesk-api
```

---

## Verify Backend Is Working

Run these tests:

```bash
ssh -i ~/key.pem ubuntu@13.203.208.47

# Test 1: Is PM2 process running?
pm2 status
# Should show: litedesk-api | online

# Test 2: Is backend responding?
curl http://localhost:5000/api/health
# Should return: {"status":"OK","timestamp":"..."}

# Test 3: Is it listening on port 5000?
sudo netstat -tulpn | grep 5000
# Should show: node listening on 0.0.0.0:5000

# Test 4: Check recent logs
pm2 logs litedesk-api --lines 10
# Should show no errors
```

If all tests pass, your backend is working!

---

## Test From Browser

After backend is fixed:

1. Open: **http://13.203.208.47**
2. Should see login page
3. Enter credentials:
   - Email: admin@litedesk.com
   - Password: Admin@123456
4. Click Login

Should work! ✅

---

## Common Scenarios

### Scenario 1: Backend never started

```bash
# Symptoms
pm2 status  # Shows no litedesk-api process

# Fix
cd /home/ubuntu/LiteDesk/server
pm2 start server.js --name litedesk-api
pm2 save
```

### Scenario 2: Backend crashed

```bash
# Symptoms
pm2 status  # Shows litedesk-api as "errored" or "stopped"

# Fix
pm2 logs litedesk-api --lines 50  # Check what error
pm2 restart litedesk-api
```

### Scenario 3: MongoDB connection issue

```bash
# Symptoms
pm2 logs shows: "MongooseError: Could not connect"

# Fix
nano /home/ubuntu/LiteDesk/server/.env
# Update MONGODB_URI with correct connection string
pm2 restart litedesk-api
```

### Scenario 4: Missing dependencies

```bash
# Symptoms
pm2 logs shows: "Cannot find module 'express'"

# Fix
cd /home/ubuntu/LiteDesk/server
npm install --production
pm2 restart litedesk-api
```

---

## Monitoring Commands

Keep these handy:

```bash
# View status
pm2 status

# View logs (live)
pm2 logs litedesk-api

# Restart backend
pm2 restart litedesk-api

# Stop backend
pm2 stop litedesk-api

# Monitor resources (CPU, memory)
pm2 monit

# Clear logs
pm2 flush

# Save PM2 config
pm2 save
```

---

## Backend Health Check

Create a quick test:

```bash
# From your Mac
curl http://13.203.208.47/api/health

# Should return:
# {"status":"OK","timestamp":"2024-10-25T..."}

# If you get:
# - 502 → Backend not running
# - 404 → Wrong URL
# - Connection refused → EC2 down
# - Timeout → Security group issue
```

---

## Reset Everything

If nothing works, nuclear option:

```bash
ssh -i ~/key.pem ubuntu@13.203.208.47

# Stop everything
pm2 kill

# Reinstall dependencies
cd /home/ubuntu/LiteDesk/server
rm -rf node_modules
npm install --production

# Start fresh
pm2 start server.js --name litedesk-api
pm2 save
pm2 startup
```

---

## Check Environment Variables

Make sure .env has all required variables:

```bash
cat /home/ubuntu/LiteDesk/server/.env
```

Should include:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `PORT=5000` - Backend port
- `NODE_ENV=production`

---

## Nginx Configuration

Verify Nginx is pointing to correct port:

```bash
cat /etc/nginx/sites-available/litedesk | grep proxy_pass
```

Should show: `proxy_pass http://localhost:5000;`

---

## Step-by-Step Diagnosis

Run these in order:

```bash
# 1. Is EC2 running?
# Check AWS Console

# 2. Can you SSH?
ssh -i ~/key.pem ubuntu@13.203.208.47

# 3. Is PM2 installed?
which pm2

# 4. Is backend process running?
pm2 status

# 5. Are there errors in logs?
pm2 logs litedesk-api --lines 20

# 6. Is backend listening on port 5000?
sudo netstat -tulpn | grep 5000

# 7. Can you reach backend locally?
curl http://localhost:5000/api/health

# 8. Is Nginx running?
sudo systemctl status nginx

# 9. Can you reach frontend?
curl http://localhost/

# 10. Test from browser
# Open http://13.203.208.47
```

---

## Success Checklist

Backend is working when:

- ✅ `pm2 status` shows `online`
- ✅ `curl http://localhost:5000/api/health` returns JSON
- ✅ `pm2 logs` shows no errors
- ✅ Browser shows login page (no 502)
- ✅ Can login successfully

---

## Quick Reference

| Error | Meaning | Fix |
|-------|---------|-----|
| 502 Bad Gateway | Backend down | `./fix-backend.sh` |
| 403 Forbidden | Permission issue | `./fix-permissions.sh` |
| 404 Not Found | Wrong URL | Check URL path |
| Connection Refused | EC2 stopped | Start EC2 instance |

---

## Prevention

To avoid this in future:

1. **Monitor backend:** `pm2 monit`
2. **Check logs regularly:** `pm2 logs litedesk-api`
3. **Setup startup:** `pm2 startup` (auto-restart on reboot)
4. **Save config:** `pm2 save` (persist processes)

---

## Summary

**Problem:** 502 Bad Gateway (Backend not responding)  
**Quick Fix:** `./fix-backend.sh`  
**Manual Fix:** `pm2 restart litedesk-api`  
**Check Status:** `pm2 status`  
**View Logs:** `pm2 logs litedesk-api`  

🎯 **Run the fix script and you'll be up in 30 seconds!**

