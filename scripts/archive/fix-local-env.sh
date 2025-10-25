#!/bin/bash

###############################################################################
# Fix Local Development Environment
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║      🔧 Fix Local Development Environment             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd /Users/Prabhu/Documents/GitHub/LiteDesk/server

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}📋 Backed up current .env${NC}"

# Create clean .env for LOCAL development
cat > .env << 'EOF'
# =============================================================================
# LiteDesk CRM - Environment Configuration (LOCAL DEVELOPMENT)
# =============================================================================

# ENVIRONMENT MODE - Set to 'development' for local, 'production' for EC2
NODE_ENV=development
PORT=5000

# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# -----------------------------------------------------------------------------
# Local MongoDB (for development on your Mac)
MONGO_URI_LOCAL=mongodb://localhost:27017/litedesk

# Production MongoDB Atlas (for AWS EC2 deployment)
MONGO_URI_PRODUCTION=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# Active MongoDB URI (for local development)
MONGO_URI=mongodb://localhost:27017/litedesk
MONGODB_URI=mongodb://localhost:27017/litedesk

# -----------------------------------------------------------------------------
# AUTHENTICATION & SECURITY
# -----------------------------------------------------------------------------
JWT_SECRET=6.6731011Kgnm2!
JWT_EXPIRE=7d

REFRESH_TOKEN_SECRET=your_refresh_token_secret_change_in_production
REFRESH_TOKEN_EXPIRE=30d

MASTER_API_KEY=your_master_api_key_change_in_production

# -----------------------------------------------------------------------------
# APPLICATION URLS
# -----------------------------------------------------------------------------
# Local Development URLs
CLIENT_URL_LOCAL=http://localhost:5173
BACKEND_URL_LOCAL=http://localhost:5000
CORS_ORIGINS_LOCAL=http://localhost:5173,http://localhost:3000,http://localhost:5175

# Production URLs (AWS EC2)
CLIENT_URL_PRODUCTION=http://13.203.208.47
BACKEND_URL_PRODUCTION=http://13.203.208.47
CORS_ORIGINS_PRODUCTION=http://13.203.208.47,https://13.203.208.47

# Active URLs (for local development)
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:3000

# -----------------------------------------------------------------------------
# ADMIN DEFAULTS
# -----------------------------------------------------------------------------
DEFAULT_ADMIN_EMAIL=admin@litedesk.com
DEFAULT_ADMIN_PASSWORD=Admin@123456

# -----------------------------------------------------------------------------
# MONITORING SERVICES (Disabled for local development)
# -----------------------------------------------------------------------------
ENABLE_HEALTH_CHECKER=false
ENABLE_METRICS_COLLECTOR=false
HEALTH_CHECK_INTERVAL=300000
METRICS_COLLECTION_INTERVAL=900000

# -----------------------------------------------------------------------------
# MULTI-INSTANCE ARCHITECTURE
# -----------------------------------------------------------------------------
BASE_DOMAIN=litedesk.local

# -----------------------------------------------------------------------------
# FEATURE FLAGS
# -----------------------------------------------------------------------------
ENABLE_DEMO_CONVERSION=true
ENABLE_INSTANCE_PROVISIONING=false
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_STRIPE_INTEGRATION=false

# -----------------------------------------------------------------------------
# LOGGING & DEBUGGING
# -----------------------------------------------------------------------------
LOG_LEVEL=info
DEBUG_PROVISIONING=false
DEBUG_KUBERNETES=false
DEBUG_DATABASE=false
DEBUG_DNS=false

# -----------------------------------------------------------------------------
# RATE LIMITING
# -----------------------------------------------------------------------------
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

echo -e "${GREEN}✅ Created clean .env for local development${NC}"
echo ""

echo -e "${BLUE}📊 Key settings for local development:${NC}"
echo "  NODE_ENV: development"
echo "  MONGO_URI: mongodb://localhost:27017/litedesk"
echo "  CORS_ORIGINS: localhost:5173, localhost:5175"
echo "  PORT: 5000"
echo ""

echo -e "${YELLOW}⚠️  Make sure MongoDB is running locally:${NC}"
echo "  brew services start mongodb-community"
echo "  OR: mongod"
echo ""

echo -e "${GREEN}✅ .env file fixed for local development!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Start MongoDB (if not running)"
echo "  2. Restart backend: cd server && node server.js"
echo "  3. Or use: ./start.sh"
echo ""

