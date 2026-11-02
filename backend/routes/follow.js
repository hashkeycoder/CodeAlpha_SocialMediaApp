const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// FOLLOW a user — auto-accepted if their account is public, pending if private
router.post('/:userId', async (req, res) => {
  try {
    const targetId = req.params.userId;

    if (targetId === req.userId) {
      return res.status(400).json({ error: "You can't follow yourself" });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: targetId } },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already following or request pending' });
    }

    const status = targetUser.isPrivate ? 'pending' : 'accepted';

    const follow = await prisma.follow.create({
      data: { followerId: req.userId, followingId: targetId, status },
    });

    await prisma.notification.create({
      data: {
        userId: targetId,
        type: status === 'pending' ? 'follow_request' : 'follow',
        fromUserId: req.userId,
      },
    });

    res.status(201).json(follow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// UNFOLLOW (or cancel a pending request)
router.delete('/:userId', async (req, res) => {
  try {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: req.params.userId } },
    });

    if (!follow) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    await prisma.follow.delete({ where: { id: follow.id } });
    res.json({ message: 'Unfollowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ACCEPT a pending follow request (private accounts)
router.post('/accept/:followerId', async (req, res) => {
  try {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.params.followerId, followingId: req.userId } },
    });

    if (!follow || follow.status !== 'pending') {
      return res.status(404).json({ error: 'No pending request from this user' });
    }

    const updated = await prisma.follow.update({
      where: { id: follow.id },
      data: { status: 'accepted' },
    });

    await prisma.notification.create({
      data: {
        userId: req.params.followerId,
        type: 'follow_accepted',
        fromUserId: req.userId,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// REJECT a pending follow request
router.post('/reject/:followerId', async (req, res) => {
  try {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.params.followerId, followingId: req.userId } },
    });

    if (!follow || follow.status !== 'pending') {
      return res.status(404).json({ error: 'No pending request from this user' });
    }

    await prisma.follow.delete({ where: { id: follow.id } });
    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET pending follow requests (people wanting to follow ME)
router.get('/requests/pending', async (req, res) => {
  try {
    const requests = await prisma.follow.findMany({
      where: { followingId: req.userId, status: 'pending' },
      include: { follower: { select: { id: true, username: true, name: true, profilePicUrl: true } } },
    });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET a user's followers (accepted only)
router.get('/followers/:userId', async (req, res) => {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: req.params.userId, status: 'accepted' },
      include: { follower: { select: { id: true, username: true, name: true, profilePicUrl: true } } },
    });
    res.json(followers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET who a user is following (accepted only)
router.get('/following/:userId', async (req, res) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.params.userId, status: 'accepted' },
      include: { following: { select: { id: true, username: true, name: true, profilePicUrl: true } } },
    });
    res.json(following);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;