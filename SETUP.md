# NeighborNet Backend - Setup Instructions

## 🚀 Getting Started

Follow these steps to set up the backend on your machine.

---

## Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - [Download](https://dev.mysql.com/downloads/mysql/)
- **Git** - [Download](https://git-scm.com/downloads)

### Platform-Specific Requirements

**Windows:**
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) or run:
  ```bash
  npm install --global windows-build-tools
  ```
- MySQL Workbench recommended for easier database management

**Mac:**
- Xcode Command Line Tools (run `xcode-select --install`)
- MySQL can be installed via Homebrew: `brew install mysql`

**Linux (Ubuntu/Debian):**
- Build essentials: `sudo apt-get install build-essential`
- MySQL: `sudo apt-get install mysql-server`

---

## 📦 Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/Yael-University/neighbornet-backend-testing2.git
cd neighbornet-backend-testing2
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including platform-specific native modules like `bcrypt`.

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

**Mac/Linux:**
```bash
cp .env.example .env
```

**Windows (Command Prompt):**
```bash
copy .env.example .env
```

**Windows (PowerShell):**
```bash
Copy-Item .env.example .env
```

Then edit `.env` with your settings:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=neighbornet

# Server Configuration
PORT=5050
JWT_SECRET=your_secret_key_here_change_this

# Base URL (your machine's IP for mobile testing)
BASE_URL=http://localhost:5050

# Email Configuration (Optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="NeighborNet <noreply@neighbornet.com>"
```

**Important Notes:**
- Change `DB_PASSWORD` to your MySQL root password
- Generate a secure `JWT_SECRET` (e.g., use `openssl rand -base64 32`)
- For mobile testing, set `BASE_URL` to your computer's IP address

### 4. Set Up MySQL Database

**Option A: Using MySQL Command Line (All Platforms)**

Create the database:

```bash
mysql -u root -p
```

```sql
CREATE DATABASE neighbornet;
USE neighbornet;
SOURCE database/schema.sql;
exit;
```

**Option B: Windows MySQL Workbench**

1. Open MySQL Workbench and connect to your local server
2. Click "Create New Schema" (database icon)
3. Name it `neighbornet` and click Apply
4. Open `database/schema.sql` in Workbench
5. Execute the script (lightning bolt icon)

**Note for Windows users:** If using Command Prompt and the `SOURCE` command doesn't work, use:
```bash
mysql -u root -p neighbornet < database/schema.sql
```

### 5. Run Database Migrations

Apply all migrations in order:

**Mac/Linux/Windows (Git Bash or PowerShell):**
```bash
# Auth fields migration
mysql -u root -p neighbornet < database/add_auth_fields.sql

# Phone field migration
mysql -u root -p neighbornet < database/add_phone_field.sql

# Follow system migration
mysql -u root -p neighbornet < database/add_follows_table.sql
```

**Windows (MySQL Workbench Alternative):**
1. Open each SQL file in Workbench
2. Select the `neighbornet` database
3. Execute each script in order

**Windows (Command Prompt):**
```bash
mysql -u root -p neighbornet < database\add_auth_fields.sql
mysql -u root -p neighbornet < database\add_phone_field.sql
mysql -u root -p neighbornet < database\add_follows_table.sql
```

### 6. Start the Server

```bash
npm start
```

You should see:
```
✅ NeighborNet Backend running on http://localhost:5050
```

---

## 🧪 Testing the Server

Test if the server is running:

```bash
curl http://localhost:5050/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

---

## 📱 Mobile Device Testing

To test with a mobile device:

1. Find your computer's IP address:
   - **Mac:** `ifconfig | grep "inet "` (look for 192.168.x.x or 10.0.x.x)
   - **Linux:** `ip addr show` or `hostname -I`
   - **Windows (Command Prompt):** `ipconfig` (look for IPv4 Address under your WiFi adapter)
   - **Windows (PowerShell):** `Get-NetIPAddress -AddressFamily IPv4`

2. Update `.env`:
   ```env
   BASE_URL=http://YOUR_IP_ADDRESS:5050
   ```

3. **Windows Firewall:** Allow Node.js through the firewall:
   - Search for "Windows Defender Firewall" → "Allow an app through firewall"
   - Click "Change settings" → "Allow another app"
   - Browse to Node.js executable and add it

4. Restart the server

5. Connect your phone to the same WiFi network

6. Update your mobile app's API URL to use your computer's IP

---

## 🔧 Development Commands

```bash
# Start server (production mode)
npm start

# Start server with auto-reload (development mode)
npm run dev

# Set up database (if you have the script)
npm run setup-db
```

---

## 📋 Project Structure

