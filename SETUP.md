# NeighborNet Backend - Setup Instructions

## 🚀 Getting Started

Follow these steps to set up the backend on your machine.

---

## Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - [Download](https://dev.mysql.com/downloads/mysql/)
- **Git** - [Download](https://git-scm.com/downloads)

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

```bash
cp .env.example .env
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

### 5. Run Database Migrations

Apply all migrations in order:

```bash
# Auth fields migration
mysql -u root -p neighbornet < database/add_auth_fields.sql

# Phone field migration
mysql -u root -p neighbornet < database/add_phone_field.sql

# Follow system migration
mysql -u root -p neighbornet < database/add_follows_table.sql
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
   - **Mac/Linux:** `ifconfig | grep "inet "`
   - **Windows:** `ipconfig`

2. Update `.env`:
   ```env
   BASE_URL=http://YOUR_IP_ADDRESS:5050
   ```

3. Restart the server

4. Connect your phone to the same WiFi network

5. Update your mobile app's API URL to use your computer's IP

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

**Windows:**
```bash
npm install --global windows-build-tools
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential
```

Then run `npm install` again.

### Issue: MySQL connection errors

**Solutions:**
1. Verify MySQL is running: `mysql -u root -p`
2. Check `.env` has correct credentials
3. Ensure database exists: `SHOW DATABASES;`
4. Check MySQL is listening on port 3306

### Issue: Port 5050 already in use

**Solution:** Change the PORT in `.env` to another port (e.g., 5051)

### Issue: Can't connect from mobile device

**Solutions:**
1. Verify both devices are on same WiFi
2. Check firewall isn't blocking port 5050
3. Ensure BASE_URL uses your computer's IP, not localhost
4. Test with browser on phone first

---

## 🔐 Security Notes

- **Never commit `.env`** - It contains sensitive passwords
- **Never commit `node_modules`** - Platform-specific binaries won't work
- Keep `JWT_SECRET` secret and unique per environment
- Use strong passwords for database
- Use App Passwords for Gmail SMTP (not your account password)

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

- [ ] Node.js installed
- [ ] MySQL installed and running
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] Database created
- [ ] Database schema loaded
- [ ] All migrations applied
- [ ] Server starts successfully
- [ ] Health endpoint returns success
- [ ] Mobile device can connect (if testing)

---

Happy coding! 🚀
