#!/bin/bash

###############################################################################
# Arivu CRM - One-Click AWS Deployment Script
###############################################################################
# Pre-configured for: 43.204.144.169
# Run this script on your EC2 instance for automated deployment
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Pre-configured values
MONGODB_URI="mongodb+srv://arivuadmin:TKvtQbKGOWdfP5C1@arivudb.qzw4euo.mongodb.net/arivu?retryWrites=true&w=majority&appName=arivudb"
SERVER_ADDRESS="43.204.144.169"
ADMIN_EMAIL="admin@arivu.com"
ADMIN_PASSWORD="Admin@123456"
REPO_URL="https://github.com/Prabhubalu/Arivu.git"

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║            🚀 Arivu CRM - One-Click Deployment            ║
║                  AWS EC2 Automated Setup                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${PURPLE}📍 Deploying to: ${GREEN}$SERVER_ADDRESS${NC}"
echo -e "${PURPLE}🗄️  Database: ${GREEN}MongoDB Atlas${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Please run as ubuntu user, not root${NC}"
    exit 1
fi

# Generate secure JWT secret
echo -e "${BLUE}🔐 Generating secure JWT secrets...${NC}"
JWT_SECRET=$(openssl rand -hex 64)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 64)
MASTER_API_KEY=$(openssl rand -hex 32)
echo -e "${GREEN}✓ Secrets generated${NC}"
echo ""

###############################################################################
# Update System
###############################################################################
echo -e "${BLUE}📦 Step 1/11: Updating System${NC}"
sudo apt update -qq
sudo apt upgrade -y -qq
echo -e "${GREEN}✓ System updated${NC}"
echo ""

###############################################################################
# Install Node.js
###############################################################################
echo -e "${BLUE}📦 Step 2/11: Installing Node.js 20${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js $(node -v) installed${NC}"
else
    echo -e "${YELLOW}⚠ Node.js already installed ($(node -v))${NC}"
fi
echo ""

###############################################################################
# Install Nginx
###############################################################################
echo -e "${BLUE}🌐 Step 3/11: Installing Nginx${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}"
else
    echo -e "${YELLOW}⚠ Nginx already installed${NC}"
fi
echo ""

###############################################################################
# Install PM2
###############################################################################
echo -e "${BLUE}🔄 Step 4/11: Installing PM2${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${YELLOW}⚠ PM2 already installed${NC}"
fi
echo ""

###############################################################################
# Install Git
###############################################################################
echo -e "${BLUE}📦 Step 5/11: Installing Git${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${YELLOW}⚠ Git already installed${NC}"
fi
echo ""

###############################################################################
# Clone/Update Repository
###############################################################################
echo -e "${BLUE}📥 Step 6/11: Setting up Application${NC}"
APP_DIR="/home/ubuntu/Arivu"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠ Directory exists, pulling latest changes${NC}"
    cd "$APP_DIR"
    git pull origin main || git pull origin master || echo "Using existing code"
else
    echo -e "${PURPLE}📥 Cloning repository...${NC}"
    echo -e "${YELLOW}⚠️  If your repo is private, you'll need to enter credentials${NC}"
    read -p "Enter your GitHub repository URL (or press Enter for default): " USER_REPO
    REPO_URL=${USER_REPO:-$REPO_URL}
    
    git clone "$REPO_URL" "$APP_DIR" || {
        echo -e "${RED}❌ Failed to clone repository${NC}"
        echo -e "${YELLOW}💡 If your repo is private, setup SSH key:${NC}"
        echo -e "   1. ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N \"\""
        echo -e "   2. cat ~/.ssh/id_rsa.pub"
        echo -e "   3. Add this key to GitHub: Settings → SSH Keys"
        echo -e "   4. Run this script again"
        exit 1
    }
fi

cd "$APP_DIR"
echo -e "${GREEN}✓ Application code ready${NC}"
echo ""

###############################################################################
# Setup Backend
###############################################################################
echo -e "${BLUE}🔧 Step 7/11: Setting up Backend${NC}"
cd "$APP_DIR/server"

# Install dependencies
echo "Installing backend dependencies..."
npm install

# Create .env file
cat > .env << EOF
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=$MONGODB_URI

# JWT Secrets
JWT_SECRET=$JWT_SECRET
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET

# Master API Key
MASTER_API_KEY=$MASTER_API_KEY

# Frontend URL
CLIENT_URL=http://$SERVER_ADDRESS
CORS_ORIGINS=http://$SERVER_ADDRESS,https://$SERVER_ADDRESS,http://localhost:5173

# Admin Defaults
DEFAULT_ADMIN_EMAIL=$ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD

# Email Configuration (optional - uncomment to use)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=
# EMAIL_PASS=

# AWS Configuration (optional)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET_NAME=
EOF

echo -e "${GREEN}✓ Backend configured${NC}"
echo ""

# Create default admin
echo -e "${BLUE}👤 Creating default admin user...${NC}"
if [ -f "scripts/createDefaultAdmin.js" ]; then
    node scripts/createDefaultAdmin.js || echo -e "${YELLOW}⚠ Admin may already exist${NC}"
