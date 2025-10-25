# 🚀 Deploy LiteDesk to AWS - Quick Start

Your deployment is pre-configured and ready to go!

**Target Server:** `43.204.144.169`  
**Database:** MongoDB Atlas (connected)

---

## ⚡ Option 1: One-Click Deploy from Your Mac (EASIEST)

### Prerequisites:
1. ✅ EC2 instance running at `43.204.144.169`
2. ✅ SSH key file (`.pem`) downloaded
3. ✅ Security groups allow: SSH (22), HTTP (80), HTTPS (443)

### Steps:

```bash
# 1. Make the deployment script executable
chmod +x deploy-from-local.sh

# 2. Run it! (it will ask for your SSH key path)
./deploy-from-local.sh

# That's it! The script will:
# - Upload the deployment script to EC2
# - Install all dependencies
# - Deploy your application
# - Start everything automatically
```

**Time:** ~5-10 minutes

---

## 🖥️ Option 2: Deploy Directly on EC2

If you prefer to SSH into the server yourself:

### Step 1: Connect to EC2

```bash
# Make your key secure
chmod 400 ~/path/to/your-key.pem

# SSH into EC2
ssh -i ~/path/to/your-key.pem ubuntu@43.204.144.169
```

### Step 2: Download and Run Deployment Script

```bash
# If your code is on GitHub (recommended):
git clone https://github.com/YOUR_USERNAME/LiteDesk.git
cd LiteDesk
chmod +x deploy-aws-quick.sh
./deploy-aws-quick.sh
```

**OR if you don't have GitHub setup yet:**

```bash
# Download script from your local machine
# From your Mac (in a different terminal):
scp -i ~/path/to/your-key.pem deploy-aws-quick.sh ubuntu@43.204.144.169:/home/ubuntu/

# Back on EC2:
chmod +x deploy-aws-quick.sh
./deploy-aws-quick.sh
```

---

## 🎯 What Gets Deployed

The script automatically:

- ✅ **Installs:** Node.js 20, Nginx, PM2, Git
- ✅ **Clones:** Your LiteDesk repository
- ✅ **Configures:** MongoDB connection to Atlas
- ✅ **Generates:** Secure JWT secrets automatically
- ✅ **Builds:** Frontend (Vue.js)
- ✅ **Installs:** All dependencies (backend + frontend)
- ✅ **Configures:** Nginx as reverse proxy
- ✅ **Starts:** Backend with PM2 (auto-restart on crash)
- ✅ **Creates:** Default admin user
- ✅ **Secures:** Basic firewall setup

---

## 📱 After Deployment

### Access Your Application

**URL:** http://43.204.144.169

**Login Credentials:**
- **Email:** admin@litedesk.com
- **Password:** Admin@123456

⚠️ **IMPORTANT:** Change the admin password immediately after first login!

---

## 🔍 Verify Deployment

### Check if everything is running:

```bash
# SSH into your server
ssh -i ~/path/to/your-key.pem ubuntu@43.204.144.169

# Check backend status
pm2 status

# View backend logs
pm2 logs litedesk-api

# Check Nginx status
sudo systemctl status nginx

# Test backend API
curl http://localhost:5000/api/health
```

### Expected Outputs:

✅ PM2 should show `litedesk-api` with status `online`  
✅ Nginx should be `active (running)`  
✅ Health check should return: `{"status":"OK"}`

---

## 🛠️ Useful Commands

### Backend Management

```bash
# View logs (live)
pm2 logs litedesk-api

# Restart backend
pm2 restart litedesk-api

# Stop backend
pm2 stop litedesk-api

# Monitor resources
pm2 monit
```

### Nginx Management

```bash
# Check status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log

# Test configuration
sudo nginx -t
```

### Application Updates

```bash
# Update to latest code
cd /home/ubuntu/LiteDesk
git pull

# Update backend
cd server
npm install
pm2 restart litedesk-api

# Update frontend
cd ../client
npm install
npm run build
```

