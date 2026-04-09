# Database Migration Guide - Move to Your Own MongoDB

## Overview
This guide will help you move your database from Emergent to either:
1. **MongoDB Atlas** (Cloud - Recommended, FREE tier available)
2. **Your Own System** (Local MongoDB installation)

---

## Option 1: MongoDB Atlas (Cloud-Based) - RECOMMENDED ⭐

### Why MongoDB Atlas?
- ✅ **FREE Forever** - 512MB storage free
- ✅ **Always Online** - 24/7 availability
- ✅ **Automatic Backups** - Built-in data protection
- ✅ **Secure** - Enterprise-level security
- ✅ **Easy Setup** - No installation needed
- ✅ **Global** - Access from anywhere

---

### Step 1: Create MongoDB Atlas Account

1. **Visit:** https://www.mongodb.com/cloud/atlas/register
2. **Sign up** with:
   - Email address
   - Or Google/GitHub account
3. **Verify** your email
4. **Login** to MongoDB Atlas

---

### Step 2: Create a Free Cluster

1. After login, click **"Create"** or **"Build a Database"**
2. Choose **"M0 FREE"** plan (512MB free forever)
3. **Select Provider & Region:**
   - Provider: AWS / Google Cloud / Azure (any)
   - Region: Choose closest to you (e.g., Mumbai for India)
4. **Cluster Name:** `water-tracker` (or any name)
5. Click **"Create Cluster"**
6. Wait 3-5 minutes for cluster to be ready ⏳

---

### Step 3: Create Database User

1. Click **"Database Access"** in left menu
2. Click **"Add New Database User"**
3. **Authentication Method:** Password
4. **Username:** `wateradmin` (or any name)
5. **Password:** Click "Autogenerate Secure Password" 
   - **IMPORTANT:** Copy and save this password! 📝
6. **Database User Privileges:** Select "Read and write to any database"
7. Click **"Add User"**

---

### Step 4: Configure Network Access

1. Click **"Network Access"** in left menu
2. Click **"Add IP Address"**
3. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This allows your app to connect from any IP
4. Click **"Confirm"**
5. Wait for status to change to **ACTIVE** (green)

---

### Step 5: Get Connection String

1. Go back to **"Database"** in left menu
2. Click **"Connect"** button on your cluster
3. Choose **"Connect your application"**
4. **Driver:** Node.js
5. **Version:** 4.1 or later
6. **Copy the connection string** - looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **Replace placeholders:**
   - Replace `<username>` with: `wateradmin` (or your username)
   - Replace `<password>` with: the password you saved earlier
   - Add database name at the end before `?`: `/water_tracker_db`

**Final connection string example:**
```
mongodb+srv://wateradmin:YourPassword123@cluster0.ab12cd.mongodb.net/water_tracker_db?retryWrites=true&w=majority
```

---

### Step 6: Update Your App

1. **Edit backend .env file:**
   ```bash
   nano /app/backend/.env
   ```

2. **Replace MONGO_URL with your Atlas connection string:**
   ```
   MONGO_URL="mongodb+srv://wateradmin:YourPassword123@cluster0.ab12cd.mongodb.net/water_tracker_db?retryWrites=true&w=majority"
   DB_NAME="water_tracker_db"
   ```

3. **Save and exit** (Ctrl+X, then Y, then Enter)

4. **Restart backend:**
   ```bash
   sudo supervisorctl restart backend
   ```

---

### Step 7: Verify Connection

1. **Check backend logs:**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

2. **Look for:**
   - "Application startup complete" ✅
   - No MongoDB connection errors

3. **Test the app:**
   - Open your app
   - Login with admin credentials
   - Try adding a consumer
   - If it works, migration successful! 🎉

---

## Option 2: Local MongoDB Installation (Your Own System)

### For Ubuntu/Debian Linux:

#### Step 1: Install MongoDB

```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod

# Check status
sudo systemctl status mongod
```

#### Step 2: Configure MongoDB

1. **Edit MongoDB config:**
   ```bash
   sudo nano /etc/mongod.conf
   ```

2. **Enable authentication (optional but recommended):**
   ```yaml
   security:
     authorization: enabled
   ```

3. **Restart MongoDB:**
   ```bash
   sudo systemctl restart mongod
   ```

#### Step 3: Create Database User

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "wateradmin",
  pwd: "YourSecurePassword123",
  roles: ["readWriteAnyDatabase"]
})

