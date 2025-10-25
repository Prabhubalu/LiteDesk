#!/bin/bash

###############################################################################
# Cleanup Duplicate and Temporary Deployment Scripts
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
║      🧹 Cleaning Up Deployment Scripts                ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd /Users/Prabhu/Documents/GitHub/LiteDesk

# Create scripts archive directory
mkdir -p scripts/archive

echo -e "${YELLOW}📊 Current status: $(ls -1 *.sh *.txt 2>/dev/null | wc -l) script/text files${NC}"
echo ""

# =============================================================================
# Scripts to KEEP (Essential)
# =============================================================================
KEEP_SCRIPTS=(
    "deploy-local-build.sh"    # Main deployment script
    "start.sh"                 # Start local dev
    "stop.sh"                  # Stop local dev
    "restart.sh"               # Restart local dev
)

echo -e "${GREEN}✅ Scripts to KEEP:${NC}"
for file in "${KEEP_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "   • $file"
    fi
done
echo ""

# =============================================================================
# Archive (Old deployment scripts - superseded by deploy-local-build.sh)
# =============================================================================
ARCHIVE_DEPLOY=(
    "deploy-to-aws.sh"
    "deploy-aws-quick.sh"
    "deploy-from-local.sh"
)

echo -e "${YELLOW}📦 Archiving old deployment scripts:${NC}"
for file in "${ARCHIVE_DEPLOY[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" scripts/archive/
        echo "   ✓ Archived $file"
    fi
done
echo ""

# =============================================================================
# Archive (Temporary fix scripts - one-time use)
# =============================================================================
ARCHIVE_FIX=(
    "fix-permissions.sh"
    "fix-backend.sh"
    "fix-env.sh"
    "fix-frontend.sh"
    "fix-404.sh"
    "fix-images.sh"
    "fix-local-atlas.sh"
    "fix-local-env.sh"
    "complete-local-fix.sh"
)

echo -e "${YELLOW}📦 Archiving temporary fix scripts:${NC}"
for file in "${ARCHIVE_FIX[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" scripts/archive/
        echo "   ✓ Archived $file"
    fi
done
echo ""

# =============================================================================
# Archive (Diagnostic/one-time scripts)
# =============================================================================
ARCHIVE_DIAGNOSTIC=(
    "diagnose-and-fix.sh"
    "check-local.sh"
    "switch-to-port-3000.sh"
    "cleanup-docs.sh"
)

echo -e "${YELLOW}📦 Archiving diagnostic/one-time scripts:${NC}"
for file in "${ARCHIVE_DIAGNOSTIC[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" scripts/archive/
        echo "   ✓ Archived $file"
    fi
done
echo ""

# =============================================================================
# Archive (Old text files)
# =============================================================================
ARCHIVE_TEXT=(
    "DEPLOY_FREE_TIER.txt"
    "START_DEPLOYMENT.txt"
)

echo -e "${YELLOW}📦 Archiving old text files:${NC}"
for file in "${ARCHIVE_TEXT[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" scripts/archive/
        echo "   ✓ Archived $file"
    fi
done
echo ""

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}"
cat << "EOF"
╔════════════════════════════════════════════════════════╗
║                                                        ║
║            ✅ Cleanup Complete!                       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}📊 Summary:${NC}"
echo ""
echo -e "${GREEN}✅ Essential scripts at root:${NC}"
ls -1 *.sh 2>/dev/null | while read file; do echo "   • $file"; done
echo ""
echo -e "${YELLOW}📦 Archived in scripts/archive/:${NC}"
echo "   $(ls -1 scripts/archive/* 2>/dev/null | wc -l) files archived"
echo ""
echo -e "${GREEN}🎉 Your deployment scripts are now clean!${NC}"
echo ""
echo -e "${BLUE}📝 What's left:${NC}"
echo "   • deploy-local-build.sh  - Deploy to AWS EC2"
echo "   • start.sh               - Start local development"
echo "   • stop.sh                - Stop local development"
echo "   • restart.sh             - Restart local development"
echo ""
echo -e "${BLUE}💡 Commands:${NC}"
echo "   • Local dev:  ./start.sh"
echo "   • Deploy:     ./deploy-local-build.sh"
echo "   • Restart:    ./restart.sh"
echo ""

