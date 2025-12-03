# Messaging System Setup Guide

This guide will help you set up and test the messaging system for your NeighborNet backend.

## Overview

The messaging system includes:
- **Direct Messaging (DMs)**: One-on-one private messages between users
- **Group Messaging**: Multi-user group chats with roles (admin, moderator, member)
- **Notifications**: Automatic notifications for new messages
- **Media Support**: Optional media attachments for messages
- **Read Receipts**: Automatic tracking of message read status

## Database Schema Changes

The messaging system uses the following database tables:

### DirectMessages
- `message_id` (Primary Key)
- `sender_id` (Foreign Key to Users)
- `receiver_id` (Foreign Key to Users)
- `content` (Message text)
- `media_url` (Optional media attachment)
- `is_read` (Read status)
- `created_at` (Timestamp)

### UserGroups
- `group_id` (Primary Key)
- `name` (Group name)
- `description` (Optional description)
- `group_type` (street, block, neighborhood, interest)
- `street_name` (Optional)
- `is_private` (Privacy setting)
- `created_by` (Foreign Key to Users)
- `member_count` (Number of members)
- `created_at` (Timestamp)

### GroupMemberships
- `membership_id` (Primary Key)
- `group_id` (Foreign Key to UserGroups)
- `user_id` (Foreign Key to Users)
- `role` (admin, moderator, member)
- `status` (active, pending, removed)
- `joined_at` (Timestamp)

### ChatMessages
- `message_id` (Primary Key)
- `group_id` (Foreign Key to UserGroups)
- `user_id` (Foreign Key to Users)
- `content` (Message text)
- `message_type` (text, image, alert, system)
- `media_url` (Optional media attachment)
- `is_read` (Read status)
- `created_at` (Timestamp)

## Setup Instructions

### 1. Update Database Schema

Run the database schema update:

```bash
npm run setup-db
```

This will create/update all necessary tables including the new `media_url` field for DirectMessages.

### 2. Environment Variables

Ensure your `.env` file contains:

```env
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=neighbornet
JWT_SECRET=your_jwt_secret_key
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### 3. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on port 5000 (or your configured PORT).

## API Endpoints

### Direct Messaging
- `POST /api/direct/send` - Send a direct message
- `GET /api/direct/:userId/messages` - Get messages with a specific user
- `GET /api/direct/conversations` - Get all conversations
- `GET /api/direct/unread/count` - Get unread message count

### Group Messaging
- `POST /api/groups/create` - Create a new group
- `GET /api/groups/my-groups` - Get user's groups
- `GET /api/groups/:groupId` - Get group details
- `POST /api/groups/:groupId/messages` - Send group message
- `GET /api/groups/:groupId/messages` - Get group messages
- `POST /api/groups/:groupId/members` - Add member to group
- `DELETE /api/groups/:groupId/members/:memberId` - Remove member
- `PATCH /api/groups/:groupId/members/:memberId/role` - Update member role
- `DELETE /api/groups/:groupId/messages/:messageId` - Delete message
- `POST /api/groups/:groupId/leave` - Leave group

For detailed API documentation, see [MESSAGING_API.md](./MESSAGING_API.md).

## Testing the Messaging System

### Prerequisites
1. Create at least 2 test users through `/api/auth/register`
2. Login to get JWT tokens for each user

### Testing Direct Messages

#### 1. Send a Direct Message
```bash
curl -X POST http://localhost:5000/api/direct/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "receiver_id": 2,
    "content": "Hello! This is a test message."
  }'
```

#### 2. Get Messages with a User
```bash
curl -X GET http://localhost:5000/api/direct/2/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Get Conversations List
```bash
curl -X GET http://localhost:5000/api/direct/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Get Unread Count
```bash
curl -X GET http://localhost:5000/api/direct/unread/count \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Testing Group Messages

#### 1. Create a Group
```bash
curl -X POST http://localhost:5000/api/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Group",
    "description": "A group for testing",
    "group_type": "interest",
    "is_private": true
  }'
```