# Exit
exit
```

#### Step 4: Update Your App

1. **Edit backend .env:**
   ```
   MONGO_URL="mongodb://wateradmin:YourSecurePassword123@localhost:27017/water_tracker_db?authSource=admin"
   DB_NAME="water_tracker_db"
   ```

2. **Restart backend:**
   ```bash
   sudo supervisorctl restart backend
   ```

---

### For Windows:

#### Step 1: Download MongoDB

1. Visit: https://www.mongodb.com/try/download/community
2. Select:
   - Version: 7.0 (current)
   - Platform: Windows
   - Package: MSI
3. Download and run installer
4. Choose "Complete" installation
5. Install MongoDB as a Service (check the box)
6. Install MongoDB Compass (GUI tool)

#### Step 2: Create Database User

1. Open **MongoDB Compass**
2. Connect to `mongodb://localhost:27017`
3. Create new database: `water_tracker_db`
4. Create user with read/write access

#### Step 3: Update Connection

1. **Connection string for Windows:**
   ```
   mongodb://localhost:27017/water_tracker_db
   ```

2. Update your app's `.env` file with this connection string

---

### For macOS:

#### Step 1: Install MongoDB using Homebrew

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Tap MongoDB repository
brew tap mongodb/brew

# Install MongoDB
brew install mongodb-community@7.0

# Start MongoDB
brew services start mongodb-community@7.0
```

#### Step 2: Update Connection

```
MONGO_URL="mongodb://localhost:27017/water_tracker_db"
DB_NAME="water_tracker_db"
```

---

## Data Migration (Copy Existing Data)

### If you want to keep your existing data:

#### Step 1: Export from Current Database

```bash
# Export all collections
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=/tmp/backup
```

#### Step 2: Import to New Database

**For Atlas:**
```bash
mongorestore --uri="mongodb+srv://wateradmin:YourPassword@cluster0.xxxxx.mongodb.net/water_tracker_db" /tmp/backup/test_database
```

**For Local:**
```bash
mongorestore --uri="mongodb://localhost:27017/water_tracker_db" /tmp/backup/test_database
```

---

## Comparison: Atlas vs Local

| Feature | MongoDB Atlas (Cloud) | Local MongoDB |
|---------|----------------------|---------------|
| Cost | FREE (512MB) | FREE (unlimited) |
| Setup Time | 10 minutes | 30-60 minutes |
| Maintenance | Automatic | Manual |
| Backups | Automatic | Manual |
| Accessibility | Anywhere | Same network only |
| Scaling | Click to upgrade | Requires server upgrade |
| Security | Enterprise-level | DIY |
| Recommended For | Production apps | Development/testing |

---

## Troubleshooting

### Connection Failed?

1. **Check connection string** - No typos, correct password
2. **Check IP whitelist** (Atlas) - Should have 0.0.0.0/0
3. **Check MongoDB is running** (Local):
   ```bash
   sudo systemctl status mongod
   ```
4. **Check backend logs:**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

### Cannot Login After Migration?

1. **Admin user needs to be recreated** in new database
2. App will auto-create admin on first run
3. Use default credentials:
   - Email: `admin@waterbill.com`
   - Password: `admin123`

---

## Security Best Practices

### For Production (IMPORTANT!)

1. **Change admin password** after migration
2. **Use strong database password** (20+ characters)
3. **Enable IP whitelisting** (Atlas) - Add only your server IPs
4. **Enable authentication** (Local)
5. **Regular backups** - Export data weekly
6. **Update .env permissions:**
   ```bash
   chmod 600 /app/backend/.env
   ```

---

## Backup & Recovery

### Automatic Backups (Atlas)
- Already enabled on Atlas FREE tier
- 1-day retention
- Upgrade for longer retention

### Manual Backup (Local)

**Create backup:**
```bash
mongodump --uri="mongodb://localhost:27017/water_tracker_db" --out=/backup/$(date +%Y%m%d)
```

**Restore backup:**
```bash
mongorestore --uri="mongodb://localhost:27017/water_tracker_db" /backup/20260407
```

**Automate daily backups:**
```bash
# Add to crontab
crontab -e

# Add this line (backup every day at 2 AM)
0 2 * * * mongodump --uri="mongodb://localhost:27017/water_tracker_db" --out=/backup/$(date +\%Y\%m\%d)
```

---

## Next Steps After Migration

1. ✅ Verify all data migrated correctly
2. ✅ Test all features (add consumer, create bill, record payment)
3. ✅ Update admin password
4. ✅ Set up regular backups
5. ✅ Monitor database size (Atlas dashboard)
6. ✅ Document your connection string (securely!)

---

## Support Resources

- **MongoDB Atlas Docs:** https://docs.atlas.mongodb.com/
- **MongoDB Manual:** https://docs.mongodb.com/manual/
- **Community Forum:** https://www.mongodb.com/community/forums/

---

## Quick Start Recommendation

**For most users, we recommend MongoDB Atlas:**
1. Faster setup (10 minutes)
2. Free forever (512MB)
3. No maintenance required
4. Automatic backups
5. Always accessible

**Follow Option 1 above to get started!** 🚀

---

**Need help?** If you encounter any issues during migration, please share:
1. Which option you chose (Atlas or Local)
2. Error message (if any)
3. Screenshot of the issue

Good luck with your migration! 💪
