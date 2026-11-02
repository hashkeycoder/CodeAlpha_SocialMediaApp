require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware (must come first)
app.use(cors());
app.use(express.json());

// Serve uploaded media (post images/videos, profile pics, story media)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const postRoutes = require('./routes/posts');
app.use('/api/posts', postRoutes);

const engagementRoutes = require('./routes/engagement');
app.use('/api/engage', engagementRoutes);

const followRoutes = require('./routes/follow');
app.use('/api/follow', followRoutes);

const feedRoutes = require('./routes/feed');
app.use('/api/feed', feedRoutes);

const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

const searchRoutes = require('./routes/search');
app.use('/api/search', searchRoutes);

const storyRoutes = require('./routes/stories');
app.use('/api/stories', storyRoutes);

const reportRoutes = require('./routes/reports');
app.use('/api/reports', reportRoutes);

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Social Media API is running' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});