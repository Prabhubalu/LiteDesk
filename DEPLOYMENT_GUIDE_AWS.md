# 🚀 AWS Deployment Guide - LiteDesk CRM

## Overview

This guide will help you deploy LiteDesk CRM to AWS for testing with friends.

**Architecture**:
- **Frontend**: Vue.js (built and served via Nginx)
- **Backend**: Node.js/Express (managed by PM2)
- **Database**: MongoDB Atlas (cloud-hosted)
- **Server**: AWS EC2 (Ubuntu)
- **Domain**: Optional (or use EC2 public IP)
- **SSL**: Let's Encrypt (free)

**Estimated Time**: 1-2 hours  
**Cost**: ~$10-20/month for testing

---

## 📋 Prerequisites

- [ ] AWS account (free tier eligible)
- [ ] MongoDB Atlas account (free tier)
- [ ] Domain name (optional, recommended)
- [ ] SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- [ ] Basic command line knowledge

---

## PART 1: Database Setup (MongoDB Atlas)

### Step 1.1: Create MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Sign up with Google/Email
3. Choose **FREE tier** (M0 Sandbox)

### Step 1.2: Create Cluster

1. Click **"Build a Database"**
2. Choose **FREE** tier (Shared)
3. Select **AWS** as cloud provider
4. Choose region closest to your EC2 region (e.g., `us-east-1`)
5. Cluster Name: `litedesk-cluster`
6. Click **"Create Cluster"** (takes 3-5 minutes)

### Step 1.3: Configure Database Access

1. Go to **Database Access** (left sidebar)
2. Click **"Add New Database User"**
   - Username: `litedesk_admin`
   - Password: Click "Autogenerate Secure Password" → **COPY IT!**
   - Database User Privileges: `Atlas admin`
3. Click **"Add User"**

### Step 1.4: Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (for now, we'll restrict later)
   - IP: `0.0.0.0/0`
4. Click **"Confirm"**

### Step 1.5: Get Connection String

1. Go to **Database** → Click **"Connect"**
2. Choose **"Connect your application"**
3. Copy the connection string:
   ```
   mongodb+srv://litedesk_admin:<password>@litedesk-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with the actual password you copied earlier
5. **SAVE THIS CONNECTION STRING** - you'll need it later!

---

## PART 2: AWS EC2 Setup

### Step 2.1: Launch EC2 Instance

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Go to **EC2** service
3. Click **"Launch Instance"**

**Configuration**:
- **Name**: `litedesk-server`
- **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
- **Instance type**: `t2.micro` (Free tier - 1GB RAM, 1 vCPU)
  - ⚠️ For production, use `t3.small` or larger
- **Key pair**: 
  - Click "Create new key pair"
  - Name: `litedesk-key`
  - Type: RSA
  - Format: `.pem` (Mac/Linux) or `.ppk` (Windows/PuTTY)
  - **DOWNLOAD AND SAVE** - you can't download it again!
- **Network Settings**:
  - ✅ Allow SSH (port 22) from "My IP"
  - ✅ Allow HTTP (port 80) from "Anywhere"
  - ✅ Allow HTTPS (port 443) from "Anywhere"
- **Storage**: 30 GB gp3 (increase from default 8GB)

4. Click **"Launch Instance"**
5. Wait 2-3 minutes for instance to start

### Step 2.2: Get Instance Details

1. Go to **EC2 Dashboard** → **Instances**
2. Select your instance
3. Copy the **Public IPv4 address** (e.g., `54.123.45.67`)
4. **SAVE THIS IP** - this is your server address!

### Step 2.3: Connect to Server

**On Mac/Linux**:
```bash
# Make key file secure
chmod 400 ~/Downloads/litedesk-key.pem

# Connect to server
ssh -i ~/Downloads/litedesk-key.pem ubuntu@54.123.45.67
```

**On Windows**:
- Use PuTTY with your `.ppk` file
- Host: `ubuntu@54.123.45.67`

When prompted, type `yes` to continue.

You should now see:
```
ubuntu@ip-172-31-xx-xx:~$
```

✅ **You're now connected to your AWS server!**

---

## PART 3: Server Configuration

Run these commands **one by one** on your EC2 instance:

### Step 3.1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 3.2: Install Node.js 20

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### Step 3.3: Install Nginx (Web Server)

```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

