const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const { generateToken } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');
const { validateEmail, validatePassword, validateName, sanitizeInput } = require('../utils/validation');

router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name, display_name, username } = req.body;
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) return res.status(400).json({ error: emailValidation.message });
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) return res.status(400).json({ error: passwordValidation.message });
    const nameValidation = validateName(name);
    if (!nameValidation.valid) return res.status(400).json({ error: nameValidation.message });
    const usernameCheck = await query('SELECT user_id FROM Users WHERE username = ?', [username]);
    if (usernameCheck.length > 0) return res.status(400).json({ error: 'Username already taken' });
    const existingUsers = await query('SELECT user_id FROM Users WHERE email = ?', [email.toLowerCase()]);
    if (existingUsers.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(`INSERT INTO Users (email, password_hash, name, display_name, username) VALUES (?, ?, ?, ?, ?)`, [email.toLowerCase(), passwordHash, sanitizeInput(name), sanitizeInput(display_name), sanitizeInput(username.toLowerCase())]);
    const token = generateToken(result.insertId);
    const users = await query(`SELECT user_id,email,name,display_name,username,created_at FROM Users WHERE user_id = ?`,[result.insertId]);
    res.status(201).json({success: true, message: 'User registered successfully', token, user: users[0]});
}));


router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const users = await query('SELECT * FROM Users WHERE email = ?', [email.toLowerCase()]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials' });
    await query('UPDATE Users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
    const token = generateToken(user.user_id);
    delete user.password_hash;
    res.json({ success: true, message: 'Login successful', token, user });
}));

module.exports = router;