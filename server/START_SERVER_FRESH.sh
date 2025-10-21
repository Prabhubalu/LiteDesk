#!/bin/bash

echo "🛑 Killing any existing Node processes..."
pkill -9 node 2>/dev/null
sleep 1

echo "🧹 Clearing any potential caches..."
rm -rf node_modules/.cache 2>/dev/null

cd "$(dirname "$0")"

echo ""
echo "🚀 Starting server with FRESH code..."
echo "📂 Working directory: $(pwd)"
echo "📄 Loading: controllers/authController.js"
echo ""
echo "✅ You should see these logs when someone registers:"
echo "   📝 Registration Request Received:"
echo "   🏢 Creating organization..."
echo "   ✅ Organization created:"
echo "   👤 Creating owner user..."
echo "   ✅ User created: ... - Role: owner"
echo ""
echo "==================== SERVER OUTPUT ===================="
echo ""

node server.js

