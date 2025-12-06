const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateToken } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/error.middleware');
const { validateEmail, validatePassword, validateName, sanitizeInput } = require('../utils/validation');
const { sendEmail } = require('../config/email');

// POST /api/auth/register - Enhanced registration with email verification
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name, display_name, username, street } = req.body;

    // Validation
    if (!email || !password || !name || !display_name || !username) {
        return res.status(400).json({ 
            success: false,
            message: 'Required fields: email, password, name, display_name, username' 
        });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        return res.status(400).json({ success: false, message: emailValidation.message });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
        return res.status(400).json({ success: false, message: nameValidation.message });
    }

    // Check if email already exists
    const existingEmail = await query('SELECT user_id FROM Users WHERE email = ?', [email.toLowerCase()]);
    if (existingEmail.length > 0) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Check if username already taken
    const existingUsername = await query('SELECT user_id FROM Users WHERE username = ?', [username.toLowerCase()]);
    if (existingUsername.length > 0) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert user
    const result = await query(`
        INSERT INTO Users (
            email, password_hash, name, display_name, username, street,
            email_verified, verification_token, verification_token_expires
        ) VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?)
    `, [
        email.toLowerCase(),
        passwordHash,
        sanitizeInput(name),
        sanitizeInput(display_name),
        sanitizeInput(username.toLowerCase()),
        street ? sanitizeInput(street) : null,
        verificationToken,
        tokenExpires
    ]);

    const userId = result.insertId;

    // Send verification email
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
    
    await sendEmail({
        to: email,
        subject: 'Verify Your NeighborNet Email',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A90E2;">Welcome to NeighborNet!</h2>
                <p>Hi ${sanitizeInput(name)},</p>
                <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" 
                       style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link: ${verificationLink}</p>
                <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
                <p style="color: #999; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
            </div>
        `,
        text: `Welcome to NeighborNet! Verify your email: ${verificationLink}`
    });

    res.status(201).json({
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        user_id: userId
    });
}));

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            success: false,
            message: 'Email is required' 
        });
    }

    // Find user
    const users = await query(`
        SELECT user_id, email, name, email_verified 
        FROM Users 
        WHERE email = ?
    `, [email.toLowerCase()]);

    if (users.length === 0) {
        // Don't reveal if email exists (security)
        return res.json({ 
            success: true, 
            message: 'If the email exists and is unverified, a new verification link has been sent' 
        });
    }

    const user = users[0];

    // Check if already verified
    if (user.email_verified) {
        return res.status(400).json({ 
            success: false,
            message: 'Email is already verified. You can log in.' 
        });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await query(`
        UPDATE Users 
        SET verification_token = ?,
            verification_token_expires = ?
        WHERE user_id = ?
    `, [verificationToken, tokenExpires, user.user_id]);

    // Send new verification email
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
    
    await sendEmail({
        to: user.email,
        subject: 'Verify Your NeighborNet Email - New Link',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A90E2;">Email Verification</h2>
                <p>Hi ${sanitizeInput(user.name)},</p>
                <p>You requested a new verification link. Please verify your email address by clicking the link below:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" 
                       style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link: ${verificationLink}</p>
                <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
            </div>
        `,
        text: `Verify your email: ${verificationLink}. Link expires in 24 hours.`
    });

    res.json({ 
        success: true, 
        message: 'A new verification link has been sent to your email' 
    });
}));

