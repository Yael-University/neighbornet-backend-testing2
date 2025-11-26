require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const setupDatabase = async () => {
    console.log('🚀 Starting NeighborNet Database Setup...\n');

    let connection;

    try {
        console.log('📡 Connecting to MySQL...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });
        console.log('✅ Connected to MySQL\n');
        console.log("Database connection failed")

        const dbName = process.env.DB_NAME || 'neighbornet';
        console.log(`📦 Creating database '${dbName}'...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        console.log('✅ Database created/verified\n');

        await connection.query(`USE ${dbName}`);

        console.log('📋 Reading schema.sql...');
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

        if (!fs.existsSync(schemaPath)) {
            throw new Error('schema.sql file not found at: ' + schemaPath);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        console.log('✅ Schema file loaded\n');

        console.log('🔨 Executing database schema...');
        await connection.query(schema);
        console.log('✅ Database schema created successfully\n');

        console.log('🔍 Verifying tables...');
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`✅ Created ${tables.length} tables:`);
        tables.forEach(table => {
            const tableName = Object.values(table)[0];
            console.log(`   - ${tableName}`);
        });
        console.log();

        console.log('👤 Creating test moderator account...');
        const bcrypt = require('bcrypt');
        const testPassword = await bcrypt.hash('Admin123!', 10);

        try {
            await connection.query(
                `INSERT INTO Users
                 (email, password_hash, name, display_name, username, is_moderator, verification_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    'admin@neighbornet.com',
                    testPassword,
                    'Admin User',
                    'Admin',
                    'admin',
                    true,
                    'verified'
                ]
            );

            console.log('✅ Test moderator created:');
            console.log('   Email: admin@neighbornet.com');
            console.log('   Password: Admin123!\n');
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  Test moderator already exists\n');
            } else {
                throw err;
            }
        }

        console.log('👤 Creating test user account...');
        const testUserPassword = await bcrypt.hash('User123!', 10);

        try {
            await connection.query(
                `INSERT INTO Users
                 (email, password_hash, name, display_name, username, street, latitude, longitude, verification_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'user@neighbornet.com',
                    testUserPassword,
                    'Test User',
                    'Test User',
                    'testuser',
                    'Main Street',
                    40.7128,
                    -74.0060,
                    'verified'
                ]
            );

            console.log('✅ Test user created:');
            console.log('   Email: user@neighbornet.com');
            console.log('   Password: User123!\n');
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  Test user already exists\n');
            } else {
                throw err;
            }
        }

        console.log('═══════════════════════════════════════════');
        console.log('✨ Database Setup Complete!');
        console.log('═══════════════════════════════════════════');
        console.log('Database:', dbName);
        console.log('Tables:', tables.length);
        console.log('Test Accounts: 2 (1 moderator, 1 user)');
        console.log('═══════════════════════════════════════════\n');

        console.log('🎉 You can now start the server with: npm start\n');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure MySQL is running');
        console.error('2. Check your .env file has correct DB credentials');
        console.error('3. Ensure schema.sql exists in database/ folder');
        console.error('4. Verify MySQL user has CREATE DATABASE privileges\n');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

setupDatabase();