require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const feedRoutes = require('./routes/feed.routes');
const eventRoutes = require('./routes/events.routes');
const directRoutes = require('./routes/direct.routes');
const groupRoutes = require('./routes/groups.routes');
const notificationRoutes = require('./routes/notifications.routes');
const badgeRoutes = require('./routes/badges.routes');
const contactRoutes = require('./routes/contacts.routes');
const followRoutes = require('./routes/follows.routes');

const { errorHandler } = require('./middleware/error.middleware');
const { authenticateToken } = require('./middleware/auth.middleware');

const app = express();

// Configure helmet with relaxed CSP for images
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      mediaSrc: ["'self'", "data:", "blob:", "*"],
    },
  },
}));

// CORS - Allow all origins for development
app.use(cors({
  origin: '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
console.log({
  authRoutes: typeof authRoutes,
  userRoutes: typeof userRoutes,
  postRoutes: typeof postRoutes,
  feedRoutes: typeof feedRoutes,
  eventRoutes: typeof eventRoutes,
  authenticateToken: typeof authenticateToken,
  errorHandler: typeof errorHandler,
});

// CRITICAL: Static file serving MUST come before routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log static file requests for debugging
app.use('/uploads', (req, res, next) => {
  console.log('📁 Static file requested:', req.url);
  next();
});

app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/posts', authenticateToken, postRoutes);
app.use('/api/feed', authenticateToken, feedRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/direct', authenticateToken, directRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/badges', authenticateToken, badgeRoutes);
app.use('/api/contacts', authenticateToken, contactRoutes);
app.use('/api/follows', authenticateToken, followRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`\n✅ NeighborNet Backend running on http://localhost:${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'uploads')}`);
  console.log(`🖼️  Test image URL: http://localhost:${PORT}/uploads/profiles/2_1764796118638.jpg`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
