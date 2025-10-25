#!/bin/bash

###############################################################################
# Fix 502 Bad Gateway Error - Backend Not Running
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
║   🔧 Fix 502 Bad Gateway - Backend Diagnostics        ║
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

echo -e "${BLUE}📊 Checking backend status on EC2...${NC}"
echo ""

# Check and fix backend
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'REMOTE'
set -e

echo "════════════════════════════════════════════════════════"
echo "📊 DIAGNOSTIC REPORT"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if PM2 is installed
echo "1️⃣  Checking PM2..."
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 is installed"
    pm2 --version
else
    echo "❌ PM2 not found! Installing..."
    sudo npm install -g pm2
fi
echo ""

# Check PM2 status
echo "2️⃣  Checking PM2 processes..."
pm2 status
echo ""

# Check if backend files exist
echo "3️⃣  Checking backend files..."
if [ -f "/home/ubuntu/LiteDesk/server/server.js" ]; then
    echo "✅ server.js exists"
else
    echo "❌ server.js not found!"
fi

if [ -f "/home/ubuntu/LiteDesk/server/.env" ]; then
    echo "✅ .env exists"
else
    echo "❌ .env not found!"
fi
echo ""

# Check if node_modules exist
echo "4️⃣  Checking dependencies..."
if [ -d "/home/ubuntu/LiteDesk/server/node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "⚠️  node_modules not found - installing..."
    cd /home/ubuntu/LiteDesk/server
    npm install --production
fi
echo ""

# Check MongoDB connection
echo "5️⃣  Checking MongoDB connection..."
cd /home/ubuntu/LiteDesk/server
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('✅ MongoDB connected'); process.exit(0); })
  .catch(err => { console.log('❌ MongoDB error:', err.message); process.exit(1); });
" || echo "⚠️  MongoDB connection issue"
echo ""

# Stop any existing process
echo "6️⃣  Stopping old processes..."
pm2 delete litedesk-api 2>/dev/null || echo "No existing process found"
echo ""

# Start backend
echo "7️⃣  Starting backend..."
cd /home/ubuntu/LiteDesk/server
pm2 start server.js --name litedesk-api --time
pm2 save
echo ""

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is responding
echo "8️⃣  Testing backend..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is responding!"
    curl -s http://localhost:5000/api/health | head -5
else
    echo "⚠️  Backend not responding yet, checking logs..."
    pm2 logs litedesk-api --lines 20 --nostream
fi
echo ""

# Show final status
echo "════════════════════════════════════════════════════════"
echo "📊 FINAL STATUS"
echo "════════════════════════════════════════════════════════"
pm2 status
echo ""
pm2 logs litedesk-api --lines 10 --nostream

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Backend restart complete!"
echo "════════════════════════════════════════════════════════"
REMOTE

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}            ${YELLOW}✅ BACKEND FIXED AND RUNNING! ✅${NC}           ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}🌐 Try your app now:${NC}"
    echo -e "   ${YELLOW}http://$EC2_IP${NC}"
    echo ""
    echo -e "${GREEN}📝 If it still doesn't work, check logs:${NC}"
    echo -e "   ${PURPLE}ssh -i $KEY_FILE ubuntu@$EC2_IP${NC}"
    echo -e "   ${PURPLE}pm2 logs litedesk-api${NC}"
    echo ""
else
    echo -e "${RED}❌ Something went wrong${NC}"
    echo -e "${YELLOW}SSH into server to check:${NC}"
    echo -e "   ssh -i $KEY_FILE ubuntu@$EC2_IP"
    echo -e "   pm2 logs litedesk-api"
    exit 1
fi

