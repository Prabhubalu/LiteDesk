#!/bin/bash

# Quick Local Diagnostic
echo "🔍 Checking Local Development Status..."
echo ""

echo "1️⃣ Checking port 5000:"
lsof -i :5000 2>/dev/null || echo "   ❌ Nothing running on port 5000"
echo ""

echo "2️⃣ Testing backend health:"
curl -s http://localhost:5000/health 2>&1 | head -3 || echo "   ❌ Backend not responding"
echo ""

echo "3️⃣ Checking backend logs (last 20 lines):"
tail -20 /Users/Prabhu/Documents/GitHub/LiteDesk/backend.log 2>/dev/null || echo "   ❌ No backend.log found"
echo ""

echo "4️⃣ Checking .env NODE_ENV:"
grep "NODE_ENV" /Users/Prabhu/Documents/GitHub/LiteDesk/server/.env | head -1
echo ""

echo "5️⃣ Frontend port check:"
lsof -i :5173 2>/dev/null || echo "   ℹ️  Frontend not on 5173"
lsof -i :5175 2>/dev/null || echo "   ℹ️  Frontend not on 5175"
echo ""

echo "📊 Summary:"
echo "   Backend should be on: http://localhost:5000"
echo "   Frontend should be on: http://localhost:5173 or 5175"
echo ""
echo "🔧 To fix, run: ./start.sh"