else
    echo -e "${YELLOW}⚠ Admin creation script not found, will create on first start${NC}"
fi
echo ""

###############################################################################
# Setup Frontend
###############################################################################
echo -e "${BLUE}🎨 Step 8/11: Setting up Frontend${NC}"
cd "$APP_DIR/client"

# Install dependencies
echo "Installing frontend dependencies (this may take a few minutes)..."
npm install

# Create .env.production
cat > .env.production << EOF
VITE_API_URL=http://$SERVER_ADDRESS/api
EOF

# Build frontend
echo -e "${PURPLE}🔨 Building frontend (this may take 2-3 minutes)...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist folder not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

###############################################################################
# Configure Nginx
###############################################################################
echo -e "${BLUE}🌐 Step 9/11: Configuring Nginx${NC}"

sudo tee /etc/nginx/sites-available/arivu > /dev/null << 'NGINXCONF'
server {
    listen 80;
    server_name 43.204.144.169;

    # Frontend - Serve Vue.js build files
    location / {
        root /home/ubuntu/Arivu/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase upload size (for CSV imports)
    client_max_body_size 26M;
}
NGINXCONF

# Enable site
sudo ln -sf /etc/nginx/sites-available/arivu /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configured successfully${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi
echo ""

###############################################################################
# Start Backend with PM2
###############################################################################
echo -e "${BLUE}🚀 Step 10/11: Starting Backend${NC}"
cd "$APP_DIR/server"

# Stop existing process if any
pm2 delete arivu-api 2>/dev/null || true

# Start new process
pm2 start server.js --name arivu-api --time
pm2 save

# Setup startup script
pm2_startup_cmd=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep "sudo env")
if [ ! -z "$pm2_startup_cmd" ]; then
    eval $pm2_startup_cmd
fi

echo -e "${GREEN}✓ Backend started${NC}"
echo ""

###############################################################################
# Setup Firewall
###############################################################################
echo -e "${BLUE}🔒 Step 11/11: Configuring Firewall${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not available, skipping firewall setup${NC}"
fi
echo ""

###############################################################################
# Test Deployment
###############################################################################
echo -e "${BLUE}🧪 Testing Deployment${NC}"

# Give backend time to start
echo "Waiting for backend to start..."
sleep 5

# Test backend
echo "Testing backend API..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend might need a moment to fully start${NC}"
fi

# Test frontend
echo "Testing frontend..."
if [ -f "/home/ubuntu/Arivu/client/dist/index.html" ]; then
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
║            ✅ DEPLOYMENT COMPLETED SUCCESSFULLY! ✅          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}               ${PURPLE}🎉 YOUR APPLICATION IS NOW LIVE! 🎉${NC}              ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}🌐 Access your application at:${NC}"
echo -e "   ${BLUE}http://43.204.144.169${NC}"
echo ""

echo -e "${GREEN}👤 Login Credentials:${NC}"
echo -e "   ${PURPLE}Email:${NC}     $ADMIN_EMAIL"
echo -e "   ${PURPLE}Password:${NC}  $ADMIN_PASSWORD"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT SECURITY REMINDERS:${NC}"
echo -e "   1. ${RED}Change the admin password immediately after first login!${NC}"
echo -e "   2. Keep your .env file secure (contains secrets)"
echo -e "   3. Consider setting up SSL with Let's Encrypt"
echo ""

echo -e "${BLUE}📊 Application Status:${NC}"
pm2 status
echo ""

echo -e "${BLUE}📝 Useful Commands:${NC}"
echo -e "   View logs:           ${PURPLE}pm2 logs arivu-api${NC}"
echo -e "   Restart backend:     ${PURPLE}pm2 restart arivu-api${NC}"
echo -e "   Monitor resources:   ${PURPLE}pm2 monit${NC}"
echo -e "   Check backend:       ${PURPLE}curl http://localhost:5000/api/health${NC}"
echo -e "   Nginx logs:          ${PURPLE}sudo tail -f /var/log/nginx/error.log${NC}"
echo ""

echo -e "${BLUE}🔄 To Update Application Later:${NC}"
echo -e "   cd /home/ubuntu/Arivu"
echo -e "   git pull"
echo -e "   cd server && npm install && pm2 restart arivu-api"
echo -e "   cd ../client && npm install && npm run build"
echo ""

echo -e "${GREEN}🎯 Next Steps:${NC}"
echo -e "   1. Open ${BLUE}http://43.204.144.169${NC} in your browser"
echo -e "   2. Login with the credentials above"
echo -e "   3. Change your admin password"
echo -e "   4. Start using Arivu CRM!"
echo ""

echo -e "${PURPLE}✨ Enjoy your new CRM system! ✨${NC}"
echo ""

# Show final status
echo -e "${BLUE}📈 Final System Check:${NC}"
echo -e "Backend Process: $(pm2 list | grep arivu-api | awk '{print $10}')"
echo -e "Nginx Status: $(sudo systemctl is-active nginx)"
echo ""

echo -e "${GREEN}🎊 Deployment script completed successfully! 🎊${NC}"

