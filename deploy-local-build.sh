#!/bin/bash

###############################################################################
# Arivu CRM - Local Build + EC2 Deploy (FREE TIER OPTIMIZED)
###############################################################################
# This script builds frontend LOCALLY (your Mac) and deploys to EC2
# Perfect for t2.micro (1GB RAM) - avoids memory issues!
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
EC2_IP="13.203.208.47"
EC2_USER="ubuntu"
MONGODB_URI="mongodb+srv://arivuadmin:TKvtQbKGOWdfP5C1@arivudb.qzw4euo.mongodb.net/arivu?retryWrites=true&w=majority&appName=arivudb"
ADMIN_EMAIL="admin@arivu.com"
ADMIN_PASSWORD="Admin@123456"
KEY_FILE=""

# Public URLs (frontend lives on the same EC2 box behind nginx on :80).
# Override with PUBLIC_BASE_URL=https://your-domain ./deploy-local-build.sh if
# you've put a domain/HTTPS in front.
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://$EC2_IP}"

# Gmail OAuth web client (project 64604669022). Must match the Authorized
# redirect URI on the Google Cloud OAuth client EXACTLY. Pass these in via
# env when running the script so secrets don't live in source control:
#   GOOGLE_GMAIL_CLIENT_ID=... \
#   GOOGLE_GMAIL_CLIENT_SECRET=... \
#   MAILBOX_OAUTH_SECRET=... \
#   ./deploy-local-build.sh
GOOGLE_GMAIL_CLIENT_ID="${GOOGLE_GMAIL_CLIENT_ID:-}"
GOOGLE_GMAIL_CLIENT_SECRET="${GOOGLE_GMAIL_CLIENT_SECRET:-}"
GOOGLE_GMAIL_REDIRECT_URI="${GOOGLE_GMAIL_REDIRECT_URI:-$PUBLIC_BASE_URL/api/mailboxes/inbox-sync/google/callback}"
MAILBOX_OAUTH_SECRET="${MAILBOX_OAUTH_SECRET:-}"

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    🚀 Arivu CRM - Free Tier Optimized Deployment         ║
║         Build Locally → Deploy to EC2 (1GB RAM OK!)          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}✨ This script is optimized for AWS Free Tier (t2.micro)${NC}"
echo -e "${YELLOW}📦 Builds frontend on your Mac (avoids EC2 memory issues)${NC}"
echo -e "${PURPLE}🚀 Deploys only the built files to EC2${NC}"
echo ""

# Check if we're in the Arivu directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
    echo -e "${RED}❌ Error: Must run from Arivu directory${NC}"
    echo -e "${YELLOW}Please run: cd /Users/Prabhu/Documents/GitHub/Arivu${NC}"
    exit 1
fi

# Ask for SSH key
echo -e "${BLUE}🔑 SSH Key Setup${NC}"
read -p "Enter path to your EC2 SSH key (.pem): " KEY_FILE
KEY_FILE="${KEY_FILE/#\~/$HOME}"

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Key file not found: $KEY_FILE${NC}"
    exit 1
fi

chmod 400 "$KEY_FILE"
echo -e "${GREEN}✓ SSH key validated${NC}"
echo ""

# Test connection
echo -e "${BLUE}🔌 Testing EC2 connection...${NC}"
if ! ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo ''" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to EC2${NC}"
    echo -e "${YELLOW}Check: Instance running? Security group allows SSH?${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected to EC2${NC}"
echo ""

###############################################################################
# PART 1: Build Frontend Locally (on your Mac)
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 1: Building Frontend Locally${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd client

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Create production environment file
echo -e "${BLUE}🔧 Creating production config...${NC}"
cat > .env.production << EOF
VITE_API_URL=http://$EC2_IP/api
EOF
echo -e "${GREEN}✓ Production config created${NC}"

# Build frontend
echo -e "${PURPLE}🔨 Building frontend (this may take 2-3 minutes)...${NC}"
npm run build

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}❌ Build failed - dist folder not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend built successfully!${NC}"
echo -e "${YELLOW}📊 Build size: $(du -sh dist | cut -f1)${NC}"
echo ""

