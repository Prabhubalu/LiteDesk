#!/bin/bash

###############################################################################
# Fix Missing .env File on EC2
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
║         🔧 Fix Missing .env File on EC2               ║
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

echo -e "${BLUE}📝 Creating .env file on EC2...${NC}"
echo ""

# Generate secure secrets
echo -e "${PURPLE}🔐 Generating secure secrets...${NC}"
JWT_SECRET=$(openssl rand -hex 64)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 64)
MASTER_API_KEY=$(openssl rand -hex 32)

# Create .env file on EC2
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@$EC2_IP bash << EOF
set -e

echo "Creating .env file..."

cat > /home/ubuntu/LiteDesk/server/.env << 'ENVFILE'
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://litedeskadmin:TKvtQbKGOWdfP5C1@litedeskdb.qzw4euo.mongodb.net/litedesk?retryWrites=true&w=majority&appName=litedeskdb

# JWT Secrets
JWT_SECRET=$JWT_SECRET
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET

# Master API Key
MASTER_API_KEY=$MASTER_API_KEY

# Frontend URL
CLIENT_URL=http://13.203.208.47
CORS_ORIGINS=http://13.203.208.47,https://13.203.208.47,http://localhost:5173

# Admin Defaults
DEFAULT_ADMIN_EMAIL=admin@litedesk.com
DEFAULT_ADMIN_PASSWORD=Admin@123456

# Email Configuration (optional)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USER=
# EMAIL_PASS=

# AWS Configuration (optional)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET_NAME=
ENVFILE

echo ""
echo "✅ .env file created!"
echo ""
echo "📊 Verifying .env file..."
ls -la /home/ubuntu/LiteDesk/server/.env
echo ""
echo "📝 Contents (first few lines):"
head -5 /home/ubuntu/LiteDesk/server/.env
echo ""

# Test if MongoDB URI is readable
echo "🔍 Testing MongoDB URI..."
cd /home/ubuntu/LiteDesk/server
node -e "
require('dotenv').config();
if (process.env.MONGODB_URI) {
    console.log('✅ MONGODB_URI is loaded');
    console.log('Connection string starts with:', process.env.MONGODB_URI.substring(0, 30) + '...');
} else {
    console.log('❌ MONGODB_URI is still undefined!');
    process.exit(1);
}
"

echo ""
echo "🔄 Restarting backend..."
pm2 delete litedesk-api 2>/dev/null || true
pm2 start server.js --name litedesk-api --time
pm2 save

echo ""
echo "⏳ Waiting for backend to start..."
sleep 5

echo ""
echo "🧪 Testing backend..."
curl -s http://localhost:5000/api/health || echo "Backend still starting..."

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Recent logs:"
pm2 logs litedesk-api --lines 10 --nostream

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}          ${YELLOW}✅ .ENV FILE CREATED & BACKEND RESTARTED! ✅${NC}    ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}🌐 Try your app now:${NC}"
    echo -e "   ${YELLOW}http://$EC2_IP${NC}"
    echo ""
    echo -e "${GREEN}👤 Login with:${NC}"
    echo -e "   Email:    admin@litedesk.com"
    echo -e "   Password: Admin@123456"
    echo ""
    echo -e "${PURPLE}🎉 Should work now!${NC}"
    echo ""
else
    echo -e "${RED}❌ Something went wrong${NC}"
    exit 1
fi

