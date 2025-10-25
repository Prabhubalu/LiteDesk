#!/bin/bash

###############################################################################
# LiteDesk CRM - AWS Deployment Script
###############################################################################
# This script automates the deployment process on an AWS EC2 Ubuntu server
# 
# Usage:
#   1. Upload this script to your EC2 instance
#   2. Make it executable: chmod +x deploy-to-aws.sh
#   3. Run it: ./deploy-to-aws.sh
#
# Note: Run this script as the ubuntu user, NOT root
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                  🚀 LiteDesk CRM Deployment                  ║
║                     AWS EC2 Setup Script                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Please run as ubuntu user, not root${NC}"
    exit 1
fi

###############################################################################
# Step 1: Collect Configuration
###############################################################################
echo -e "${BLUE}📋 Step 1: Configuration${NC}"
echo ""

# MongoDB Connection String
read -p "Enter MongoDB Atlas Connection String: " MONGODB_URI
if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}❌ MongoDB URI is required${NC}"
    exit 1
fi

# EC2 IP or Domain
read -p "Enter your EC2 Public IP or Domain: " SERVER_ADDRESS
if [ -z "$SERVER_ADDRESS" ]; then
    echo -e "${RED}❌ Server address is required${NC}"
    exit 1
fi

# JWT Secret
read -p "Enter JWT Secret (or press Enter to auto-generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || echo "change-this-super-secret-jwt-key-to-something-very-random-and-secure-$(date +%s)")
    echo -e "${GREEN}✓ Generated JWT Secret${NC}"
fi

# Admin Credentials
read -p "Enter Admin Email (default: admin@litedesk.com): " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@litedesk.com}

read -sp "Enter Admin Password (default: Admin@123456): " ADMIN_PASSWORD
echo ""
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin@123456}

echo ""
echo -e "${GREEN}✓ Configuration collected${NC}"
echo ""

###############################################################################
# Step 2: Update System
###############################################################################
echo -e "${BLUE}📦 Step 2: Updating System${NC}"
sudo apt update -qq
sudo apt upgrade -y -qq
echo -e "${GREEN}✓ System updated${NC}"
echo ""

###############################################################################
# Step 3: Install Node.js
###############################################################################
echo -e "${BLUE}📦 Step 3: Installing Node.js 20${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &>/dev/null
    sudo apt install -y nodejs -qq
    echo -e "${GREEN}✓ Node.js installed${NC}"
else
    echo -e "${YELLOW}⚠ Node.js already installed ($(node -v))${NC}"
fi
echo ""

###############################################################################
# Step 4: Install Nginx
###############################################################################
echo -e "${BLUE}🌐 Step 4: Installing Nginx${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx -qq
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}"
else
    echo -e "${YELLOW}⚠ Nginx already installed${NC}"
fi
echo ""

###############################################################################
# Step 5: Install PM2
###############################################################################
echo -e "${BLUE}🔄 Step 5: Installing PM2${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 --silent
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${YELLOW}⚠ PM2 already installed${NC}"
fi
echo ""

###############################################################################
# Step 6: Install Git
###############################################################################
echo -e "${BLUE}📦 Step 6: Installing Git${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git -qq
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${YELLOW}⚠ Git already installed${NC}"
fi
echo ""

###############################################################################
# Step 7: Clone/Update Repository
###############################################################################
echo -e "${BLUE}📥 Step 7: Setting up Application${NC}"
APP_DIR="/home/ubuntu/LiteDesk"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠ Directory exists, pulling latest changes${NC}"
    cd "$APP_DIR"
    git pull
else
    echo "Enter GitHub repository URL (e.g., https://github.com/username/LiteDesk.git):"
    read -p "Repository URL: " REPO_URL
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}❌ Repository URL is required${NC}"
        exit 1
    fi
    git clone "$REPO_URL" "$APP_DIR"
fi
echo -e "${GREEN}✓ Application code ready${NC}"
echo ""

###############################################################################
# Step 8: Setup Backend
###############################################################################
echo -e "${BLUE}🔧 Step 8: Setting up Backend${NC}"
cd "$APP_DIR/server"

# Install dependencies
echo "Installing backend dependencies..."
npm install --production --silent

# Create .env file
cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=$MONGODB_URI

# JWT
JWT_SECRET=$JWT_SECRET