// GET /api/auth/verify-email - Email verification
router.get('/verify-email', asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('<h2>Invalid verification link</h2>');
    }

    // Find user with this token
    const users = await query(`
        SELECT user_id, email, name 
        FROM Users 
        WHERE verification_token = ? 
        AND verification_token_expires > NOW()
        AND email_verified = FALSE
    `, [token]);

    if (users.length === 0) {
        return res.status(400).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2 style="color: #f44336;">❌ Invalid or Expired Link</h2>
                    <p>This verification link is invalid or has expired.</p>
                    <p>Please request a new verification email.</p>
                </body>
            </html>
        `);
    }

    const user = users[0];

    // Mark email as verified
    await query(`
        UPDATE Users 
        SET email_verified = TRUE,
            verification_token = NULL,
            verification_token_expires = NULL
        WHERE user_id = ?
    `, [user.user_id]);

    // Send success page
    res.send(`
        <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2 style="color: #4CAF50;">✅ Email Verified!</h2>
                <p>Your email has been verified successfully.</p>
                <p>You can now log in to NeighborNet.</p>
                <p style="margin-top: 30px;">
                    <a href="#" style="color: #4A90E2; text-decoration: none;">Return to App</a>
                </p>
            </body>
        </html>
    `);
}));

// POST /api/auth/login - Enhanced login with verification check
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            success: false,
            message: 'Email and password are required' 
        });
    }

    // Find user
    const users = await query('SELECT * FROM Users WHERE email = ?', [email.toLowerCase()]);
    
    if (users.length === 0) {
        return res.status(401).json({ 
            success: false,
            message: 'Invalid email or password' 
        });
    }

    const user = users[0];

    // Check if email is verified
    if (!user.email_verified) {
        return res.status(403).json({ 
            success: false,
            message: 'Please verify your email before logging in. Check your inbox for the verification link.' 
        });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
        return res.status(401).json({ 
            success: false,
            message: 'Invalid email or password' 
        });
    }

    // Update last login
    await query('UPDATE Users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);

    // Generate JWT token
    const token = generateToken(user.user_id);

    // Remove sensitive data
    delete user.password_hash;
    delete user.verification_token;
    delete user.reset_password_token;

    res.json({ 
        success: true, 
        message: 'Login successful', 
        token, 
        user 
    });
}));

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            success: false,
            message: 'Email is required' 
        });
    }

    // Find user
    const users = await query('SELECT user_id, email, name FROM Users WHERE email = ?', [email.toLowerCase()]);

    // Always return success (security: don't reveal if email exists)
    if (users.length === 0) {
        return res.json({ 
            success: true, 
            message: 'If the email exists, a reset code has been sent' 
        });
    }

    const user = users[0];

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store hashed code
    const hashedCode = await bcrypt.hash(resetCode, 10);

    await query(`
        UPDATE Users 
        SET reset_password_token = ?,
            reset_password_expires = ?
        WHERE user_id = ?
    `, [hashedCode, codeExpires, user.user_id]);

    // Send email with code
    await sendEmail({
        to: email,
        subject: 'Password Reset Code - NeighborNet',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A90E2;">Password Reset Request</h2>
                <p>Hi ${user.name},</p>
                <p>You requested to reset your password. Use this code:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; display: inline-block;">
                        <h1 style="color: #4A90E2; letter-spacing: 5px; margin: 0;">${resetCode}</h1>
                    </div>
                </div>
                <p style="color: #666;">This code will expire in 15 minutes.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
            </div>
        `,
        text: `Your password reset code is: ${resetCode}. Valid for 15 minutes.`
    });

    res.json({ 
        success: true, 
        message: 'Reset code sent to your email' 
    });
}));

// POST /api/auth/reset-password - Reset password with code
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
        return res.status(400).json({ 
            success: false,
            message: 'Email, code, and new password are required' 
        });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ 
            success: false,
            message: 'Password must be at least 6 characters' 
        });
    }

    // Find user with valid reset token
    const users = await query(`
        SELECT user_id, reset_password_token 
        FROM Users 
        WHERE email = ? 
        AND reset_password_expires > NOW()
    `, [email.toLowerCase()]);

    if (users.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid or expired reset code' 
        });
    }

    const user = users[0];

    // Verify code
    const isValid = await bcrypt.compare(code, user.reset_password_token);

    if (!isValid) {
        return res.status(400).json({ 
            success: false,
            message: 'Invalid reset code' 
        });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password and clear reset token
    await query(`
        UPDATE Users 
        SET password_hash = ?,
            reset_password_token = NULL,
            reset_password_expires = NULL
        WHERE user_id = ?
    `, [hashedPassword, user.user_id]);

    res.json({ 
        success: true, 
        message: 'Password reset successfully' 
    });
}));

// POST /api/auth/forgot-username - Recover username
router.post('/forgot-username', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            success: false,
            message: 'Email is required' 
        });
    }

    // Find user
    const users = await query('SELECT user_id, email, name, username FROM Users WHERE email = ?', [email.toLowerCase()]);

    // Always return success (security)
    if (users.length === 0) {
        return res.json({ 
            success: true, 
            message: 'If the email exists, the username has been sent' 
        });
    }

    const user = users[0];

    // Send email with username
    await sendEmail({
        to: email,
        subject: 'Your NeighborNet Username',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A90E2;">Username Recovery</h2>
                <p>Hi ${user.name},</p>
                <p>Your username is:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; display: inline-block;">
                        <h2 style="color: #4A90E2; margin: 0;">@${user.username}</h2>
                    </div>
                </div>
                <p>You can use this to log in to NeighborNet.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please secure your account.</p>
            </div>
        `,
        text: `Your username is: @${user.username}`
    });

    res.json({ 
        success: true, 
        message: 'Username sent to your email' 
    });
}));

module.exports = router;
