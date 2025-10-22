#!/bin/bash

# =============================================================================
# LiteDesk - Start All Services
# =============================================================================
# This script starts MongoDB, Backend, and Frontend in one command
# Usage: ./start.sh
# =============================================================================

set -e  # Exit on error

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
echo "║                    🚀 LiteDesk CRM                        ║"
echo "║              Starting All Services...                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Check Prerequisites
# =============================================================================
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from: https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met!${NC}"
echo ""

# =============================================================================
# Start MongoDB
# =============================================================================
echo -e "${BLUE}🗄️  Starting MongoDB...${NC}"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^litedesk-mongo$"; then
    echo -e "${YELLOW}⚠️  MongoDB container already exists${NC}"
    
    # Check if it's running
    if docker ps --format '{{.Names}}' | grep -q "^litedesk-mongo$"; then
        echo -e "${GREEN}✅ MongoDB is already running${NC}"
    else
        echo "   Starting existing container..."
        docker start litedesk-mongo
        echo -e "${GREEN}✅ MongoDB started${NC}"
    fi
else
    echo "   Creating new MongoDB container..."
    docker run -d \
        --name litedesk-mongo \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=admin \
        -e MONGO_INITDB_ROOT_PASSWORD=password123 \
        mongo:6.0 > /dev/null 2>&1
    
    echo -e "${GREEN}✅ MongoDB started successfully${NC}"
fi

# Wait for MongoDB to be ready
echo "   Waiting for MongoDB to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while ! docker exec litedesk-mongo mongosh --quiet --eval "db.adminCommand('ping')" -u admin -p password123 --authenticationDatabase admin &> /dev/null; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ MongoDB failed to start${NC}"
        exit 1
    fi
    sleep 1
done
echo -e "${GREEN}✅ MongoDB is ready!${NC}"
echo ""

# =============================================================================
# Start Backend Server
# =============================================================================
echo -e "${BLUE}🚀 Starting Backend Server...${NC}"

cd "$PROJECT_ROOT/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Kill any existing process on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping existing backend server..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start backend in background
echo "   Starting backend on port 3000..."
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "   Waiting for backend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://localhost:3000/ > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo "Check backend.log for errors"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ Backend is ready! (PID: $BACKEND_PID)${NC}"
echo ""

# =============================================================================
# Start Frontend Server
# =============================================================================
echo -e "${BLUE}🎨 Starting Frontend Server...${NC}"

cd "$PROJECT_ROOT/client"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Kill any existing process on port 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping existing frontend server..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Fix permissions if needed
if [ -d "node_modules" ]; then
    echo "   Checking permissions..."
    if [ "$(stat -f '%u' node_modules)" != "$(id -u)" ]; then
        echo "   Fixing node_modules permissions (may require password)..."
        sudo chown -R $(whoami) node_modules 2>/dev/null || true
    fi
fi

# Start frontend in background
echo "   Starting frontend on port 5173..."
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "   Waiting for frontend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://localhost:5173/ > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Frontend failed to start${NC}"
        echo "Check frontend.log for errors"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ Frontend is ready! (PID: $FRONTEND_PID)${NC}"
echo ""

# =============================================================================
# All Services Started
# =============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ All Services Running!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🌐 Frontend:${NC}  http://localhost:5173"
echo -e "${GREEN}🚀 Backend:${NC}   http://localhost:3000"
echo -e "${GREEN}🗄️  MongoDB:${NC}  mongodb://admin:password123@localhost:27017"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo "   • MongoDB:  Running (Docker container: litedesk-mongo)"
echo "   • Backend:  Running (PID: $BACKEND_PID)"
echo "   • Frontend: Running (PID: $FRONTEND_PID)"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo "   • Backend:  tail -f backend.log"
echo "   • Frontend: tail -f frontend.log"
echo "   • MongoDB:  docker logs -f litedesk-mongo"
echo ""
echo -e "${YELLOW}🛑 To stop all services:${NC}"
echo "   ./stop.sh"
echo ""

# Save PIDs to file for stop script
echo "$BACKEND_PID" > "$PROJECT_ROOT/.backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_ROOT/.frontend.pid"

# Open browser (optional - comment out if you don't want auto-open)
sleep 2
echo -e "${BLUE}🌍 Opening browser...${NC}"
if command -v open &> /dev/null; then
    open http://localhost:5173
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
fi

echo ""
echo -e "${GREEN}✨ LiteDesk is ready! Happy coding! 🚀${NC}"
echo ""

