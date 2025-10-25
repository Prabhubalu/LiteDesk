#!/bin/bash

# =============================================================================
# LiteDesk - Start All Services (Development Mode)
# =============================================================================
# This script starts MongoDB, Backend, and Frontend for local development
# Usage: ./start.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    🚀 LiteDesk CRM                        ║"
echo "║           Starting Development Environment...              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Check Prerequisites
# =============================================================================
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
    echo -e "${RED}❌ .env file not found in server directory${NC}"
    echo "Please create server/.env file (see server/.env.example)"
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# =============================================================================
# Check MongoDB Setup
# =============================================================================
echo -e "${BLUE}🗄️  Checking MongoDB setup...${NC}"

# Read MONGO_URI from .env
source "$PROJECT_ROOT/server/.env" 2>/dev/null || true

# Determine MongoDB type
if [[ "$MONGO_URI" == *"localhost"* ]] || [[ "$MONGO_URI_LOCAL" == *"localhost"* ]]; then
    echo -e "${YELLOW}📊 MongoDB Mode: Local MongoDB${NC}"
    USING_LOCAL_MONGO=true
    MONGO_HOST="localhost:27017"
else
    echo -e "${PURPLE}📊 MongoDB Mode: MongoDB Atlas (Cloud)${NC}"
    USING_LOCAL_MONGO=false
fi

# =============================================================================
# Start Local MongoDB (if needed)
# =============================================================================
if [ "$USING_LOCAL_MONGO" = true ]; then
    echo -e "${BLUE}🗄️  Starting Local MongoDB...${NC}"
    
    # Check if MongoDB is installed
    if command -v mongod &> /dev/null; then
        # Check if MongoDB is already running
        if pgrep -x "mongod" > /dev/null; then
            echo -e "${GREEN}✅ MongoDB is already running${NC}"
        else
            echo "   Starting MongoDB service..."
            # Try different methods to start MongoDB
            if command -v brew &> /dev/null && brew services list | grep mongodb-community > /dev/null; then
                brew services start mongodb-community
                echo -e "${GREEN}✅ MongoDB started via Homebrew${NC}"
            elif command -v systemctl &> /dev/null; then
                sudo systemctl start mongod
                echo -e "${GREEN}✅ MongoDB started via systemctl${NC}"
            else
                # Start mongod manually in background
                mongod --dbpath ~/data/db --fork --logpath ~/data/mongodb.log 2>/dev/null || {
                    echo -e "${YELLOW}⚠️  Could not auto-start MongoDB${NC}"
                    echo "   Please start MongoDB manually: mongod"
                }
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  MongoDB not found locally${NC}"
        echo -e "${BLUE}ℹ️  Options:${NC}"
        echo "   1. Install MongoDB: brew install mongodb-community"
        echo "   2. Use MongoDB Atlas (update MONGO_URI in .env to use Atlas)"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Wait for MongoDB to be ready
    if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
        echo "   Waiting for MongoDB to be ready..."
        MAX_ATTEMPTS=10
        ATTEMPT=0
        MONGO_CMD=$(command -v mongosh || command -v mongo)
        until $MONGO_CMD --quiet --eval "db.adminCommand('ping')" "mongodb://localhost:27017/test" &> /dev/null; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
                echo -e "${YELLOW}⚠️  MongoDB connection timeout${NC}"
                echo "   Continuing anyway..."
                break
            fi
            sleep 1
        done
        if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
            echo -e "${GREEN}✅ MongoDB is ready!${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ Using MongoDB Atlas (cloud)${NC}"
    echo "   Connection will be verified when backend starts"
fi

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

# Backend port (from .env or default to 3000 to avoid Apple AirPlay conflict)
BACKEND_PORT=${PORT:-3000}

# Kill any existing process on backend port
if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping existing backend server on port $BACKEND_PORT..."
    lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Ensure we're in development mode
export NODE_ENV=development

# Start backend in background
echo "   Starting backend on port $BACKEND_PORT..."
echo "   Mode: DEVELOPMENT"
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "   Waiting for backend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1 || curl -s http://localhost:$BACKEND_PORT/ > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo "Check backend.log for errors:"
        echo ""
        tail -20 ../backend.log
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

# Frontend port
FRONTEND_PORT=5173

# Kill any existing process on port 5173
if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   Stopping existing frontend server..."
    lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start frontend in background
echo "   Starting frontend on port $FRONTEND_PORT..."
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "   Waiting for frontend to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until curl -s http://localhost:$FRONTEND_PORT/ > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Frontend failed to start${NC}"
        echo "Check frontend.log for errors:"
        echo ""
        tail -20 ../frontend.log
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
echo "║           ✅ Development Environment Running!             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🌐 Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "${GREEN}🚀 Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "${GREEN}💚 Health:${NC}    http://localhost:$BACKEND_PORT/health"

if [ "$USING_LOCAL_MONGO" = true ]; then
    echo -e "${GREEN}🗄️  MongoDB:${NC}  mongodb://localhost:27017/litedesk"
else
    echo -e "${PURPLE}🗄️  MongoDB:${NC}  MongoDB Atlas (Cloud)"
fi

echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
if [ "$USING_LOCAL_MONGO" = true ]; then
    echo "   • MongoDB:  Running (Local)"
fi
echo "   • Backend:  Running (PID: $BACKEND_PID) - DEVELOPMENT mode"
echo "   • Frontend: Running (PID: $FRONTEND_PID)"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo "   • Backend:  tail -f backend.log"
echo "   • Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}🛑 To stop all services:${NC}"
echo "   ./stop.sh"
echo ""
echo -e "${BLUE}📚 Credentials:${NC}"
echo "   • Email:    admin@litedesk.com"
echo "   • Password: Admin@123456"
echo "   • (Change password after first login)"
echo ""

# Save PIDs to file for stop script
echo "$BACKEND_PID" > "$PROJECT_ROOT/.backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_ROOT/.frontend.pid"

# Open browser (optional - comment out if you don't want auto-open)
sleep 2
echo -e "${BLUE}🌍 Opening browser...${NC}"
if command -v open &> /dev/null; then
    open http://localhost:$FRONTEND_PORT
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:$FRONTEND_PORT
fi

echo ""
echo -e "${GREEN}✨ LiteDesk is ready! Happy coding! 🚀${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Backend logs show detailed environment info"
echo "   • Using local MongoDB for development"
echo "   • Deploy to production: ./deploy-local-build.sh"
echo ""
