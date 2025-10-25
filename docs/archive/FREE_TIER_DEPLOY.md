# 🚀 AWS Free Tier Deployment (1GB RAM - t2.micro)

## ⚠️ Important: Memory Optimization for Free Tier

Your **t2.micro instance has only 1GB RAM**. Building a Vue.js application on the server can fail or cause crashes!

### ❌ Problem with On-Server Building:
```
Building Vue.js frontend on EC2:
- npm run build uses ~1.5-2GB RAM
- t2.micro has only 1GB RAM
- Result: Build fails or instance freezes
```

### ✅ Solution: Build Locally, Deploy Built Files!
```
Build on your Mac:
- Your Mac has plenty of RAM
- Build completes in 1-2 minutes
- Upload only the built files (~5MB)
- EC2 just serves static files (no memory issues!)
```

---

## 🎯 Two Deployment Methods

### **Method 1: Local Build → Deploy (RECOMMENDED for Free Tier)** ⭐

**Perfect for t2.micro (1GB RAM)**

```bash
# ONE command does everything!
./deploy-local-build.sh
```

**What it does:**
1. ✅ Builds frontend **on your Mac** (no EC2 memory issues!)
2. ✅ Uploads only the built files (small, fast)
3. ✅ Installs lightweight backend on EC2
4. ✅ Configures Nginx
5. ✅ Starts everything

**Advantages:**
- ✅ Works perfectly on t2.micro (1GB RAM)
- ✅ Fast deployment (no on-server build time)
- ✅ No memory issues or crashes
- ✅ Cheaper (less CPU time = less cost)
- ✅ Can deploy even if EC2 is low on memory

**Time:** 3-5 minutes

---

### **Method 2: Full On-Server Build** (Requires 2GB+ RAM)

**⚠️ NOT recommended for t2.micro!**

```bash
./deploy-from-local.sh  # or deploy-aws-quick.sh
```

This builds everything on EC2, which requires:
- ⚠️ At least 2GB RAM (t2.small or larger)
- ⚠️ More CPU time (costs more)
- ⚠️ Risk of out-of-memory errors

---

## 📊 Comparison

| Feature | Local Build | On-Server Build |
|---------|-------------|-----------------|
| **Min RAM Required** | 1GB (t2.micro ✅) | 2GB (t2.small) |
| **Build Time** | 2-3 min (on Mac) | 5-10 min (on EC2) |
| **Cost** | Lower (less EC2 CPU) | Higher (more CPU time) |
| **Reliability** | High (no memory issues) | Medium (can fail on t2.micro) |
| **Free Tier Friendly** | ✅ Yes | ❌ No |

---

## 🚀 Quick Start (Free Tier Optimized)

### Step 1: Build and Deploy

```bash
cd /Users/Prabhu/Documents/GitHub/LiteDesk

# Run the optimized deployment script
./deploy-local-build.sh
```

The script will:
1. Ask for your SSH key path
2. Build frontend locally (on your Mac)
3. Upload files to EC2
4. Setup backend (lightweight!)
5. Configure Nginx
6. Start everything

### Step 2: Access Your App

**URL:** http://43.204.144.169  
**Login:** admin@litedesk.com / Admin@123456

---

## 💰 Cost Comparison

### Using Local Build (Recommended):
```
t2.micro (1GB): $0/month (free tier) or $8/month after
MongoDB Atlas:  $0/month (free tier M0)
Total: $0-8/month
```

### Using On-Server Build:
```
t2.small (2GB): $16-20/month (no free tier)
MongoDB Atlas:  $0/month (free tier M0)
Total: $16-20/month
```

**Savings: $8-12/month by building locally!**

---

## 🔧 How It Works

### Local Build Method:

```
┌─────────────────────────────────────────────────────────┐
│ YOUR MAC (Plenty of RAM)                                │
│                                                          │
│  1. npm run build        ← Builds frontend here         │
│     └─> dist/ folder (5-10MB)                           │
│                                                          │
│  2. Upload to EC2        ← Small files, fast transfer   │
│     └─> rsync dist/ + server/                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ AWS EC2 (1GB RAM - no problem!)                         │
│                                                          │
│  3. npm install          ← Only backend deps (light!)   │
│     └─> ~50MB of backend packages                       │
│                                                          │
│  4. pm2 start            ← Runs backend (uses ~150MB)   │
│                                                          │
│  5. Nginx serves         ← Serves frontend static files │
└─────────────────────────────────────────────────────────┘
```

