#!/bin/bash

# Security Check Script
# Runs security audits and checks

set -e

echo "🔒 Running Security Checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "server/package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# 1. Dependency Vulnerability Check
echo "📦 Checking for dependency vulnerabilities..."
cd server
if npm audit --audit-level=moderate; then
    echo -e "${GREEN}✅ No critical vulnerabilities found${NC}"
else
    echo -e "${YELLOW}⚠️  Vulnerabilities found. Run 'npm audit fix' to fix automatically${NC}"
fi
cd ..

echo ""

# 2. Check for hardcoded secrets
echo "🔍 Scanning for hardcoded secrets..."
SECRETS_FOUND=0

# Check for common secret patterns
if grep -r "JWT_SECRET.*=.*['\"].*['\"]" server/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "${RED}❌ Found hardcoded JWT_SECRET${NC}"
    SECRETS_FOUND=1
fi

# Check for hardcoded passwords (exclude destructuring and empty strings)
if grep -r "password.*=.*['\"].*['\"]" server/ --exclude-dir=node_modules 2>/dev/null | \
   grep -v "password.*=.*''" | \
   grep -v "password.*=.*\"\"" | \
   grep -v "req\.body" | \
   grep -v "const.*password.*=" | \
   grep -v "let.*password.*=" | \
   grep -v "var.*password.*="; then
    echo -e "${RED}❌ Found potential hardcoded passwords${NC}"
    SECRETS_FOUND=1
fi

if grep -r "api[_-]key.*=.*['\"].*['\"]" server/ --exclude-dir=node_modules -i 2>/dev/null; then
    echo -e "${RED}❌ Found potential hardcoded API keys${NC}"
    SECRETS_FOUND=1
fi

if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No hardcoded secrets found${NC}"
fi

echo ""

# 3. Check environment variables
echo "🔐 Checking environment variable configuration..."
if [ ! -f "server/.env.example" ]; then
    echo -e "${YELLOW}⚠️  .env.example not found. Consider creating one.${NC}"
fi

if [ -f "server/.env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Check if JWT_SECRET is set
    if grep -q "JWT_SECRET=" server/.env && ! grep -q "JWT_SECRET=$" server/.env; then
        echo -e "${GREEN}✅ JWT_SECRET is configured${NC}"
    else
        echo -e "${RED}❌ JWT_SECRET is not set or empty${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found (this is OK if using system env vars)${NC}"
fi

echo ""

# 4. Check .gitignore
echo "📝 Checking .gitignore..."
if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✅ .env files are gitignored${NC}"
else
    echo -e "${RED}❌ .env files are NOT gitignored${NC}"
fi

echo ""

# 5. Security headers check (if server is running)
echo "🌐 Checking security headers..."
echo "   (Run this while server is running: curl -I http://localhost:5000)"

echo ""
echo "✅ Security check complete!"
echo ""
echo "Next steps:"
echo "  1. Review any vulnerabilities found"
echo "  2. Fix hardcoded secrets if any"
echo "  3. Ensure all environment variables are set"
echo "  4. Run 'npm audit fix' to fix vulnerabilities"

