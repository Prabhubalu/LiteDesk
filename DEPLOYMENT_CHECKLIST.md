# ✅ AWS Deployment Checklist

Use this checklist to ensure you don't miss any steps!

## 📋 Pre-Deployment

- [ ] AWS account created
- [ ] MongoDB Atlas account created
- [ ] (Optional) Domain name purchased
- [ ] GitHub repository ready
- [ ] Local code tested and working

---

## 🗄️ Database Setup (MongoDB Atlas)

- [ ] Created MongoDB Atlas cluster (FREE tier)
- [ ] Created database user with password
- [ ] Saved database password securely
- [ ] Configured network access (0.0.0.0/0)
- [ ] Copied connection string
- [ ] Replaced `<password>` in connection string
- [ ] Connection string saved for later

---

## 🖥️ AWS EC2 Setup

- [ ] Launched EC2 instance (Ubuntu 22.04, t2.micro)
- [ ] Created and downloaded key pair (`.pem` or `.ppk`)
- [ ] Configured security groups (SSH, HTTP, HTTPS)
- [ ] Allocated storage (30 GB recommended)
- [ ] Instance is running
- [ ] Copied public IPv4 address
- [ ] Successfully connected via SSH

---

## 🔧 Server Configuration

- [ ] Updated system: `sudo apt update && sudo apt upgrade -y`
- [ ] Installed Node.js 20
- [ ] Installed Nginx
- [ ] Installed PM2
- [ ] Installed Git
- [ ] (Optional) Configured firewall (UFW)
- [ ] Tested Nginx welcome page in browser

---

## 📦 Application Deployment

### Backend
- [ ] Cloned repository to `/home/ubuntu/LiteDesk`
- [ ] Installed backend dependencies: `npm install --production`
- [ ] Created `/server/.env` file
- [ ] Updated MongoDB connection string in `.env`
- [ ] Generated and set JWT_SECRET
- [ ] Updated CLIENT_URL with EC2 IP
- [ ] Updated CORS_ORIGINS with EC2 IP
- [ ] Ran default admin script: `node scripts/createDefaultAdmin.js`

### Frontend
- [ ] Installed frontend dependencies: `npm install`
- [ ] Created `/client/.env.production` file
- [ ] Updated VITE_API_URL with EC2 IP
- [ ] Built frontend: `npm run build`
- [ ] Verified `dist/` folder exists

---

## 🌐 Nginx Configuration

- [ ] Created `/etc/nginx/sites-available/litedesk`
- [ ] Updated server_name with EC2 IP or domain
- [ ] Created symbolic link to sites-enabled
- [ ] Removed default site
- [ ] Tested Nginx config: `sudo nginx -t`
- [ ] Reloaded Nginx: `sudo systemctl reload nginx`

---

## 🚀 Start Application

- [ ] Started backend with PM2: `pm2 start server.js --name litedesk-api`
- [ ] Saved PM2 config: `pm2 save`
- [ ] Setup PM2 startup: `pm2 startup` (and ran the sudo command)
- [ ] Verified PM2 status: `pm2 status`
- [ ] Checked backend health: `curl http://localhost:5000/api/health`

---

## 🧪 Testing

- [ ] Opened `http://YOUR_EC2_IP` in browser
- [ ] Login page loads correctly
- [ ] Logged in with admin credentials
- [ ] Dashboard displays correctly
- [ ] Tested navigation (Contacts, Deals, Tasks, etc.)
- [ ] Tested creating a contact
- [ ] Tested permissions (create another user)
- [ ] Tested CSV import
- [ ] Checked browser console for errors
- [ ] Checked PM2 logs: `pm2 logs litedesk-api`

---

## 🔒 (Optional) Domain & SSL

- [ ] Pointed domain A record to EC2 IP
- [ ] Waited for DNS propagation (5-30 min)
- [ ] Verified domain resolves: `nslookup yourdomain.com`
- [ ] Updated Nginx config with domain name
- [ ] Installed Certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Ran Certbot: `sudo certbot --nginx -d yourdomain.com`
- [ ] Updated backend `.env` with HTTPS URLs
- [ ] Restarted backend: `pm2 restart litedesk-api`
- [ ] Tested HTTPS access
- [ ] Auto-renewal configured: `sudo certbot renew --dry-run`

---

## 👥 Share with Friends

- [ ] Created test user accounts with different roles
- [ ] Imported sample data (contacts, deals, tasks)
- [ ] Prepared testing instructions for friends
- [ ] Shared access credentials securely
- [ ] Shared URL: `http://YOUR_EC2_IP` or `https://yourdomain.com`

---

## 📊 Monitoring Setup

- [ ] Bookmarked PM2 monitoring: `pm2 monit`
- [ ] Tested PM2 logs: `pm2 logs litedesk-api`
- [ ] Tested Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- [ ] Noted resource usage: `htop`
- [ ] Setup monitoring alerts (optional)

---

## 🎯 Post-Deployment

- [ ] Changed default admin password
- [ ] Setup regular backups (MongoDB Atlas)
- [ ] Documented EC2 IP and credentials securely
- [ ] Tested from multiple devices/browsers
- [ ] Collected initial feedback
- [ ] Noted any performance issues
- [ ] Planned next deployment iteration

---

## 🚨 Emergency Contacts

**Key Information** (Keep Secure):

| Item | Value |
|------|-------|
| EC2 Public IP | __________________ |
| EC2 Key Pair Location | __________________ |
| MongoDB Connection String | __________________ |
| Domain Name | __________________ |
| Admin Email | admin@litedesk.com |
| Initial Admin Password | Admin@123456 |

**Quick Commands**:
```bash
# SSH into server
ssh -i ~/path/to/key.pem ubuntu@YOUR_EC2_IP

# Check status
pm2 status
sudo systemctl status nginx

# Restart services
pm2 restart litedesk-api
sudo systemctl restart nginx

# View logs
pm2 logs litedesk-api --lines 50
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ Deployment Complete!

Once all items are checked:
- Your application is live ✅
- Friends can access and test ✅
- Monitoring is in place ✅
- Ready for feedback ✅

**Next**: Monitor logs, collect feedback, and iterate! 🚀