cd ..

###############################################################################
# PART 2: Prepare Backend Files
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 2: Preparing Backend${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Generate secure secrets (will be created directly on EC2)
echo -e "${BLUE}🔐 Generating secure secrets for production...${NC}"
JWT_SECRET=$(openssl rand -hex 64)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 64)
MASTER_API_KEY=$(openssl rand -hex 32)
echo -e "${GREEN}✓ Secrets generated${NC}"
echo -e "${YELLOW}ℹ️  Local .env will NOT be modified or uploaded${NC}"
echo ""

###############################################################################
# PART 3: Setup EC2 Server
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 3: Setting Up EC2 Server${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Installing required software on EC2...${NC}"

# Create setup script
cat > /tmp/ec2-setup.sh << 'SETUPSCRIPT'
#!/bin/bash
set -e

echo "📦 Updating system..."
sudo apt update -qq
sudo apt upgrade -y -qq

echo "📦 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "🌐 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

echo "🔄 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo "✅ EC2 setup complete!"
SETUPSCRIPT

# Upload and run setup script
scp -i "$KEY_FILE" -o StrictHostKeyChecking=no /tmp/ec2-setup.sh "$EC2_USER@$EC2_IP:/tmp/"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "bash /tmp/ec2-setup.sh"

echo -e "${GREEN}✓ EC2 server configured${NC}"
echo ""

###############################################################################
# PART 4: Upload Application Files
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 4: Uploading Application${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create app directory on EC2
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "mkdir -p /home/ubuntu/Arivu"

echo -e "${YELLOW}📤 Uploading backend files...${NC}"
echo -e "${BLUE}ℹ️  Excluding .env (will be created on EC2 with production settings)${NC}"
# Upload backend (excluding node_modules and .env)
rsync -avz --progress -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '.env.*' \
    ./server/ "$EC2_USER@$EC2_IP:/home/ubuntu/Arivu/server/"

echo -e "${YELLOW}📤 Uploading frontend build...${NC}"
# Upload frontend build
rsync -avz --progress -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
    ./client/dist/ "$EC2_USER@$EC2_IP:/home/ubuntu/Arivu/client/dist/"

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

###############################################################################
# PART 5: Install Backend Dependencies & Start
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 5: Installing Backend Dependencies${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}📦 Installing backend dependencies on EC2...${NC}"
echo -e "${YELLOW}(This is lightweight - only backend packages)${NC}"

# Create production .env on EC2
echo -e "${BLUE}📝 Creating production .env on EC2...${NC}"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << ENVSETUP
cd /home/ubuntu/Arivu/server

# Backup existing .env if it exists
if [ -f .env ]; then
    echo "Backing up existing .env..."
    cp .env .env.backup.\$(date +%Y%m%d_%H%M%S)
fi

# Create production .env
cat > .env << 'PRODENV'
# =============================================================================
# Arivu CRM - Production Configuration (AWS EC2)
# =============================================================================

NODE_ENV=production
PORT=5000

# -----------------------------------------------------------------------------
# DATABASE - MongoDB Atlas (Cloud)
# -----------------------------------------------------------------------------
MONGO_URI=$MONGODB_URI
MONGODB_URI=$MONGODB_URI

# -----------------------------------------------------------------------------
# SECURITY
# -----------------------------------------------------------------------------
JWT_SECRET=$JWT_SECRET
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET
REFRESH_TOKEN_EXPIRE=30d
MASTER_API_KEY=$MASTER_API_KEY

# -----------------------------------------------------------------------------
# APPLICATION URLS (Production)
# -----------------------------------------------------------------------------
CLIENT_URL=$PUBLIC_BASE_URL
CORS_ORIGINS=$PUBLIC_BASE_URL,http://$EC2_IP,https://$EC2_IP

# -----------------------------------------------------------------------------
# GMAIL OAUTH (server-wide fallback; tenants may override via Settings →
# Integrations → Email → Advanced). Required for personal mailbox inbox sync.
# -----------------------------------------------------------------------------
GOOGLE_GMAIL_CLIENT_ID=$GOOGLE_GMAIL_CLIENT_ID
GOOGLE_GMAIL_CLIENT_SECRET=$GOOGLE_GMAIL_CLIENT_SECRET
GOOGLE_GMAIL_REDIRECT_URI=$GOOGLE_GMAIL_REDIRECT_URI
MAILBOX_OAUTH_SECRET=$MAILBOX_OAUTH_SECRET

# -----------------------------------------------------------------------------
# ADMIN DEFAULTS
# -----------------------------------------------------------------------------
DEFAULT_ADMIN_EMAIL=$ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD

# -----------------------------------------------------------------------------
# MONITORING
# -----------------------------------------------------------------------------
ENABLE_HEALTH_CHECKER=true
ENABLE_METRICS_COLLECTOR=true

# -----------------------------------------------------------------------------
# FEATURES
# -----------------------------------------------------------------------------
ENABLE_DEMO_CONVERSION=true
ENABLE_INSTANCE_PROVISIONING=false
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_STRIPE_INTEGRATION=false

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------
LOG_LEVEL=info
DEBUG_PROVISIONING=false
DEBUG_KUBERNETES=false
DEBUG_DATABASE=false
DEBUG_DNS=false

# -----------------------------------------------------------------------------
# OTHER
# -----------------------------------------------------------------------------
BASE_DOMAIN=$EC2_IP
RATE_LIMIT_WINDOW_MS=60000
AUTHENTICATED_API_RATE_LIMIT_MAX_REQUESTS=300
ANONYMOUS_API_RATE_LIMIT_MAX_REQUESTS=60
SESSION_BOOTSTRAP_RATE_LIMIT_MAX_REQUESTS=600
PRODENV

echo "✅ Production .env created!"
ENVSETUP

echo -e "${GREEN}✓ Production environment configured on EC2${NC}"

# Install dependencies and start backend
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'REMOTE'
cd /home/ubuntu/Arivu/server
npm install --production --no-audit

# Create default admin if script exists
if [ -f "scripts/createDefaultAdmin.js" ]; then
    echo "👤 Creating default admin user..."
    node scripts/createDefaultAdmin.js || echo "Admin may already exist"
fi

# Stop existing PM2 process
pm2 delete arivu-api 2>/dev/null || true

# Start backend (fresh start re-reads .env via dotenv)
pm2 start server.js --name arivu-api --time
pm2 save

# Setup startup
pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep "sudo env" | bash || true

# Verify the env we care about actually got loaded into the live process.
# (PM2 caches env at process start, so if anything looks empty here it would
# also look empty inside Node. Re-deploys via this script always do a fresh
# pm2 start, which is what re-reads .env.)
echo ""
echo "🔎 Verifying OAuth env on running backend..."
PM_ID=$(pm2 jlist | python3 -c "import sys,json;print(next(p['pm_id'] for p in json.load(sys.stdin) if p['name']=='arivu-api'))" 2>/dev/null || echo "")
if [ -n "$PM_ID" ]; then
  pm2 env "$PM_ID" 2>/dev/null \
    | grep -E '^(CLIENT_URL|GOOGLE_GMAIL_CLIENT_ID|GOOGLE_GMAIL_REDIRECT_URI|MAILBOX_OAUTH_SECRET):' \
    | sed -E 's/(CLIENT_SECRET|MAILBOX_OAUTH_SECRET): .+/\1: <redacted>/' \
    || echo "⚠️  Could not read env — check 'pm2 env $PM_ID' manually"
fi

echo "✅ Backend started!"
REMOTE

echo -e "${GREEN}✓ Backend deployed and running${NC}"
echo ""

###############################################################################
# PART 6: Configure Nginx
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 6: Configuring Nginx${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create Nginx config
cat > /tmp/nginx-arivu << NGINXCONF
server {
    listen 80;
    server_name $EC2_IP;

    # Binary downloads — never fall back to SPA shell
    location ~* \.zip$ {
        root /home/ubuntu/Arivu/client/dist;
        try_files \$uri =404;
        add_header Content-Type application/zip;
    }

    # Frontend - Serve built files
    location / {
        root /home/ubuntu/Arivu/client/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 26M;
}
NGINXCONF

# Upload and configure Nginx
scp -i "$KEY_FILE" -o StrictHostKeyChecking=no /tmp/nginx-arivu "$EC2_USER@$EC2_IP:/tmp/"

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'REMOTE'
sudo mv /tmp/nginx-arivu /etc/nginx/sites-available/arivu
sudo ln -sf /etc/nginx/sites-available/arivu /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Fix permissions for Nginx to access files
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/Arivu
chmod 755 /home/ubuntu/Arivu/client
chmod -R 755 /home/ubuntu/Arivu/client/dist

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx
REMOTE

echo -e "${GREEN}✓ Nginx configured${NC}"
echo -e "${GREEN}✓ Permissions set correctly${NC}"
echo ""

###############################################################################
# PART 7: Test Deployment
###############################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC} ${PURPLE}PART 7: Testing Deployment${NC} ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Waiting for backend to start...${NC}"
sleep 5

# Test backend health
echo -e "${BLUE}Testing backend...${NC}"
if ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "curl -s http://localhost:5000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend might need a moment${NC}"
fi

# Check PM2 status
echo -e "${BLUE}Checking application status...${NC}"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "pm2 status"
echo ""

###############################################################################
# Deployment Complete
###############################################################################
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║           ✅ DEPLOYMENT COMPLETED SUCCESSFULLY! ✅           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}          ${PURPLE}🎉 YOUR APPLICATION IS NOW LIVE! 🎉${NC}              ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}🌐 Access your application at:${NC}"
echo -e "   ${BLUE}http://$EC2_IP${NC}"
echo ""

echo -e "${GREEN}👤 Login Credentials:${NC}"
echo -e "   ${PURPLE}Email:${NC}     $ADMIN_EMAIL"
echo -e "   ${PURPLE}Password:${NC}  $ADMIN_PASSWORD"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo -e "   ${RED}Change your admin password after first login!${NC}"
echo ""

echo -e "${BLUE}📊 Deployment Method:${NC}"
echo -e "   ✅ Frontend: Built locally (no EC2 memory issues!)"
echo -e "   ✅ Backend:  Lightweight install on EC2"
echo -e "   ✅ Perfect for AWS Free Tier (t2.micro)"
echo ""

echo -e "${BLUE}📝 Useful Commands (SSH into EC2):${NC}"
echo -e "   ${PURPLE}ssh -i $KEY_FILE ubuntu@$EC2_IP${NC}"
echo -e ""
echo -e "   pm2 logs arivu-api       # View logs"
echo -e "   pm2 restart arivu-api    # Restart backend"
echo -e "   pm2 monit                   # Monitor resources"
echo ""

echo -e "${BLUE}🔄 To Update Application:${NC}"
echo -e "   1. Make changes locally"
echo -e "   2. Run this script again: ${PURPLE}./deploy-local-build.sh${NC}"
echo ""

echo -e "${GREEN}✨ Enjoy your CRM system! ✨${NC}"
echo ""

# Try to open in browser (Mac only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    read -p "Open in browser now? (yes/no): " OPEN_BROWSER
    if [[ $OPEN_BROWSER =~ ^[Yy] ]]; then
        open "http://$EC2_IP"
    fi
fi

# Cleanup temp files
rm -f /tmp/ec2-setup.sh /tmp/nginx-arivu

echo -e "${PURPLE}🎊 Deployment complete! Your CRM is ready to use! 🎊${NC}"

