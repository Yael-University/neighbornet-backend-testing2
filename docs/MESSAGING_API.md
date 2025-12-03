# Messaging API Documentation

This document describes the messaging API endpoints for both direct messaging (DMs) and group messaging.

## Table of Contents
1. [Direct Messaging](#direct-messaging)
2. [Group Messaging](#group-messaging)
3. [Data Models](#data-models)
4. [Error Responses](#error-responses)

---

## Direct Messaging

All direct messaging endpoints require authentication via JWT token.

### Send Direct Message
Send a message to another user.

**Endpoint:** `POST /api/direct/send`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "receiver_id": 123,
  "content": "Hello! How are you?",
  "media_url": "https://example.com/image.jpg" // optional
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": {
    "message_id": 456,
    "sender_id": 789,
    "receiver_id": 123,
    "content": "Hello! How are you?",
    "media_url": "https://example.com/image.jpg",
    "is_read": false,
    "created_at": "2025-01-15T10:30:00.000Z",
    "sender_name": "John Doe",
    "sender_username": "johndoe",
    "sender_image": "https://example.com/profile.jpg"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input or sending message to self
- `404 Not Found`: Receiver not found
- `500 Internal Server Error`: Server error

---

### Get Messages with User
Retrieve all messages between authenticated user and another user.

**Endpoint:** `GET /api/direct/:userId/messages`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `userId` (integer): The user ID to get messages with

**Success Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "message_id": 1,
      "sender_id": 789,
      "receiver_id": 123,
      "content": "Hello!",
      "media_url": null,
      "is_read": true,
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    {
      "message_id": 2,
      "sender_id": 123,
      "receiver_id": 789,
      "content": "Hi there!",
      "media_url": null,
      "is_read": true,
      "created_at": "2025-01-15T10:31:00.000Z"
    }
  ]
}
```

**Notes:**
- Messages are returned in chronological order (oldest first)
- Automatically marks messages as read when fetched

---

### Get Conversations List
Get all direct message conversations for the authenticated user.

**Endpoint:** `GET /api/direct/conversations`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "conversations": [
    {
      "user": {
        "user_id": 123,
        "display_name": "Jane Smith",
        "profile_image_url": "https://example.com/profile.jpg"
      },
      "last_message_time": "2025-01-15T10:30:00.000Z",
      "unread_count": 3
    },
    {
      "user": {
        "user_id": 456,
        "display_name": "Bob Johnson",
        "profile_image_url": null
      },
      "last_message_time": "2025-01-14T15:20:00.000Z",
      "unread_count": 0
    }
  ]
}
```

**Notes:**
- Conversations are sorted by most recent message first

---

### Get Unread Count
Get the total count of unread direct messages.

**Endpoint:** `GET /api/direct/unread/count`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "unread": 5
}
```

---

## Group Messaging

All group messaging endpoints require authentication via JWT token.

### Create Group
Create a new group.

**Endpoint:** `POST /api/groups/create`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "My Street Group",
  "description": "Group for neighbors on Main Street",
  "group_type": "street", // 'street', 'block', 'neighborhood', or 'interest'
  "street_name": "Main Street", // optional
  "is_private": true // optional, defaults to true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Group created successfully",
  "group_id": 10
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `500 Internal Server Error`: Server error

---

### Get User's Groups
Get all groups the authenticated user is a member of.

**Endpoint:** `GET /api/groups/my-groups`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "groups": [
    {
      "group_id": 10,
      "name": "My Street Group",
      "description": "Group for neighbors on Main Street",
      "group_type": "street",
      "street_name": "Main Street",
      "is_private": true,
      "member_count": 15,
      "created_at": "2025-01-10T12:00:00.000Z",
      "role": "admin",
      "creator_name": "John Doe",
      "unread_count": 5
    }
  ]
}
```

---

### Get Group Details
Get detailed information about a specific group.

**Endpoint:** `GET /api/groups/:groupId`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `groupId` (integer): The group ID

**Success Response (200):**
```json
{
  "success": true,
  "group": {
    "group_id": 10,
    "name": "My Street Group",
    "description": "Group for neighbors on Main Street",
    "group_type": "street",
    "street_name": "Main Street",
    "is_private": true,
    "created_by": 789,
    "member_count": 15,
    "created_at": "2025-01-10T12:00:00.000Z",
    "creator_name": "John Doe",
    "creator_image": "https://example.com/profile.jpg",
    "user_role": "admin",
    "members": [
      {
        "membership_id": 1,
        "role": "admin",
        "joined_at": "2025-01-10T12:00:00.000Z",
        "user_id": 789,
        "display_name": "John Doe",
        "username": "johndoe",
        "profile_image_url": "https://example.com/profile.jpg"
      }
    ]
  }
}
```

**Error Responses:**
- `403 Forbidden`: Not a member of the group
- `404 Not Found`: Group not found

---

### Send Group Message
Send a message to a group.

**Endpoint:** `POST /api/groups/:groupId/messages`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
- `groupId` (integer): The group ID

**Request Body:**
```json
{
  "content": "Hello everyone!",
  "message_type": "text", // optional: 'text', 'image', 'alert', 'system'
  "media_url": "https://example.com/image.jpg" // optional
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": {
    "message_id": 100,
    "group_id": 10,
    "user_id": 789,
    "content": "Hello everyone!",
    "message_type": "text",
    "media_url": null,
    "is_read": false,
    "created_at": "2025-01-15T10:30:00.000Z",
    "display_name": "John Doe",
    "username": "johndoe",
    "profile_image_url": "https://example.com/profile.jpg"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input
- `403 Forbidden`: Not a member of the group

---

### Get Group Messages
Retrieve messages from a group.

**Endpoint:** `GET /api/groups/:groupId/messages`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `groupId` (integer): The group ID

**Query Parameters:**
- `limit` (integer, optional): Number of messages to retrieve (default: 50)
- `before` (integer, optional): Get messages before this message ID (for pagination)

**Success Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "message_id": 100,
      "group_id": 10,
      "user_id": 789,
      "content": "Hello everyone!",
      "message_type": "text",
      "media_url": null,
      "is_read": true,
      "created_at": "2025-01-15T10:30:00.000Z",
      "display_name": "John Doe",
      "username": "johndoe",
      "profile_image_url": "https://example.com/profile.jpg"
    }
  ]
}
```

**Notes:**
- Messages are returned in chronological order
- Automatically marks messages as read when fetched

---

### Add Member to Group
Add a user to a group (admin/moderator only).

**Endpoint:** `POST /api/groups/:groupId/members`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
- `groupId` (integer): The group ID

**Request Body:**
```json
{
  "user_id": 456
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member added successfully"
}
```

**Error Responses:**
- `400 Bad Request`: User already a member or invalid user_id
- `403 Forbidden`: Only admins and moderators can add members
- `404 Not Found`: User not found

---

### Remove Member from Group
Remove a user from a group (admin only, or user removing themselves).

**Endpoint:** `DELETE /api/groups/:groupId/members/:memberId`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `groupId` (integer): The group ID
- `memberId` (integer): The user ID to remove

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Error Responses:**
- `403 Forbidden`: Permission denied

---

### Update Member Role
Change a member's role in the group (admin only).

**Endpoint:** `PATCH /api/groups/:groupId/members/:memberId/role`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
- `groupId` (integer): The group ID
- `memberId` (integer): The user ID to update

**Request Body:**
```json
{
  "role": "moderator" // 'admin', 'moderator', or 'member'
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Role updated successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid role
- `403 Forbidden`: Only admins can change roles

---

### Delete Group Message
Delete a message from a group (message author, admin, or moderator).

**Endpoint:** `DELETE /api/groups/:groupId/messages/:messageId`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `groupId` (integer): The group ID
- `messageId` (integer): The message ID to delete

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Error Responses:**
- `403 Forbidden`: Permission denied
- `404 Not Found`: Message not found

---

### Leave Group
Leave a group (cannot leave if you're the only admin).

**Endpoint:** `POST /api/groups/:groupId/leave`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
- `groupId` (integer): The group ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Left group successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Cannot leave (only admin remaining)

---

## Data Models

### DirectMessage
```typescript
{
  message_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  media_url?: string;
  is_read: boolean;
  created_at: timestamp;
}
```

### ChatMessage (Group Message)
```typescript
{
  message_id: number;
  group_id: number;
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'alert' | 'system';
  media_url?: string;
  is_read: boolean;
  created_at: timestamp;
}
```

### UserGroup
```typescript
{
  group_id: number;
  name: string;
  description?: string;
  group_type: 'street' | 'block' | 'neighborhood' | 'interest';
  street_name?: string;
  is_private: boolean;
  created_by: number;
  member_count: number;
  created_at: timestamp;
}
```

### GroupMembership
```typescript
{
  membership_id: number;
  group_id: number;
  user_id: number;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'removed';
  joined_at: timestamp;
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Authentication

All messaging endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Obtain a JWT token by authenticating through the `/api/auth/login` endpoint.

---

## Rate Limiting

All API endpoints are rate-limited to 100 requests per 15 minutes per IP address.

---

## Notifications

When messages are sent, notifications are automatically created for recipients:
- Direct messages trigger a 'message' notification for the receiver
- Group messages trigger notifications for all group members except the sender

Access notifications through the `/api/notifications` endpoint (see Notifications API documentation).

---

## Best Practices

1. **Pagination**: Use the `limit` and `before` query parameters for group messages to paginate through large message histories
2. **Message Length**: Keep messages under 5000 characters
3. **Media URLs**: Ensure media URLs are valid and accessible
4. **Real-time Updates**: Consider implementing WebSocket connections for real-time message delivery
5. **Read Receipts**: Messages are automatically marked as read when fetched
6. **Group Permissions**: Always check user roles before performing administrative actions

---

## Example Workflows

### Starting a Direct Message Conversation
1. Send first message: `POST /api/direct/send`
2. Fetch conversation list: `GET /api/direct/conversations`
3. Get messages with user: `GET /api/direct/:userId/messages`

### Creating and Using a Group
1. Create group: `POST /api/groups/create`
2. Add members: `POST /api/groups/:groupId/members`
3. Send message: `POST /api/groups/:groupId/messages`
4. Get messages: `GET /api/groups/:groupId/messages`

### Managing Group Members
1. Get group details: `GET /api/groups/:groupId`
2. Update member role: `PATCH /api/groups/:groupId/members/:memberId/role`
3. Remove member: `DELETE /api/groups/:groupId/members/:memberId`