#### 2. Get User's Groups
```bash
curl -X GET http://localhost:5000/api/groups/my-groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Add a Member to Group
```bash
curl -X POST http://localhost:5000/api/groups/1/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "user_id": 2
  }'
```

#### 4. Send a Group Message
```bash
curl -X POST http://localhost:5000/api/groups/1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "content": "Hello everyone in the group!",
    "message_type": "text"
  }'
```

#### 5. Get Group Messages
```bash
curl -X GET http://localhost:5000/api/groups/1/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 6. Update Member Role (Admin only)
```bash
curl -X PATCH http://localhost:5000/api/groups/1/members/2/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "role": "moderator"
  }'
```

## Validation Rules

### Message Content
- Required field
- Cannot be empty
- Maximum 5000 characters

### Group Creation
- Name required (2-100 characters)
- Group type must be: street, block, neighborhood, or interest
- Description is optional

### Permissions
- **Direct Messages**: Any authenticated user can send to any other user
- **Group Messages**: 
  - Only members can send messages
  - Only admins/moderators can add members
  - Only admins can change roles
  - Only admins or message authors can delete messages
  - Users can leave groups (unless they're the only admin)

## Features Implemented

### Direct Messaging
✅ Send direct messages with optional media
✅ View message history between users
✅ List all conversations with unread counts
✅ Get total unread message count
✅ Automatic read receipts
✅ Notifications for new messages
✅ Input validation and error handling
✅ User existence verification

### Group Messaging
✅ Create groups with different types (street, block, neighborhood, interest)
✅ Role-based permissions (admin, moderator, member)
✅ Add/remove members
✅ Send and receive group messages
✅ Message pagination
✅ Delete messages (with permission checks)
✅ Leave groups
✅ Update member roles
✅ Automatic notifications for group messages
✅ View group details and member list
✅ Unread message counts per group

### Security & Validation
✅ JWT authentication required for all endpoints
✅ Input validation for all requests
✅ SQL injection prevention (parameterized queries)
✅ Permission checks for administrative actions
✅ Rate limiting (100 requests per 15 minutes)
✅ Cannot send messages to self
✅ User existence verification

## Error Handling

The system handles various error scenarios:
- Invalid authentication tokens (401)
- Missing required fields (400)
- User not found (404)
- Insufficient permissions (403)
- Group not found (404)
- Already a group member (400)
- Cannot leave as only admin (400)
- Database errors (500)

## Future Enhancements (Optional)

Consider implementing these features in the future:
- [ ] WebSocket support for real-time messaging
- [ ] Message editing capability
- [ ] Message reactions/emojis
- [ ] File upload service for media
- [ ] Message search functionality
- [ ] Typing indicators
- [ ] Online/offline status
- [ ] Message threading/replies
- [ ] Group avatars and customization
- [ ] Mute/unmute conversations
- [ ] Block users functionality
- [ ] Message encryption
- [ ] Voice/video call support
- [ ] Message delivery status (sent, delivered, read)

## Troubleshooting

### Common Issues

**Issue**: Cannot connect to database
- **Solution**: Check your `.env` file has correct database credentials
- Run `npm run setup-db` to ensure tables exist

**Issue**: 401 Unauthorized errors
- **Solution**: Ensure JWT token is valid and included in Authorization header
- Token format: `Bearer YOUR_JWT_TOKEN`

**Issue**: 403 Forbidden when adding members
- **Solution**: Only admins and moderators can add members. Check user's role in the group

**Issue**: Messages not appearing
- **Solution**: Verify you're querying the correct group/conversation ID
- Check that users are members of the group

**Issue**: Cannot leave group
- **Solution**: If you're the only admin, promote another member to admin first

## Support

For detailed API documentation, see [MESSAGING_API.md](./MESSAGING_API.md).

For issues or questions, check the main README or contact the development team.
