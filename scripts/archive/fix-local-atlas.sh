#!/bin/bash

###############################################################################
# Fix Local Development with MongoDB Atlas
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
║   🔧 Fix Local Development (Using MongoDB Atlas)      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd /Users/Prabhu/Documents/GitHub/LiteDesk/server

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}📋 Backed up current .env${NC}"

# Create clean .env for LOCAL development using MongoDB Atlas
cat > .env << 'EOF'
# =============================================================================
# LiteDesk CRM - Local Development (Using MongoDB Atlas)
# =============================================================================

# ENVIRONMENT MODE - Development for local work
NODE_ENV=development
PORT=5000

# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION (Using MongoDB Atlas for both local and production)
# -----------------------------------------------------------------------------
MONGO_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb
MONGODB_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# For reference (not used):
MONGO_URI_LOCAL=mongodb://localhost:27017/litedesk
MONGO_URI_PRODUCTION=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# -----------------------------------------------------------------------------
# AUTHENTICATION & SECURITY
# -----------------------------------------------------------------------------
JWT_SECRET=6.6731011Kgnm2!
JWT_EXPIRE=7d

REFRESH_TOKEN_SECRET=your_refresh_token_secret_change_in_production
REFRESH_TOKEN_EXPIRE=30d

MASTER_API_KEY=your_master_api_key_change_in_production

# -----------------------------------------------------------------------------
# APPLICATION URLS (Local Development)
# -----------------------------------------------------------------------------
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:3000

# For reference:
CLIENT_URL_LOCAL=http://localhost:5173
CLIENT_URL_PRODUCTION=http://13.203.208.47
CORS_ORIGINS_PRODUCTION=http://13.203.208.47,https://13.203.208.47

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
EOF

echo -e "${GREEN}✅ Created clean .env for local development with MongoDB Atlas${NC}"
echo ""

echo -e "${BLUE}📊 Settings configured:${NC}"
echo "  ✅ NODE_ENV: development"
echo "  ✅ MongoDB: Atlas (same as production)"
echo "  ✅ CORS: localhost:5173, localhost:5175"
echo "  ✅ PORT: 5000"
echo "  ✅ Monitoring: Disabled"
echo ""

echo -e "${GREEN}✨ Done! Your local environment is ready!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Stop current backend: lsof -ti :5000 | xargs kill -9"
echo "  2. Restart backend: cd server && node server.js"
echo "  3. Or use: ./start.sh"
echo ""
echo -e "${YELLOW}💡 Both local and production now use MongoDB Atlas${NC}"
echo "   This is perfectly fine - same database, different environments"
echo ""

