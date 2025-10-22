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

# Also kill anything on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping any remaining process on port 3000..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
fi

echo ""

# =============================================================================
# Stop MongoDB
# =============================================================================
echo -e "${BLUE}🗄️  Stopping MongoDB...${NC}"

if docker ps --format '{{.Names}}' | grep -q "^litedesk-mongo$"; then
    docker stop litedesk-mongo > /dev/null 2>&1
    echo -e "${GREEN}✅ MongoDB stopped${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB container not running${NC}"
fi

echo ""

# =============================================================================
# Ask about cleanup
# =============================================================================
echo -e "${YELLOW}❓ Do you want to remove the MongoDB container?${NC}"
echo "   (This will delete all data - databases, users, etc.)"
read -p "   Remove container? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if docker ps -a --format '{{.Names}}' | grep -q "^litedesk-mongo$"; then
        docker rm litedesk-mongo > /dev/null 2>&1
        echo -e "${GREEN}✅ MongoDB container removed${NC}"
        echo -e "${YELLOW}⚠️  All data has been deleted${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  MongoDB container kept (data preserved)${NC}"
    echo "   To start it again, just run: ./start.sh"
fi

echo ""

# =============================================================================
# Clean up log files
# =============================================================================
if [ -f "$PROJECT_ROOT/backend.log" ] || [ -f "$PROJECT_ROOT/frontend.log" ]; then
    echo -e "${YELLOW}❓ Do you want to delete log files?${NC}"
    read -p "   Delete logs? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$PROJECT_ROOT/backend.log" "$PROJECT_ROOT/frontend.log"
        echo -e "${GREEN}✅ Log files deleted${NC}"
    else
        echo -e "${BLUE}ℹ️  Log files kept${NC}"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ All Services Stopped!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✨ LiteDesk stopped successfully!${NC}"
echo ""
echo -e "${BLUE}To start again, run:${NC} ./start.sh"
echo ""

