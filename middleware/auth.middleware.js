const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const users = await query(
            'SELECT user_id, email, name, is_moderator, verification_status FROM Users WHERE user_id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(500).json({ error: 'Token verification failed.' });
    }
};

const requireModerator = (req, res, next) => {
    if (!req.user || !req.user.is_moderator) {
        return res.status(403).json({ error: 'Access denied. Moderator privileges required.' });
    }
    next();
};

module.exports = {
    generateToken,
    authenticateToken,
    requireModerator
};