Test: Open `http://YOUR_EC2_IP` in browser - you should see Nginx welcome page!

### Step 3.4: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

### Step 3.5: Install Git

```bash
sudo apt install -y git
git --version
```

### Step 3.6: Setup Firewall (Optional but Recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## PART 4: Deploy Application

### Step 4.1: Clone Repository

```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/LiteDesk.git
cd LiteDesk
```

**If your repo is private**, you'll need to:
1. Generate SSH key: `ssh-keygen -t rsa -b 4096`
2. Add to GitHub: `cat ~/.ssh/id_rsa.pub` → Add to GitHub → Settings → SSH Keys

### Step 4.2: Setup Backend

```bash
cd /home/ubuntu/LiteDesk/server

# Install dependencies
npm install --production

# Create .env file
nano .env
```

**Paste this configuration** (press `Ctrl+Shift+V` to paste):

```env
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB (USE YOUR ATLAS CONNECTION STRING!)
MONGODB_URI=mongodb+srv://litedesk_admin:YOUR_PASSWORD@litedesk-cluster.xxxxx.mongodb.net/litedesk?retryWrites=true&w=majority

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random-and-long-12345

# Frontend URL (use your EC2 IP or domain)
CLIENT_URL=http://YOUR_EC2_IP

# CORS Origins
CORS_ORIGINS=http://YOUR_EC2_IP,http://localhost:5173

# Admin Defaults
DEFAULT_ADMIN_EMAIL=admin@litedesk.com
DEFAULT_ADMIN_PASSWORD=Admin@123456

# Email Configuration (optional - for demo requests)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASS=your-app-password

# AWS Configuration (optional - for S3, SES)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET_NAME=
```

**Important**:
1. Replace `YOUR_PASSWORD` with your MongoDB password
2. Replace `YOUR_EC2_IP` with your actual EC2 public IP
3. Generate a secure JWT_SECRET: 
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

Save file: `Ctrl+X` → `Y` → `Enter`

### Step 4.3: Setup Frontend

```bash
cd /home/ubuntu/LiteDesk/client

# Install dependencies
npm install

# Create .env.production
nano .env.production
```

**Paste this**:
```env
VITE_API_URL=http://YOUR_EC2_IP/api
```

Save: `Ctrl+X` → `Y` → `Enter`

**Build frontend**:
```bash
npm run build
```

This creates a `dist/` folder with optimized static files.

### Step 4.4: Setup Default Admin User

```bash
cd /home/ubuntu/LiteDesk/server
node scripts/createDefaultAdmin.js
```

You should see: "✅ Default admin user created successfully"

---

## PART 5: Configure Nginx

