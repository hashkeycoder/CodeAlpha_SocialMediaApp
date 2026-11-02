const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// GET a user's public profile
router.get('/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        profilePicUrl: true,
        isPrivate: true,
        createdAt: true,
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.use(authMiddleware);

// UPDATE own profile — name, username, bio, privacy, profile picture
router.put('/me/profile', upload.single('profilePic'), async (req, res) => {
  try {
    const { name, username, bio, isPrivate } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (bio !== undefined) data.bio = bio;
    if (isPrivate !== undefined) data.isPrivate = isPrivate === 'true' || isPrivate === true;

    if (username !== undefined) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      data.username = username;
    }

    if (req.file) {
      data.profilePicUrl = `/uploads/${req.file.filename}`;
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true, name: true, username: true, email: true,
        bio: true, profilePicUrl: true, isPrivate: true, role: true,
      },
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// CHANGE email — requires current password to confirm identity
router.put('/me/email', async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'New email and current password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { email: newEmail },
      select: { id: true, email: true },
    });

    res.json({ message: 'Email updated', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// CHANGE password — while logged in, requires current password
router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;