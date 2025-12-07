require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

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
const mediaRoutes = require('./routes/media.routes');
const reactionsRoutes = require('./routes/reactions.routes');

const { errorHandler } = require('./middleware/error.middleware');
const { authenticateToken } = require('./middleware/auth.middleware');
const { configureSocket } = require('./config/socket');
const { initializeSocketIO } = require('./utils/notifications');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configure Socket.IO with authentication and event handlers
configureSocket(io);

// Initialize notification system with Socket.IO
initializeSocketIO(io);

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

// Rate limiting with proper JSON response and higher limits
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1000, // Increased from 100 to 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retry_after: 60
    });
  }
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Health check endpoint (no rate limit)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply rate limiting only to API routes (after health check)
app.use('/api/', limiter);

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
app.use('/api', mediaRoutes);
app.use('/api', reactionsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5050;
const HOST = '0.0.0.0'; // Bind to all network interfaces for mobile access

// Increase server timeout for slow networks/large images
server.timeout = 60000; // 60 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

server.listen(PORT, HOST, () => {
  const networkInterfaces = require('os').networkInterfaces();
  let localIP = 'localhost';
  
  // Find local network IP
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });

  console.log(`\n✅ NeighborNet Backend running on:`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://${localIP}:${PORT}`);
  console.log(`🔔 WebSocket server running on ws://${localIP}:${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'uploads')}`);
  console.log(`🖼️  Test image: http://${localIP}:${PORT}/uploads/profiles/2_1764820020805.jpg`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = { app, server, io };
