# 🚀 LiteDesk CRM - Deployment & Testing Guide

Welcome! This guide will help you deploy LiteDesk CRM to AWS and share it with friends for testing.

---

## 📚 Available Guides

Choose based on your experience level:

### 🏃 **Quick Deploy** (30 minutes)
→ [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)
- Fastest way to get live
- Automated script included
- Perfect for testing

### 📖 **Complete Guide** (1-2 hours)
→ [DEPLOYMENT_GUIDE_AWS.md](./DEPLOYMENT_GUIDE_AWS.md)
- Step-by-step instructions
- Detailed explanations
- Troubleshooting included

### ✅ **Deployment Checklist** (tracking)
→ [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- Track your progress
- Don't miss any steps
- Emergency contacts section

---

## 🎯 What You'll Deploy

**Tech Stack**:
- **Frontend**: Vue.js + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas (cloud)
- **Server**: AWS EC2 (Ubuntu)
- **Web Server**: Nginx
- **Process Manager**: PM2

**Features**:
- ✅ Full CRM functionality
- ✅ User management with RBAC
- ✅ Contacts, Deals, Tasks, Calendar
- ✅ CSV Import/Export
- ✅ Role-based permissions
- ✅ Dark mode support
- ✅ Mobile responsive

---

## ⚡ Quick Start (For Experienced Users)

### Prerequisites
```bash
# You need:
- AWS account (free tier)
- MongoDB Atlas account (free tier)
- Domain (optional)
```

### 1. Setup MongoDB Atlas
```
1. Create cluster (FREE M0)
2. Create user + save password
3. Allow 0.0.0.0/0 network access
4. Copy connection string
```

### 2. Launch EC2
```
1. Ubuntu 22.04 + t2.micro
2. Download key pair (.pem)
3. Security: SSH (22), HTTP (80), HTTPS (443)
4. Copy public IP
```

### 3. Deploy
```bash
# SSH into server
ssh -i key.pem ubuntu@YOUR_EC2_IP

# Download & run deployment script
wget https://raw.githubusercontent.com/YOUR_USERNAME/LiteDesk/main/deploy-to-aws.sh
chmod +x deploy-to-aws.sh
./deploy-to-aws.sh
```

### 4. Access
```
URL: http://YOUR_EC2_IP
Login: admin@litedesk.com / Admin@123456
```

**Done!** 🎉

---

## 📋 Deployment Options

### Option 1: Automated Script (Recommended)
**Best for**: Quick deployment, beginners

The `deploy-to-aws.sh` script automates everything:
- ✅ Installs all dependencies
- ✅ Clones repository
- ✅ Configures environment
- ✅ Builds frontend
- ✅ Sets up Nginx
- ✅ Starts services
- ✅ Runs health checks

**Time**: 15 minutes  
**Complexity**: Easy

---

### Option 2: Manual Deployment
**Best for**: Learning, customization, troubleshooting

Follow step-by-step instructions in [DEPLOYMENT_GUIDE_AWS.md](./DEPLOYMENT_GUIDE_AWS.md)

**Time**: 1-2 hours  
**Complexity**: Moderate

---

### Option 3: Docker (Coming Soon)
**Best for**: Containerized deployments, Kubernetes

Docker support planned for future release.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     AWS EC2 Instance                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Nginx :80/:443                 │  │
│  │  ┌─────────────────┐      ┌──────────────────┐   │  │
│  │  │   Frontend      │      │   Backend API    │   │  │
│  │  │   (Vue.js)      │◄────►│   (Express)      │   │  │
│  │  │   /dist         │      │   :5000          │   │  │
│  │  └─────────────────┘      └──────────────────┘   │  │
│  │                                     │             │  │
│  └─────────────────────────────────────┼─────────────┘  │
└─────────────────────────────────────────┼────────────────┘
                                          │
                                          ▼
                              ┌────────────────────────┐
                              │   MongoDB Atlas        │
                              │   (Cloud Database)     │
                              └────────────────────────┘
```

**Request Flow**:
1. User visits `http://YOUR_IP`
2. Nginx serves Vue.js app
3. App makes API calls to `/api/*`
4. Nginx proxies to Express backend (port 5000)
5. Backend queries MongoDB Atlas
6. Response sent back to user

---

## 💰 Cost Breakdown

### Testing Phase (Free)
| Service | Tier | Cost/Month |
|---------|------|------------|
| MongoDB Atlas | M0 Sandbox | $0 |
| AWS EC2 | t2.micro (1st year) | $0 |
| Data Transfer | <1GB | $0 |
| SSL Certificate | Let's Encrypt | $0 |
| **Total** | | **$0** |

### After Free Tier
| Service | Tier | Cost/Month |
|---------|------|------------|
| MongoDB Atlas | M0 Sandbox | $0 |
| AWS EC2 | t2.micro | ~$8-10 |
| Data Transfer | ~5GB | ~$0.50 |
| Domain | .com | ~$1 |
| **Total** | | **~$10-15** |

### Production Scale
| Service | Tier | Cost/Month |
|---------|------|------------|
| MongoDB Atlas | M10 Dedicated | ~$57 |
| AWS EC2 | t3.small | ~$15 |
| Load Balancer | ALB | ~$16 |
| Data Transfer | ~50GB | ~$5 |
| CloudFront CDN | 1TB | ~$85 |
| Domain + SSL | | ~$1 |
| **Total** | | **~$180** |

---

## 🧪 Testing Checklist

After deployment, test these features:

### ✅ Authentication & Authorization
- [ ] Login with admin account
- [ ] Create users with different roles
- [ ] Test permission restrictions
- [ ] Logout and re-login

### ✅ Contacts Module
- [ ] Create contact
- [ ] Edit contact
- [ ] Delete contact
- [ ] Search contacts
- [ ] Filter by organization
- [ ] CSV import
- [ ] CSV export
- [ ] View contact details

### ✅ Deals Module
- [ ] Create deal
- [ ] Edit deal
- [ ] Delete deal
- [ ] Kanban view (drag & drop)
- [ ] Table view
- [ ] Change deal stage
- [ ] CSV import/export

### ✅ Tasks Module
- [ ] Create task
- [ ] Edit task
- [ ] Mark complete
- [ ] Assign to user
- [ ] Filter by status
- [ ] CSV import/export

### ✅ Calendar Module
- [ ] Create event
- [ ] View calendar (month/week/day)
- [ ] Edit event
- [ ] Delete event
- [ ] Link to contacts/deals

### ✅ Organizations Module
- [ ] Create organization
- [ ] Edit organization
- [ ] View organization details
- [ ] Link contacts to organization

### ✅ Import Management
- [ ] View import history
- [ ] Check import stats
- [ ] View imported records
- [ ] Failed records handling

### ✅ User Management
- [ ] Create users
- [ ] Edit user roles
- [ ] Deactivate users
- [ ] View user list

### ✅ Roles & Permissions
- [ ] Create custom role
- [ ] Edit permissions
- [ ] View role hierarchy
- [ ] Assign users to roles

### ✅ UI/UX
- [ ] Dark mode toggle
- [ ] Mobile responsiveness
- [ ] Page navigation
- [ ] Search functionality
- [ ] Notifications

---

## 🔒 Security Checklist

Before sharing with friends:

- [ ] Change default admin password
- [ ] Restrict MongoDB network access to EC2 IP only
- [ ] Setup UFW firewall on EC2
- [ ] (Optional) Add domain with SSL
- [ ] Review AWS security group rules
- [ ] Enable MongoDB Atlas audit logs
- [ ] Setup CloudWatch alerts
- [ ] Regular backups enabled

---

## 📊 Monitoring

### Server Health
```bash
# SSH into server
ssh -i key.pem ubuntu@YOUR_EC2_IP

# Check services
pm2 status
sudo systemctl status nginx

# View logs
pm2 logs litedesk-api --lines 50
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check resources
htop  # CPU/Memory
df -h  # Disk space
```

### Application Metrics
```bash
# Real-time monitoring
pm2 monit

# Backend logs
pm2 logs litedesk-api

# Restart if needed
pm2 restart litedesk-api
```

---

## 🔄 Update Deployment

When you push new code:

```bash
# SSH into server
ssh -i key.pem ubuntu@YOUR_EC2_IP

# Pull latest code
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

# No need to restart Nginx (serves static files)
```

---

## 🆘 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Can't access website | Check security group allows HTTP/HTTPS |
| 502 Bad Gateway | Backend not running: `pm2 restart litedesk-api` |
| Blank page | Rebuild frontend: `cd client && npm run build` |
| CORS errors | Update CORS_ORIGINS in server/.env |
| MongoDB connection failed | Check connection string and network access |
| Out of memory | Upgrade to t3.small instance |

### Get Help

1. Check logs first: `pm2 logs litedesk-api`
2. Verify services: `pm2 status && sudo systemctl status nginx`
3. Review [DEPLOYMENT_GUIDE_AWS.md](./DEPLOYMENT_GUIDE_AWS.md) troubleshooting section
4. Check MongoDB Atlas connection from server: `mongosh "YOUR_CONNECTION_STRING"`

---

## 📝 Sharing with Friends

**Create Test Accounts**:
```
Manager: manager@test.com / Test123!
User: user@test.com / Test123!
Viewer: viewer@test.com / Test123!
```

**Share This**:
```
🚀 LiteDesk CRM - Testing Invitation

Hi! I'm building a CRM and would love your feedback.

🌐 URL: http://YOUR_EC2_IP
👤 Login: [your-email] / [password]

Test Features:
✅ Create and manage contacts
✅ Track deals through sales pipeline
✅ Manage tasks and deadlines
✅ Schedule events on calendar
✅ Import data via CSV
✅ Different user roles and permissions

Please try breaking it and let me know:
- What works well?
- What's confusing?
- What features are missing?
- Any bugs or errors?

Thanks for testing! 🙏
```

---

## 🎯 Next Steps

### Immediate (Day 1)
- [x] Deploy to AWS
- [ ] Change admin password
- [ ] Create test users
- [ ] Import sample data
- [ ] Share with 2-3 friends

### Short Term (Week 1)
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Monitor performance
- [ ] Add SSL certificate
- [ ] Setup regular backups

### Medium Term (Month 1)
- [ ] Implement feedback
- [ ] Add new features
- [ ] Optimize performance
- [ ] Upgrade server if needed
- [ ] Plan production launch

---

## 📚 Additional Resources

**Deployment Guides**:
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Get live in 30 minutes
- [DEPLOYMENT_GUIDE_AWS.md](./DEPLOYMENT_GUIDE_AWS.md) - Complete guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Progress tracker

**Development**:
- [DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md) - Local development
- [QUICK_START.md](./QUICK_START.md) - Getting started
- [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) - Architecture details

**Features**:
- [PERMISSION_COMPONENTS_GUIDE.md](./PERMISSION_COMPONENTS_GUIDE.md) - RBAC system
- [MIGRATION_COMPLETE_SUMMARY.md](./MIGRATION_COMPLETE_SUMMARY.md) - Recent updates

**Scripts**:
- [deploy-to-aws.sh](./deploy-to-aws.sh) - Automated deployment
- [start.sh](./start.sh) - Local development
- [stop.sh](./stop.sh) - Stop local servers

---

## 🎉 You're Ready!

Choose your deployment method:

**🏃 Fast Track** (30 min):
```bash
./deploy-to-aws.sh
```

**📖 Learn Mode** (1-2 hours):
```bash
# Follow step by step
open DEPLOYMENT_GUIDE_AWS.md
```

**Have questions?** Check the guides above or review logs on your server.

**Happy Deploying! 🚀**

---

**Last Updated**: October 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅

