#!/bin/bash

# =============================================================================
# Fix Frontend Startup Issues
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🔧 Fix Frontend Startup Issues               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Check Node.js Version
# =============================================================================
echo -e "${BLUE}📊 Checking Node.js version...${NC}"
NODE_VERSION=$(node -v)
echo "Current version: $NODE_VERSION"

# Extract major and minor version
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
NODE_MINOR=$(echo $NODE_VERSION | cut -d. -f2)

if [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; then
    echo -e "${YELLOW}⚠️  Node.js 20.19+ is recommended (you have $NODE_VERSION)${NC}"
    echo "Consider upgrading: https://nodejs.org/"
elif [ "$NODE_MAJOR" -eq 21 ]; then
    echo -e "${YELLOW}⚠️  Node.js 21.x is not officially supported${NC}"
    echo "Recommended versions: 20.19+ or 22.12+"
    echo "It should still work, but consider upgrading"
elif [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version too old!${NC}"
    echo "Please upgrade to 20.19+ or 22.12+"
    exit 1
else
    echo -e "${GREEN}✅ Node.js version OK${NC}"
fi
echo ""

# =============================================================================
# Kill Processes on Frontend Ports
# =============================================================================
echo -e "${BLUE}🔍 Checking for port conflicts...${NC}"

for PORT in 5173 5174 5175 5176; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        PID=$(lsof -ti :$PORT)
        echo -e "${YELLOW}⚠️  Port $PORT is in use by PID $PID${NC}"
        echo "   Killing process..."
        kill -9 $PID 2>/dev/null || sudo kill -9 $PID
        echo -e "${GREEN}✅ Port $PORT freed${NC}"
    fi
done
echo ""

# =============================================================================
# Clean npm cache and node_modules (if needed)
# =============================================================================
echo -e "${YELLOW}❓ Do you want to clean and reinstall dependencies?${NC}"
echo "   (Only needed if you're having package issues)"
read -p "   Clean install? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🧹 Cleaning frontend dependencies...${NC}"
    cd /Users/Prabhu/Documents/GitHub/LiteDesk/client
    
    echo "   Removing node_modules..."
    rm -rf node_modules
    
    echo "   Clearing npm cache..."
    npm cache clean --force
    
    echo "   Reinstalling dependencies..."
    npm install
    
    echo -e "${GREEN}✅ Dependencies reinstalled${NC}"
fi
echo ""

# =============================================================================
# Start Frontend
# =============================================================================
echo -e "${BLUE}🚀 Starting Frontend...${NC}"
cd /Users/Prabhu/Documents/GitHub/LiteDesk/client

# Kill any background processes
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start frontend
echo "   Starting on port 5173..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "   Waiting for frontend to be ready..."
sleep 3

# Check which port it's using
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT=5173
elif lsof -Pi :5174 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT=5174
elif lsof -Pi :5175 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT=5175
else
    PORT="unknown"
fi

if [ "$PORT" != "unknown" ]; then
    echo -e "${GREEN}✅ Frontend started on port $PORT${NC}"
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              ✅ Frontend is Running!                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${GREEN}🌐 Frontend URL:${NC} http://localhost:$PORT"
    echo -e "${BLUE}📊 Process ID:${NC}   $FRONTEND_PID"
    echo ""
    
    # Open browser
    sleep 2
    echo -e "${BLUE}🌍 Opening browser...${NC}"
    if command -v open &> /dev/null; then
        open http://localhost:$PORT
    fi
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "Check the console output above for errors"
    exit 1
fi

