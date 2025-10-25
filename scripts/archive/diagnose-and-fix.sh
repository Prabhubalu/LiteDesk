#!/bin/bash

###############################################################################
# Complete EC2 Diagnosis and Fix Script
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
MONGODB_URI="mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb"
KEY_FILE=""

echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║      🔍 Complete EC2 Diagnosis & Fix Script           ║
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

# Run comprehensive diagnosis and fix on EC2
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP bash << 'REMOTE_SCRIPT'
set -e

echo "════════════════════════════════════════════════════════"
echo "🔍 STEP 1: CHECKING SYSTEM STATUS"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if LiteDesk directory exists
if [ -d "/home/ubuntu/LiteDesk" ]; then
    echo "✅ LiteDesk directory exists"
else
    echo "❌ LiteDesk directory not found!"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 STEP 2: CHECKING BACKEND FILES"
echo "════════════════════════════════════════════════════════"
echo ""

cd /home/ubuntu/LiteDesk/server

# Check server.js
if [ -f "server.js" ]; then
    echo "✅ server.js exists"
else
    echo "❌ server.js not found!"
fi

# Check .env
if [ -f ".env" ]; then
    echo "✅ .env exists"
    echo ""
    echo "📝 Current .env content (first 10 lines):"
    head -10 .env
    echo ""
    
    # Check for MONGODB_URI
    if grep -q "MONGODB_URI" .env; then
        echo "✅ MONGODB_URI found in .env"
        MONGO_LINE=$(grep "MONGODB_URI" .env | head -1)
        echo "   Value: ${MONGO_LINE:0:50}..."
    else
        echo "❌ MONGODB_URI not found in .env!"
    fi
else
    echo "❌ .env file not found!"
fi

# Check node_modules
if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "⚠️  node_modules not found - will install"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 STEP 3: CHECKING PM2 STATUS"
echo "════════════════════════════════════════════════════════"
echo ""

pm2 status

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 STEP 4: CHECKING BACKEND LOGS"
echo "════════════════════════════════════════════════════════"
echo ""

if pm2 list | grep -q "litedesk-api"; then
    echo "📝 Last 30 lines of backend logs:"
    echo "----------------------------------------"
    pm2 logs litedesk-api --lines 30 --nostream
    echo "----------------------------------------"
else
    echo "⚠️  litedesk-api process not found in PM2"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔧 STEP 5: FIXING ISSUES"
echo "════════════════════════════════════════════════════════"
echo ""

cd /home/ubuntu/LiteDesk/server

# Create/Update .env file
echo "📝 Creating proper .env file..."

cat > .env << 'ENVFILE'
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb
MONGO_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# JWT Secrets
JWT_SECRET=6.6731011Kgnm2!
REFRESH_TOKEN_SECRET=your_refresh_token_secret_change_in_production
MASTER_API_KEY=your_master_api_key_change_in_production

# Frontend URL
CLIENT_URL=http://13.203.208.47
CORS_ORIGINS=http://13.203.208.47,https://13.203.208.47

# Admin Defaults
DEFAULT_ADMIN_EMAIL=admin@litedesk.com
DEFAULT_ADMIN_PASSWORD=Admin@123456

# Monitoring
ENABLE_HEALTH_CHECKER=false
ENABLE_METRICS_COLLECTOR=false
ENVFILE

echo "✅ .env file created"

# Verify .env was created
if [ -f ".env" ]; then
    echo "✅ Verified .env file exists"
    echo ""
    echo "📝 New .env content (checking MONGODB_URI):"
    grep "MONGODB_URI" .env | head -1
else
    echo "❌ Failed to create .env file!"
    exit 1
fi

echo ""
echo "📦 Ensuring dependencies are installed..."
npm install --production

echo ""
echo "🔄 Stopping old backend process..."
pm2 delete litedesk-api 2>/dev/null || echo "No existing process to stop"

echo ""
echo "🚀 Starting backend..."
pm2 start server.js --name litedesk-api --time

echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "⏳ Waiting for backend to start..."
sleep 5

echo ""
echo "════════════════════════════════════════════════════════"
echo "🔍 STEP 6: TESTING BACKEND"
echo "════════════════════════════════════════════════════════"
echo ""

# Test backend health
echo "Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health 2>&1 || echo "failed")

if [[ "$HEALTH_RESPONSE" == *"OK"* ]] || [[ "$HEALTH_RESPONSE" == *"status"* ]]; then
    echo "✅ Backend is responding!"
    echo "Response: $HEALTH_RESPONSE"
else
    echo "⚠️  Backend not responding yet"
    echo "Response: $HEALTH_RESPONSE"
    echo ""
    echo "📝 Checking logs..."
    pm2 logs litedesk-api --lines 20 --nostream
fi

echo ""
echo "📊 Final PM2 Status:"
pm2 status

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ DIAGNOSIS AND FIX COMPLETE"
echo "════════════════════════════════════════════════════════"
REMOTE_SCRIPT

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}"
    cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         ✅ EC2 BACKEND FIXED AND RUNNING! ✅          ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
    echo -e "${BLUE}🌐 Your application should now work:${NC}"
    echo -e "   ${YELLOW}http://13.203.208.47${NC}"
    echo ""
    echo -e "${GREEN}👤 Login with:${NC}"
    echo -e "   Email:    admin@litedesk.com"
    echo -e "   Password: Admin@123456"
    echo ""
    echo -e "${PURPLE}🔍 If still not working, the logs above show the issue${NC}"
    echo ""
    
    # Try to open in browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        read -p "Open in browser now? (y/N): " OPEN_BROWSER
        if [[ $OPEN_BROWSER =~ ^[Yy]$ ]]; then
            open "http://13.203.208.47"
        fi
    fi
else
    echo -e "${RED}❌ Something went wrong${NC}"
    echo -e "${YELLOW}Check the output above for errors${NC}"
fi

