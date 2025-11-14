# Rate Limit Bypass for Development Testing

## ✅ Implementation Complete

A development-only bypass for rate limiting has been implemented to facilitate API testing.

## 🔧 How It Works

### Automatic Bypass (Test Scripts)

The test script (`server/scripts/testFormsAPI.js`) automatically adds bypass headers in development mode:

```javascript
// Automatically added headers:
X-Bypass-Rate-Limit: true
X-Test-Mode: true
```

### Manual Bypass (cURL/Postman)

For manual testing, add these headers:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Bypass-Rate-Limit: true" \
  -H "X-Test-Mode: true" \
  -d '{"email":"admin@litedesk.com","password":"Admin@123"}'
```

## ⚠️ Important: Server Restart Required

**The server must be restarted** for the middleware changes to take effect.

### Restart Instructions

1. **Stop the current server:**
   ```bash
   # Find the server process
   ps aux | grep "node server.js"
   
   # Kill it (replace PID with actual process ID)
   kill -9 <PID>
   
   # Or if using npm start in a terminal, press Ctrl+C
   ```

2. **Restart the server:**
   ```bash
   cd server
   npm start
   ```

3. **Verify the bypass is working:**
   ```bash
   # Check server logs for bypass warnings
   # You should see: ⚠️  [DEV] Rate limiting bypassed for: ...
   ```

## 🔒 Security Features

### Production Safety

- ✅ **Bypass is DISABLED in production** (`NODE_ENV=production`)
- ✅ **Only works in development mode**
- ✅ **Requires explicit header** - cannot be accidentally enabled
- ✅ **Logs bypass usage** - shows warning in server logs

### Environment Variables

You can control the bypass behavior:

```bash
# Disable bypass even in development (for testing rate limiting)
export BYPASS_RATE_LIMIT=false

# Enable bypass (default in development)
export BYPASS_RATE_LIMIT=true

# Production mode (bypass always disabled)
export NODE_ENV=production
```

## 📋 Testing After Restart

Once the server is restarted, run the test script:

```bash
node server/scripts/testFormsAPI.js
```

You should see:
```
⚠️  Rate Limit Bypass: ENABLED (Development Mode)
🧪 Testing: Authentication
✅ Authentication successful
```

## 🐛 Troubleshooting

### Issue: Still getting 403 after restart

**Check:**
1. Server logs show bypass warnings?
2. `NODE_ENV` is not set to `production`?
3. Headers are being sent correctly?

**Debug:**
```bash
# Check if bypass is working
curl -v -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Bypass-Rate-Limit: true" \
  -d '{"email":"admin@litedesk.com","password":"Admin@123"}' \
  2>&1 | grep -E "(X-Bypass|HTTP|error)"
```

### Issue: Bypass not working

**Verify:**
1. Server restarted after middleware changes?
2. Middleware file saved correctly?
3. Headers are lowercase in code (`x-bypass-rate-limit`)?

## 📝 Code Changes Made

### Files Modified:

1. **`server/middleware/rateLimitMiddleware.js`**
   - Added `skip` function to `authLimiter`
   - Added `skip` function to `apiLimiter`
   - Checks for bypass headers in development mode

2. **`server/scripts/testFormsAPI.js`**
   - Automatically adds bypass headers
   - Shows bypass status in output
   - Respects `BYPASS_RATE_LIMIT` environment variable

## ✅ Verification Checklist

After restarting the server:

- [ ] Server restarted successfully
- [ ] Test script shows "Rate Limit Bypass: ENABLED"
- [ ] Authentication test passes
- [ ] Server logs show bypass warnings (optional)
- [ ] All other tests run successfully

## 🚀 Next Steps

1. **Restart the server** (see instructions above)
2. **Run the test script** to verify bypass works
3. **Continue with Forms Module testing**

## 📚 Related Files

- `server/middleware/rateLimitMiddleware.js` - Rate limiting middleware
- `server/scripts/testFormsAPI.js` - Test script with bypass
- `FORMS_API_TESTING_GUIDE.md` - Manual testing guide
- `FORMS_TEST_RESULTS.md` - Test results summary

