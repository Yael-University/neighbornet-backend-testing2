require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const feedRoutes = require('./routes/feed.routes');
const eventRoutes = require('./routes/events.routes');

const { errorHandler } = require('./middleware/error.middleware');
const { authenticateToken } = require('./middleware/auth.middleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NeighborNet Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;