### Step 5.1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/litedesk
```

**Paste this configuration**:

```nginx
server {
    listen 80;
    server_name YOUR_EC2_IP;  # Or your domain name

    # Frontend - Serve Vue.js build files
    location / {
        root /home/ubuntu/LiteDesk/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API - Proxy to Node.js
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase upload size (for CSV imports)
    client_max_body_size 10M;
}
```

**Replace `YOUR_EC2_IP`** with your actual IP.

Save: `Ctrl+X` → `Y` → `Enter`

### Step 5.2: Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/litedesk /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## PART 6: Start Backend with PM2

```bash
cd /home/ubuntu/LiteDesk/server

# Start backend
pm2 start server.js --name litedesk-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it outputs (starts with 'sudo env...')

# Check status
pm2 status
pm2 logs litedesk-api
```

---

## PART 7: Test Deployment

### Step 7.1: Check Backend

```bash
curl http://localhost:5000/api/health
```

Should return: `{"status":"OK","timestamp":"..."}`

### Step 7.2: Check Frontend

Open in browser: `http://YOUR_EC2_IP`

You should see the LiteDesk login page! 🎉

### Step 7.3: Login

- **Email**: `admin@litedesk.com`
- **Password**: `Admin@123456`

---

## PART 8: (Optional) Setup Domain & SSL

### Step 8.1: Point Domain to EC2

If you have a domain (e.g., `litedesk.yourname.com`):

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add an **A Record**:
   - Name: `@` or `litedesk`
   - Value: `YOUR_EC2_IP`
   - TTL: 600

Wait 5-30 minutes for DNS propagation.

### Step 8.2: Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d litedesk.yourname.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS
```

Certbot will automatically update your Nginx config!

### Step 8.3: Update Environment Variables

```bash
# Update backend .env
cd /home/ubuntu/LiteDesk/server
nano .env
```

Change:
```env
CLIENT_URL=https://litedesk.yourname.com
CORS_ORIGINS=https://litedesk.yourname.com
```

```bash
# Restart backend
pm2 restart litedesk-api
```

Now access via: `https://litedesk.yourname.com` ✅

---

## PART 9: Monitoring & Maintenance

### Check Application Status

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs litedesk-api

# Monitor resources
pm2 monit
```

### Restart Services

```bash
# Restart backend
pm2 restart litedesk-api

# Restart Nginx
sudo systemctl restart nginx
```

### Update Application

```bash
cd /home/ubuntu/LiteDesk

# Pull latest changes
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

### View System Resources

```bash
# CPU and Memory usage
htop  # Press Q to exit

# Disk usage
df -h

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 🚨 Troubleshooting

### Issue 1: Can't Connect to Server
```bash
# Check Nginx status
sudo systemctl status nginx

# Check backend status
pm2 status
pm2 logs litedesk-api

# Check ports
sudo netstat -tulpn | grep LISTEN
```

### Issue 2: "Cannot connect to MongoDB"
- Check MongoDB Atlas connection string in `.env`
- Verify Network Access in MongoDB Atlas (allow 0.0.0.0/0)
- Test connection: `mongosh "YOUR_CONNECTION_STRING"`

### Issue 3: Frontend shows blank page
```bash
# Check if dist folder exists
ls -la /home/ubuntu/LiteDesk/client/dist

# Rebuild frontend
cd /home/ubuntu/LiteDesk/client
npm run build

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue 4: API calls failing (CORS errors)
- Check `CORS_ORIGINS` in server `.env`
- Make sure it matches your domain/IP exactly
- Restart backend: `pm2 restart litedesk-api`

### Issue 5: "502 Bad Gateway"
```bash
# Backend is not running
pm2 restart litedesk-api

# Check if backend is listening on port 5000
curl http://localhost:5000/api/health
```

---

## 📊 Cost Estimate (Testing)

| Service | Tier | Cost |
|---------|------|------|
| MongoDB Atlas | Free M0 | $0/month |
| AWS EC2 t2.micro | Free tier | $0/month (first year) |
| AWS EC2 t2.micro | After free tier | ~$8-10/month |
| Data Transfer | < 1GB/month | ~$1/month |
| Domain (optional) | .com | ~$12/year |
| SSL Certificate | Let's Encrypt | Free |

**Total**: $0-20/month

---

## 🎯 Production Recommendations

Before sharing with many users:

1. **Upgrade Instance**: Use at least `t3.small` (2GB RAM)
2. **Setup Backups**: Enable MongoDB Atlas automated backups
3. **Add Monitoring**: Setup CloudWatch or Datadog
4. **Restrict IPs**: Update MongoDB Atlas to allow only EC2 IP
5. **Enable Logging**: Setup centralized logging
6. **Add CDN**: Use CloudFront for static assets
7. **Setup CI/CD**: Automate deployments with GitHub Actions
8. **Add Health Checks**: Setup Route53 health checks
9. **Security**: Regular updates, fail2ban, strong passwords
10. **Scaling**: Setup Auto Scaling Group for high traffic

---

## 📞 Next Steps

After deployment:

1. ✅ Test all features (Contacts, Deals, Tasks, etc.)
2. ✅ Create test users with different roles
3. ✅ Test permissions (Manager, User, Viewer)
4. ✅ Import sample CSV data
5. ✅ Share URL with friends for testing
6. ✅ Collect feedback
7. ✅ Monitor error logs: `pm2 logs litedesk-api --lines 100`

---

## 🎉 Success!

Your LiteDesk CRM is now live on AWS!

**Access URL**: `http://YOUR_EC2_IP` (or your domain)  
**Login**: `admin@litedesk.com` / `Admin@123456`

Share with your friends and start collecting feedback! 🚀

---

## 📚 Additional Resources

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Need help?** Check the troubleshooting section or logs:
```bash
pm2 logs litedesk-api --lines 50
sudo tail -f /var/log/nginx/error.log
```