```
neighbornet-backend-testing2/
├── config/          # Database and email configuration
├── database/        # SQL schemas and migrations
├── middleware/      # Authentication, error handling, uploads
├── routes/          # API route handlers
├── scripts/         # Setup and utility scripts
├── uploads/         # User uploaded files (profiles, posts)
├── utils/           # Helper functions
├── .env             # Environment variables (DO NOT COMMIT)
├── .env.example     # Example environment file
├── server.js        # Main server file
└── package.json     # Dependencies
```

---

## 🐛 Troubleshooting

### Issue: `bcrypt` compilation errors

**Solution:** Make sure you have build tools installed:

**Mac:**
```bash
xcode-select --install
```

**Windows (Run as Administrator):**
```bash
npm install --global windows-build-tools
```
Or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) manually.

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential
```

Then delete `node_modules` and `package-lock.json`, and run `npm install` again.

### Issue: `npm install` fails on Windows

**Solutions:**
1. Run Command Prompt or PowerShell as Administrator
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`
4. Run `npm install` again
5. If still failing, try: `npm install --legacy-peer-deps`

### Issue: MySQL connection errors

**Solutions:**
1. Verify MySQL is running: `mysql -u root -p`
2. Check `.env` has correct credentials
3. Ensure database exists: `SHOW DATABASES;`
4. Check MySQL is listening on port 3306

### Issue: Port 5050 already in use

**Solution:** Change the PORT in `.env` to another port (e.g., 5051)

**Find what's using the port:**
- **Mac/Linux:** `lsof -i :5050`
- **Windows:** `netstat -ano | findstr :5050`

### Issue: Can't connect from mobile device

**Solutions:**
1. Verify both devices are on same WiFi network
2. **Check firewall settings:**
   - **Windows:** Allow Node.js through Windows Defender Firewall
   - **Mac:** System Preferences → Security & Privacy → Firewall → Firewall Options → Allow Node.js
   - **Linux:** `sudo ufw allow 5050/tcp` (if using ufw)
3. Ensure BASE_URL in `.env` uses your computer's IP, not localhost
4. Test with browser on phone first (open `http://YOUR_IP:5050/health`)
5. Disable VPN if active

### Issue: MySQL not recognized as command (Windows)

**Solution:** Add MySQL to PATH:
1. Find MySQL bin folder (usually `C:\Program Files\MySQL\MySQL Server X.X\bin`)
2. Add to System Environment Variables PATH
3. Restart Command Prompt/PowerShell
4. Or use full path: `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p`

### Issue: Different line endings causing issues

**Solution:** The repository uses `.gitattributes` to normalize line endings automatically. If you still have issues:
- **Windows:** Configure Git to use `core.autocrlf=true`
- **Mac/Linux:** Configure Git to use `core.autocrlf=input`

---

## 🔐 Security Notes

- **Never commit `.env`** - It contains sensitive passwords and configuration
- **Never commit `node_modules`** - Contains platform-specific compiled binaries
- **Never commit uploaded files** - User content should not be in version control (uploads are currently in .gitignore)
- Keep `JWT_SECRET` secret and unique per environment (minimum 32 characters)
- Use strong passwords for database
- Use App Passwords for Gmail SMTP (not your regular account password)
- Review `.gitignore` to ensure sensitive files are excluded

---

## 📚 API Documentation

See `IMPLEMENTATION_COMPLETE.md` for:
- Complete list of endpoints
- Authentication system details
- Follow system documentation
- Database schema details

---

## 🆘 Getting Help

If you encounter issues:

1. Check this SETUP.md for troubleshooting
2. Review error messages in terminal
3. Verify all environment variables in `.env`
4. Ensure database migrations were run
5. Contact team lead for assistance

---

## ✅ Setup Checklist

- [ ] Node.js installed (check with `node --version`)
- [ ] MySQL installed and running (check with `mysql --version`)
- [ ] Build tools installed (required for bcrypt)
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] Database created (`CREATE DATABASE neighbornet;`)
- [ ] Database schema loaded (`SOURCE database/schema.sql;`)
- [ ] All migrations applied (3 migration files)
- [ ] Server starts successfully (`npm start`)
- [ ] Health endpoint returns success (test with curl or browser)
- [ ] Firewall configured (if testing with mobile device)
- [ ] Mobile device can connect (if testing)

---

## 🌐 Cross-Platform Notes

This backend is designed to work on **Windows, Mac, and Linux**:

- ✅ All dependencies support multiple platforms
- ✅ File paths use Node.js path module for compatibility  
- ✅ Line endings automatically normalized by Git
- ✅ No OS-specific shell commands in the codebase
- ✅ Upload directories preserved with `.gitkeep` files

**Team members should:**
1. Follow this SETUP.md for their specific OS
2. Never commit `node_modules` or `.env` files
3. Use their own MySQL credentials in `.env`
4. Install platform-specific build tools before `npm install`

---

Happy coding! 🚀
