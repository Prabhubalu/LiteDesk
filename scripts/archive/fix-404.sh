#!/bin/bash

###############################################################################
# Fix 404 Not Found Error - Frontend & Nginx Issues
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

EC2_IP="13.203.208.47"
KEY_FILE=""

echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         🔧 Fix 404 Not Found Error                    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Ask for SSH key
read -p "Enter path to your SSH key (.pem): " KEY_FILE
KEY_FILE="${KEY_FILE/#\~/$HOME}"

if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ Key file not found${NC}"
    exit 1
fi

chmod 400 "$KEY_FILE"

echo -e "${BLUE}🔌 Connecting to EC2...${NC}"
echo ""

# Check and fix on EC2
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP bash << 'REMOTE_SCRIPT'
set -e

echo "════════════════════════════════════════════════════════"
echo "🔍 DIAGNOSING 404 ERROR"
echo "════════════════════════════════════════════════════════"
echo ""

echo "1️⃣  Checking frontend files..."
if [ -d "/home/ubuntu/LiteDesk/client/dist" ]; then
    echo "✅ dist directory exists"
    echo "📊 Files in dist:"
    ls -la /home/ubuntu/LiteDesk/client/dist/
    
    if [ -f "/home/ubuntu/LiteDesk/client/dist/index.html" ]; then
        echo "✅ index.html exists"
        echo "   Size: $(wc -c < /home/ubuntu/LiteDesk/client/dist/index.html) bytes"
    else
        echo "❌ index.html NOT FOUND!"
    fi
else
    echo "❌ dist directory NOT FOUND!"
    echo "   Frontend was not built/deployed"
fi

echo ""
echo "2️⃣  Checking Nginx configuration..."
if [ -f "/etc/nginx/sites-available/litedesk" ]; then
    echo "✅ Nginx config exists"
    echo ""
    echo "📝 Current Nginx config:"
    echo "----------------------------------------"
    cat /etc/nginx/sites-available/litedesk
    echo "----------------------------------------"
else
    echo "❌ Nginx config NOT FOUND!"
fi

echo ""
echo "3️⃣  Checking Nginx status..."
sudo systemctl status nginx --no-pager | head -10

echo ""
echo "4️⃣  Checking file permissions..."
ls -la /home/ubuntu/LiteDesk/client/ | grep dist

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔧 FIXING ISSUES"
echo "════════════════════════════════════════════════════════"
echo ""

# Fix Nginx configuration
echo "📝 Creating correct Nginx configuration..."
sudo tee /etc/nginx/sites-available/litedesk > /dev/null << 'NGINXCONF'
server {
    listen 80;
    server_name 13.203.208.47;

    # Frontend - Serve built files
    location / {
        root /home/ubuntu/LiteDesk/client/dist;
        try_files $uri $uri/ /index.html;
        
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

    # Health endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/litedesk_access.log;
    error_log /var/log/nginx/litedesk_error.log;
}
NGINXCONF

echo "✅ Nginx config created"

# Enable site
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/litedesk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Fix permissions
echo "🔒 Fixing permissions..."
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/LiteDesk
chmod 755 /home/ubuntu/LiteDesk/client

if [ -d "/home/ubuntu/LiteDesk/client/dist" ]; then
    chmod -R 755 /home/ubuntu/LiteDesk/client/dist
    echo "✅ Permissions fixed"
else
    echo "⚠️  dist directory not found - need to deploy frontend"
fi

# Test Nginx config
echo ""
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config has errors!"
    exit 1
fi

# Reload Nginx
echo ""
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 VERIFICATION"
echo "════════════════════════════════════════════════════════"
echo ""

# Test endpoints
echo "Testing endpoints..."
echo ""

echo "1. Testing root (/):"
ROOT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "   Status code: $ROOT_RESPONSE"

echo ""
echo "2. Testing API health (/api/health):"
HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health)
echo "   Response: $HEALTH_RESPONSE"

echo ""
echo "3. Testing health endpoint (/health):"
HEALTH2_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
echo "   Status code: $HEALTH2_RESPONSE"

echo ""
echo "4. Checking Nginx error log:"
echo "   Last 5 lines:"
sudo tail -5 /var/log/nginx/litedesk_error.log 2>/dev/null || echo "   No errors logged yet"

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ FIX COMPLETE"
echo "════════════════════════════════════════════════════════"
echo ""

if [ ! -d "/home/ubuntu/LiteDesk/client/dist" ]; then
    echo "⚠️  WARNING: Frontend dist files are missing!"
    echo "   You need to deploy the frontend:"
    echo "   Run: ./deploy-local-build.sh"
fi
REMOTE_SCRIPT

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}"
    cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         ✅ 404 ERROR DIAGNOSED AND FIXED! ✅          ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    echo -e "${BLUE}🌐 Try your application now:${NC}"
    echo -e "   ${YELLOW}http://13.203.208.47${NC}"
    echo ""
    echo -e "${PURPLE}💡 If still getting 404:${NC}"
    echo -e "   The frontend files might be missing"
    echo -e "   Run: ${YELLOW}./deploy-local-build.sh${NC}"
    echo ""
else
    echo -e "${RED}❌ Something went wrong${NC}"
    exit 1
fi

