#!/bin/bash

# =============================================================================
# LiteDesk - Stop All Services
# =============================================================================
# This script stops MongoDB, Backend, and Frontend
# Usage: ./stop.sh
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    🛑 LiteDesk CRM                        ║"
echo "║              Stopping All Services...                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Stop Frontend
# =============================================================================
echo -e "${BLUE}🎨 Stopping Frontend...${NC}"

# Try to kill using saved PID
if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PROJECT_ROOT/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Frontend stopped (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend process not found${NC}"
    fi
    rm "$PROJECT_ROOT/.frontend.pid"
fi

# Also kill anything on port 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping any remaining process on port 5173..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
fi

echo ""

# =============================================================================
# Stop Backend
# =============================================================================
echo -e "${BLUE}🚀 Stopping Backend...${NC}"

# Try to kill using saved PID
if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
    BACKEND_PID=$(cat "$PROJECT_ROOT/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Backend stopped (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend process not found${NC}"
    fi
    rm "$PROJECT_ROOT/.backend.pid"
fi

# Also kill anything on port 3000 (default local port - avoids Apple AirPlay on 5000)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping any remaining process on port 3000..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
fi

# Also check port 5000 (in case using production settings locally)
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping any process on port 5000..."
    lsof -ti :5000 | xargs kill -9 2>/dev/null || true
fi

echo ""

# =============================================================================
# Stop Local MongoDB (if running)
# =============================================================================
echo -e "${BLUE}🗄️  Checking MongoDB...${NC}"

# Check if using local MongoDB
if [ -f "$PROJECT_ROOT/server/.env" ]; then
    source "$PROJECT_ROOT/server/.env" 2>/dev/null || true
    
    if [[ "$MONGO_URI" == *"localhost"* ]] || [[ "$MONGO_URI_LOCAL" == *"localhost"* ]]; then
        echo -e "${YELLOW}📊 Local MongoDB detected${NC}"
        
        # Check if MongoDB is running
        if pgrep -x "mongod" > /dev/null; then
            echo -e "${YELLOW}❓ Do you want to stop local MongoDB?${NC}"
            echo "   (This will stop the MongoDB service)"
            read -p "   Stop MongoDB? (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if command -v brew &> /dev/null && brew services list | grep mongodb-community | grep started > /dev/null; then
                    brew services stop mongodb-community
                    echo -e "${GREEN}✅ MongoDB stopped via Homebrew${NC}"
                elif command -v systemctl &> /dev/null; then
                    sudo systemctl stop mongod
                    echo -e "${GREEN}✅ MongoDB stopped via systemctl${NC}"
                else
                    pkill mongod 2>/dev/null || true
                    echo -e "${GREEN}✅ MongoDB process stopped${NC}"
                fi
            else
                echo -e "${BLUE}ℹ️  MongoDB kept running${NC}"
            fi
        else
            echo -e "${BLUE}ℹ️  Local MongoDB not running${NC}"
        fi
    else
        echo -e "${BLUE}ℹ️  Using MongoDB Atlas (cloud) - nothing to stop locally${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found, skipping MongoDB check${NC}"
fi

echo ""

# =============================================================================
# Clean up log files
# =============================================================================
if [ -f "$PROJECT_ROOT/backend.log" ] || [ -f "$PROJECT_ROOT/frontend.log" ]; then
    echo -e "${YELLOW}❓ Do you want to delete log files?${NC}"
    echo "   • backend.log: $(wc -l < "$PROJECT_ROOT/backend.log" 2>/dev/null || echo 0) lines"
    echo "   • frontend.log: $(wc -l < "$PROJECT_ROOT/frontend.log" 2>/dev/null || echo 0) lines"
    read -p "   Delete logs? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$PROJECT_ROOT/backend.log" "$PROJECT_ROOT/frontend.log"
        echo -e "${GREEN}✅ Log files deleted${NC}"
    else
        echo -e "${BLUE}ℹ️  Log files kept${NC}"
        echo "   • View backend logs: tail -f backend.log"
        echo "   • View frontend logs: tail -f frontend.log"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ All Services Stopped!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✨ LiteDesk stopped successfully!${NC}"
echo ""
echo -e "${BLUE}📝 What was stopped:${NC}"
echo "   • Frontend server (port 5173)"
echo "   • Backend server (port 3000)"
if [[ $REPLY =~ ^[Yy]$ ]] 2>/dev/null; then
    echo "   • Local MongoDB"
fi
echo ""
echo -e "${BLUE}🔄 To start again, run:${NC} ./start.sh"
echo ""
echo -e "${YELLOW}💡 Tip:${NC}"
echo "   • Data is preserved in MongoDB"
echo "   • Just run ./start.sh to continue working"
echo ""
