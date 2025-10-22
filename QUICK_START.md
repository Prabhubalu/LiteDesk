# ⚡ Quick Start Guide

Get LiteDesk running in **5 minutes**!

---

## 🚀 One-Time Setup

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/LiteDesk.git
cd LiteDesk

# Backend
cd server && npm install

# Frontend  
cd ../client && npm install
```

### 2. Start MongoDB
```bash
# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Verify
mongosh  # Should connect
```

### 3. Setup Environment
```bash
cd server
cp .env.example .env
```

**Edit `.env` - Change these 3 lines:**
```env
JWT_SECRET=change-this-to-any-random-string
REFRESH_TOKEN_SECRET=change-this-to-another-random-string
MASTER_API_KEY=and-one-more-random-string
```

### 4. Create Admin Account
```bash
cd server
node scripts/createDefaultAdmin.js
```

**Save these credentials:**
- Email: `admin@litedesk.com`
- Password: `Admin@123`

---

## 🎮 Daily Usage

Open **2 terminals**:

**Terminal 1 (Backend):**
```bash
cd server
npm start
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

**Browser:**
```
http://localhost:5173
```

Login with: `admin@litedesk.com` / `Admin@123`

---

## ✅ Done!

**Next Steps:**
1. Change your password (Settings)
2. Create some contacts
3. Submit a demo request (use incognito)
4. Explore the dashboard

**Need help?** See [DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md) for detailed docs.

---

## 🐛 Quick Fixes

**MongoDB not connecting?**
```bash
# Check if MongoDB is running
mongosh

# If not, start it
brew services start mongodb-community  # Mac
sudo systemctl start mongod            # Linux
```

**Port already in use?**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Can't login?**
```bash
# Recreate admin account
cd server
node scripts/createDefaultAdmin.js
```

**Frontend showing errors?**
```bash
# Hard refresh browser
Cmd + Shift + R  # Mac
Ctrl + Shift + F5  # Windows
```

---

That's it! 🎉

