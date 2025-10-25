#!/bin/bash

###############################################################################
# Fix Missing Images - Move to Public Folder & Redeploy
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║         🖼️  Fix Missing Images & Redeploy             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd /Users/Prabhu/Documents/GitHub/LiteDesk

echo -e "${BLUE}Step 1: Moving images to public folder...${NC}"
echo ""

# Create public/images directory if it doesn't exist
mkdir -p client/public/images

# Copy images from src/assets/images to public/images
if [ -d "client/src/assets/images" ]; then
    echo "📁 Copying images from src/assets/images to public/images..."
    cp -v client/src/assets/images/*.jpg client/public/images/ 2>/dev/null || true
    cp -v client/src/assets/images/*.png client/public/images/ 2>/dev/null || true
    cp -v client/src/assets/images/*.svg client/public/images/ 2>/dev/null || true
    echo -e "${GREEN}✅ Images copied${NC}"
else
    echo -e "${YELLOW}⚠️  No images folder found in src/assets${NC}"
fi

# Also copy logo files to public
echo ""
echo "📁 Copying logo files to public/assets..."
mkdir -p client/public/assets
cp -v client/src/assets/*.svg client/public/assets/ 2>/dev/null || true
echo -e "${GREEN}✅ Logo files copied${NC}"

echo ""
echo "📊 Files in public folder:"
ls -lh client/public/
echo ""
ls -lh client/public/images/ 2>/dev/null || echo "No images folder"
echo ""

echo -e "${BLUE}Step 2: Rebuilding frontend with images...${NC}"
echo ""

cd client
npm run build

echo ""
echo -e "${GREEN}✅ Frontend rebuilt${NC}"
echo ""

# Check what's in dist
echo "📊 Checking dist folder:"
ls -lh dist/images/ 2>/dev/null || echo "No images in dist (will check dist root)"
ls -lh dist/ | grep -i "\.jpg\|\.png\|\.svg" || echo "Checking assets..."
ls -lh dist/assets/ | grep -i "\.jpg\|\.png\|\.svg" | head -5 || echo "Images should be in root or images folder"

echo ""
echo -e "${BLUE}Step 3: Would you like to deploy to EC2 now?${NC}"
read -p "Deploy to EC2? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${PURPLE}🚀 Deploying to EC2...${NC}"
    cd ..
    ./deploy-local-build.sh
else
    echo ""
    echo -e "${YELLOW}Skipping EC2 deployment${NC}"
    echo ""
    echo -e "${BLUE}To deploy manually later, run:${NC}"
    echo "  ./deploy-local-build.sh"
    echo ""
    echo -e "${BLUE}Or upload just the images:${NC}"
    echo "  scp -i ~/key.pem -r client/dist/images ubuntu@13.203.208.47:/home/ubuntu/LiteDesk/client/dist/"
fi

echo ""
echo -e "${GREEN}✅ Image fix complete!${NC}"
echo ""