### On-Server Build Method (Not Recommended):

```
┌─────────────────────────────────────────────────────────┐
│ AWS EC2 (1GB RAM - TOO SMALL!)                          │
│                                                          │
│  1. npm install client   ← Downloads ~500MB packages    │
│  2. npm run build        ← Uses 1.5-2GB RAM ❌ FAILS!  │
│     └─> Out of memory error                             │
│     └─> Instance freezes or crashes                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Memory Usage Breakdown

### Local Build Method (on t2.micro):
```
Backend packages:    ~50MB
Backend runtime:    ~150MB
Nginx:               ~10MB
System overhead:    ~200MB
─────────────────────────────
Total:              ~410MB ✅ Plenty of headroom!
```

### On-Server Build Method (on t2.micro):
```
Backend packages:    ~50MB
Frontend packages:  ~500MB (dev dependencies!)
Build process:     ~1500MB ❌ Exceeds 1GB!
─────────────────────────────
Total:             ~2000MB ❌ Out of memory!
```

---

## 🎯 Deployment Command

**Just run this ONE command:**

```bash
./deploy-local-build.sh
```

That's it! Everything is automated and optimized for free tier.

---

## 🔄 Updating Your Application

When you make changes:

```bash
# Just run the script again!
./deploy-local-build.sh
```

It will:
1. Build updated frontend locally
2. Upload only changed files
3. Restart backend if needed
4. Done!

**Update time:** 1-2 minutes

---

## 🚨 Troubleshooting

### Issue: "Build failed on EC2"

**Solution:** You're using the wrong script!
```bash
# Use the local build script instead:
./deploy-local-build.sh
```

### Issue: "EC2 instance froze during deployment"

**Cause:** Building on t2.micro ran out of memory

**Solution:** 
1. Reboot EC2 instance in AWS Console
2. Use local build method: `./deploy-local-build.sh`

### Issue: "npm run build takes too long"

**Normal:** Building locally takes 2-3 minutes (that's fine!)
Your Mac can handle it easily.

---

## ✅ Prerequisites

Before deployment:

- [ ] EC2 t2.micro running at 43.204.144.169
- [ ] SSH key file (.pem) downloaded
- [ ] Node.js installed on your Mac (for local build)
- [ ] MongoDB Atlas running
- [ ] Security groups configured

---

## 🎓 Best Practices

### For Free Tier (t2.micro):

1. ✅ **Always build locally** - Use `deploy-local-build.sh`
2. ✅ **Monitor memory** - Run `free -h` on EC2 to check
3. ✅ **Use production deps** - `npm install --production`
4. ✅ **Restart if needed** - `pm2 restart litedesk-api`
5. ✅ **Check logs** - `pm2 logs` to monitor health

### Memory Monitoring:

```bash
# SSH into EC2
ssh -i ~/key.pem ubuntu@43.204.144.169

# Check memory usage
free -h

# Should see something like:
#               total        used        free
# Mem:          976Mi       400Mi       200Mi  ✅ Good!

# If you see:
#               total        used        free
# Mem:          976Mi       900Mi        50Mi  ⚠️ Too high!
```

---

## 📊 Success Metrics

After deployment with local build method:

- ✅ Deployment completes in 3-5 minutes
- ✅ EC2 memory usage stays under 500MB
- ✅ Application responds quickly
- ✅ No crashes or freezes
- ✅ Free tier costs = $0

---

## 🎉 Summary

**For AWS Free Tier (t2.micro with 1GB RAM):**

✅ **Use:** `deploy-local-build.sh`
- Builds on your Mac
- Deploys to EC2
- Works perfectly
- Free tier friendly

❌ **Don't use:** `deploy-aws-quick.sh` or `deploy-from-local.sh`
- Builds on EC2
- Needs 2GB+ RAM
- Will fail on t2.micro
- Requires t2.small ($$$)

---

## 🚀 Ready to Deploy?

```bash
# One command to rule them all!
./deploy-local-build.sh
```

Your application will be live in 3-5 minutes! 🎉

---

**💡 Pro Tip:** This local-build method is actually better than on-server building even for larger instances! It's faster, more reliable, and costs less. Many professional teams use this approach.