---

## 🔒 Security Checklist

After deployment:

- [ ] Change admin password
- [ ] Review MongoDB Atlas network access (restrict to EC2 IP only)
- [ ] Setup SSL certificate (see below)
- [ ] Enable CloudWatch monitoring
- [ ] Setup regular backups
- [ ] Review EC2 security groups

---

## 🔐 Optional: Setup SSL (HTTPS)

### If you have a domain name:

```bash
# 1. Point your domain A record to: 43.204.144.169
# 2. Wait for DNS propagation (5-30 minutes)

# 3. SSH into EC2 and run:
sudo apt install -y certbot python3-certbot-nginx

# 4. Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# 5. Update backend .env
cd /home/ubuntu/LiteDesk/server
nano .env
# Change CLIENT_URL to: https://yourdomain.com
# Change CORS_ORIGINS to: https://yourdomain.com

# 6. Restart backend
pm2 restart litedesk-api
```

Now access via: **https://yourdomain.com** 🎉

---

## 🚨 Troubleshooting

### Issue: "Cannot connect to MongoDB"

```bash
# Check MongoDB connection string in .env
cat /home/ubuntu/LiteDesk/server/.env | grep MONGODB_URI

# Test connection
cd /home/ubuntu/LiteDesk/server
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✓ Connected')).catch(err => console.log('✗ Error:', err.message))"
```

### Issue: "502 Bad Gateway"

```bash
# Backend is not running
pm2 restart litedesk-api

# Check if backend is listening on port 5000
curl http://localhost:5000/api/health
```

### Issue: "Frontend shows blank page"

```bash
# Check if dist folder exists
ls -la /home/ubuntu/LiteDesk/client/dist

# Rebuild frontend
cd /home/ubuntu/LiteDesk/client
npm run build

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: "Permission denied" during deployment

```bash
# Make sure you're running as ubuntu user, not root
whoami  # Should output: ubuntu

# If you're root, switch to ubuntu
su - ubuntu
cd /home/ubuntu
./deploy-aws-quick.sh
```

---

## 📊 Pre-Configured Settings

Your deployment comes with:

| Setting | Value |
|---------|-------|
| **Server IP** | 43.204.144.169 |
| **MongoDB** | MongoDB Atlas (pre-configured) |
| **Backend Port** | 5000 |
| **Frontend** | Served by Nginx on port 80 |
| **Admin Email** | admin@litedesk.com |
| **Admin Password** | Admin@123456 (change this!) |
| **Node.js** | Version 20.x |
| **JWT Secrets** | Auto-generated (secure) |

---

## 🎯 Next Steps

After successful deployment:

1. ✅ Access http://43.204.144.169
2. ✅ Login with default credentials
3. ✅ **Change admin password**
4. ✅ Create test users with different roles
5. ✅ Test all features (Contacts, Deals, Tasks, etc.)
6. ✅ Import sample CSV data
7. ✅ Share with friends for testing
8. ✅ Setup SSL (if you have a domain)
9. ✅ Configure email settings (optional)
10. ✅ Setup monitoring and backups

---

## 💡 Quick Tips

- **Forgot admin password?** Run: `cd /home/ubuntu/LiteDesk/server && node scripts/createDefaultAdmin.js`
- **Need to see what's happening?** Run: `pm2 logs litedesk-api --lines 100`
- **Application not responding?** Run: `pm2 restart litedesk-api && sudo systemctl restart nginx`
- **Want to start fresh?** Delete `/home/ubuntu/LiteDesk` and run deployment again

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs: `pm2 logs litedesk-api`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Verify MongoDB Atlas connection in Atlas dashboard

---

## ✨ You're All Set!

Your LiteDesk CRM is now deployed and ready to use!

**Access:** http://43.204.144.169  
**Login:** admin@litedesk.com / Admin@123456

🎉 Enjoy your new CRM system! 🎉