# Frontend URL
CLIENT_URL=http://$SERVER_ADDRESS
CORS_ORIGINS=http://$SERVER_ADDRESS,https://$SERVER_ADDRESS

# Admin Defaults
DEFAULT_ADMIN_EMAIL=$ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD

# Optional: Email Configuration (uncomment to use)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=
# EMAIL_PASS=
EOF

echo -e "${GREEN}✓ Backend configured${NC}"
echo ""

# Create default admin
echo "Creating default admin user..."
node scripts/createDefaultAdmin.js || echo -e "${YELLOW}⚠ Admin may already exist${NC}"
echo ""

###############################################################################
# Step 9: Setup Frontend
###############################################################################
echo -e "${BLUE}🎨 Step 9: Setting up Frontend${NC}"
cd "$APP_DIR/client"

# Install dependencies
echo "Installing frontend dependencies..."
npm install --silent

# Create .env.production
cat > .env.production << EOF
VITE_API_URL=http://$SERVER_ADDRESS/api
EOF

# Build frontend
echo "Building frontend (this may take a few minutes)..."
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist folder not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

###############################################################################
# Step 10: Configure Nginx
###############################################################################
echo -e "${BLUE}🌐 Step 10: Configuring Nginx${NC}"

sudo tee /etc/nginx/sites-available/litedesk > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_ADDRESS;

    # Frontend
    location / {
        root /home/ubuntu/LiteDesk/client/dist;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 10M;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/litedesk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"
echo ""

###############################################################################
# Step 11: Start Backend with PM2
###############################################################################
echo -e "${BLUE}🚀 Step 11: Starting Backend${NC}"
cd "$APP_DIR/server"

# Stop existing process if any
pm2 delete litedesk-api 2>/dev/null || true

# Start new process
pm2 start server.js --name litedesk-api
pm2 save

# Setup startup script
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo -e "${GREEN}✓ Backend started${NC}"
echo ""

###############################################################################
# Step 12: Setup Firewall (Optional)
###############################################################################
echo -e "${BLUE}🔒 Step 12: Configuring Firewall${NC}"
read -p "Setup UFW firewall? (recommended) [Y/n]: " setup_firewall
setup_firewall=${setup_firewall:-Y}

if [[ $setup_firewall =~ ^[Yy]$ ]]; then
    sudo ufw --force enable
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ Firewall setup skipped${NC}"
fi
echo ""

###############################################################################
# Step 13: Test Deployment
###############################################################################
echo -e "${BLUE}🧪 Step 13: Testing Deployment${NC}"

# Test backend
echo "Testing backend API..."
sleep 3
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend may not be ready yet${NC}"
fi

# Test frontend
echo "Testing frontend..."
if [ -f "/home/ubuntu/LiteDesk/client/dist/index.html" ]; then
    echo -e "${GREEN}✓ Frontend files are in place${NC}"
else
    echo -e "${RED}❌ Frontend files missing${NC}"
fi
echo ""

###############################################################################
# Deployment Complete
###############################################################################
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              ✅ Deployment Completed Successfully!           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo ""
echo -e "🌐 Application URL:  ${GREEN}http://$SERVER_ADDRESS${NC}"
echo -e "👤 Admin Email:      ${GREEN}$ADMIN_EMAIL${NC}"
echo -e "🔑 Admin Password:   ${GREEN}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Change the default admin password after first login!${NC}"
echo ""

echo -e "${BLUE}📝 Useful Commands:${NC}"
echo ""
echo "  Check application status:    pm2 status"
echo "  View application logs:       pm2 logs litedesk-api"
echo "  Restart application:         pm2 restart litedesk-api"
echo "  Monitor resources:           pm2 monit"
echo ""
echo "  Check Nginx status:          sudo systemctl status nginx"
echo "  View Nginx logs:             sudo tail -f /var/log/nginx/error.log"
echo "  Restart Nginx:               sudo systemctl restart nginx"
echo ""

echo -e "${BLUE}🔄 To Update Application:${NC}"
echo ""
echo "  cd /home/ubuntu/LiteDesk"
echo "  git pull"
echo "  cd server && npm install && pm2 restart litedesk-api"
echo "  cd ../client && npm install && npm run build"
echo ""

echo -e "${GREEN}🎉 Your LiteDesk CRM is now live and ready for testing!${NC}"
echo ""
echo -e "${YELLOW}📧 Share the URL with your friends and start collecting feedback!${NC}"
echo ""

# Show PM2 status
pm2 status

