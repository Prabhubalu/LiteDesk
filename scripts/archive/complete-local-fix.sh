#!/bin/bash

###############################################################################
# Complete Local Development Fix
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║      🔧 Complete Local Development Fix                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Step 1: Kill processes on port 5000
echo -e "${BLUE}Step 1: Freeing port 5000...${NC}"
echo ""

# Check what's on port 5000
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 5000 is in use${NC}"
    lsof -i :5000 | head -5
    echo ""
    
    # Kill it
    echo "Stopping process on port 5000..."
    lsof -ti :5000 | xargs kill -9 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Port 5000 freed${NC}"
else
    echo -e "${GREEN}✅ Port 5000 is free${NC}"
fi

echo ""

# Step 2: Fix .env file
echo -e "${BLUE}Step 2: Creating clean .env file...${NC}"
echo ""

cd /Users/Prabhu/Documents/GitHub/LiteDesk/server

# Backup
cp .env .env.backup.corrupted.$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}📋 Backed up corrupted .env${NC}"

# Create CLEAN .env
cat > .env << 'ENVEOF'
# =============================================================================
# LiteDesk CRM - Local Development Configuration
# =============================================================================

NODE_ENV=development
PORT=5000

# -----------------------------------------------------------------------------
# DATABASE (MongoDB Atlas)
# -----------------------------------------------------------------------------
MONGO_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb
MONGODB_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# -----------------------------------------------------------------------------
# SECURITY
# -----------------------------------------------------------------------------
JWT_SECRET=6.6731011Kgnm2!
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_change_in_production
REFRESH_TOKEN_EXPIRE=30d
MASTER_API_KEY=your_master_api_key_change_in_production

# -----------------------------------------------------------------------------
# URLS (Local Development)
# -----------------------------------------------------------------------------
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:3000,http://localhost:5174

# -----------------------------------------------------------------------------
# ADMIN
# -----------------------------------------------------------------------------
DEFAULT_ADMIN_EMAIL=admin@litedesk.com
DEFAULT_ADMIN_PASSWORD=Admin@123456

# -----------------------------------------------------------------------------
# MONITORING (Disabled for local)
# -----------------------------------------------------------------------------
ENABLE_HEALTH_CHECKER=false
ENABLE_METRICS_COLLECTOR=false

# -----------------------------------------------------------------------------
# FEATURES
# -----------------------------------------------------------------------------
ENABLE_DEMO_CONVERSION=true
ENABLE_INSTANCE_PROVISIONING=false
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_STRIPE_INTEGRATION=false

LOG_LEVEL=info
BASE_DOMAIN=litedesk.local
ENVEOF

echo -e "${GREEN}✅ Clean .env created${NC}"
echo ""

# Step 3: Start backend
echo -e "${BLUE}Step 3: Starting backend server...${NC}"
echo ""

# Make sure we're in server directory
cd /Users/Prabhu/Documents/GitHub/LiteDesk/server

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Start backend in background
echo "Starting backend on port 5000..."
nohup node server.js > /Users/Prabhu/Documents/GitHub/LiteDesk/backend.log 2>&1 &
BACKEND_PID=$!

# Save PID
echo $BACKEND_PID > /Users/Prabhu/Documents/GitHub/LiteDesk/.backend.pid

# Wait for backend
echo "Waiting for backend to start..."
sleep 3

MAX_ATTEMPTS=15
ATTEMPT=0
until curl -s http://localhost:5000/health > /dev/null 2>&1 || curl -s http://localhost:5000/ > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo ""
        echo "Last 20 lines of backend log:"
        tail -20 /Users/Prabhu/Documents/GitHub/LiteDesk/backend.log
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ Backend started! (PID: $BACKEND_PID)${NC}"
echo ""

# Step 4: Test backend
echo -e "${BLUE}Step 4: Testing backend...${NC}"
echo ""

# Test health
HEALTH=$(curl -s http://localhost:5000/health 2>&1 || echo "not responding")
echo "Health endpoint: $HEALTH"

# Test root
echo ""
ROOT=$(curl -s http://localhost:5000/ 2>&1 | head -1 || echo "not responding")
echo "Root endpoint: $ROOT"

echo ""

# Step 5: Show status
echo ""
echo -e "${GREEN}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         ✅ LOCAL DEVELOPMENT FIXED! ✅                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
echo -e "${BLUE}📊 Backend Status:${NC}"
echo "  PID: $BACKEND_PID"
echo "  Port: 5000"
echo "  Mode: DEVELOPMENT"
echo "  Database: MongoDB Atlas"
echo "  CORS: localhost:5173, localhost:5175"
echo ""
echo -e "${BLUE}🌐 URLs:${NC}"
echo "  Backend:  http://localhost:5000"
echo "  Health:   http://localhost:5000/health"
echo "  Frontend: http://localhost:5173 (or 5175)"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo "  View logs: tail -f backend.log"
echo ""
echo -e "${BLUE}🛑 To stop:${NC}"
echo "  ./stop.sh"
echo ""
echo -e "${GREEN}✨ You can now use your local development environment!${NC}"
echo ""

