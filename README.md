# CodeAlpha Social Media App

A full-stack social media platform built for the CodeAlpha Full Stack Development internship (Task 2).

## Tech Stack

- **Backend:** Node.js, Express.js, Prisma ORM, PostgreSQL (Supabase)
- **Auth:** JWT, bcrypt, email password reset (Resend)
- **Uploads:** multer (images and videos, stored locally)
- **Frontend:** HTML, CSS, vanilla JavaScript

## Features

- **Accounts:** register, login, password reset by email, edit profile (name, username, bio, picture, privacy), change email and password
- **Posts:** image/video upload, captions, hashtags, location, edit caption, delete
- **Engagement:** like, comment (with replies and comment likes), save, repost, share to a chat
- **Follow system:** follow/unfollow, private accounts with accept/reject requests
- **Feed:** your posts plus followed users' posts, newest first, with a small boost for authors you engage with
- **Stories:** 24-hour stories with a story tray and viewer
- **Messaging:** 1-on-1 and group chats, edit/delete/react/forward messages, clear or delete a chat
- **Notifications:** in-app list plus live pop-up toasts while you are active
- **Search:** people, posts, and hashtags; hashtag pages
- **Saved posts:** a page of everything you bookmarked
- **Moderation:** report posts or users; admins can dismiss reports, delete posts, ban or unban users

## Setup

1. Clone the repo and open the backend:
   ```bash
   cd backend
   npm install
   ```
2. Create `backend/.env`:
   ```
   DATABASE_URL="your_supabase_transaction_pooler_url"
   DIRECT_URL="your_supabase_session_pooler_url"
   JWT_SECRET="any_long_random_string"
   RESEND_API_KEY="your_resend_api_key"
   PORT=5001
   ```
3. Create the database tables:
   ```bash
   npx prisma migrate dev
   ```
4. Create the uploads folder if it does not exist: `backend/uploads`
5. Start the backend:
   ```bash
   npm run dev
   ```
6. Serve the `frontend` folder with a static server (for example the VS Code Live Server extension) and open `frontend/index.html`.

To make an admin, change a user's `role` to `admin` in the database.

## Known Simplifications

- **Feed ranking** is a simple heuristic (chronological with a small engagement boost), not a recommendation algorithm.
- **Messaging and notifications** use polling instead of WebSockets, with a local cache to speed up loading.
- **Stories** expire by being filtered out after 24 hours, not deleted by a scheduled job.
- **Voice and video calls** are placeholder buttons only.
- **Password reset emails** only deliver to the address that owns the Resend account unless a custom domain is verified.
- **Admin tools** cover moderation (reports, deletes, bans), not analytics.
