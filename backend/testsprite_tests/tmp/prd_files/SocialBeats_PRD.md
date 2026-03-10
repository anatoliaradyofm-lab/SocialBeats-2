# SocialBeats Backend API - Product Specification Document

## Product Overview
- **Name:** SocialBeats
- **Version:** 3.0.0
- **Type:** Backend REST API + WebSocket
- **Base URL:** https://social-music-fix.preview.emergentagent.com/api
- **Framework:** FastAPI (Python) + Socket.IO
- **Database:** MongoDB
- **Auth:** JWT Bearer Token + bcrypt

## Test Credentials
- Email: testuser2@test.com / Password: password123
- Email: test_social@test.com / Password: Test123!

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- POST /api/auth/verify-2fa
- POST /api/auth/google/mobile

### User Management
- GET /api/user/settings
- PUT /api/user/settings
- PUT /api/user/profile
- GET /api/user/{username}

### Social
- POST /api/social/friend-request/{user_id}
- GET /api/social/friend-requests
- POST /api/social/mute/{user_id}
- POST /api/social/restrict/{user_id}
- POST /api/social/close-friends/{user_id}
- GET /api/social/notifications

### Posts and Feed
- POST /api/posts
- GET /api/feed
- POST /api/posts/{id}/like

### Music
- GET /api/music/search
- GET /api/playlists
- POST /api/playlists

### Stories
- GET /api/stories
- POST /api/stories

### Messaging
- GET /api/conversations
- POST /api/messages

### Search
- GET /api/search
- GET /api/discover
