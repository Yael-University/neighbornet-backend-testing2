# NeighborNet Backend API - Complete Frontend Integration Guide

## 🚀 Quick Start

**Base URL:** `http://localhost:5050/api` (or your configured backend URL)

**Authentication:** Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📋 Complete API Reference

### 🔐 Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "display_name": "Johnny",
  "username": "johndoe"
}

Response: { success: true, token: "jwt-token", user: {...} }
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response: { success: true, token: "jwt-token", user: {...} }
```

---

### 👤 User Management

#### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>

Response: { success: true, user: {...} }
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "bio": "Community member",
  "street": "Main Street",
  "occupation": "Developer",
  "age": 30
}

Response: { success: true, user: {...} }
```

#### Upload Profile Image ✨ NEW
```http
POST /api/users/profile/image
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
  profile_image: <file> (JPEG, PNG, GIF, WEBP, max 5MB)

Response: { 
  success: true, 
  message: "Profile image uploaded successfully",
  profile_image_url: "/uploads/profiles/123_1234567890.jpg"
}
```

#### Get Public User Profile
```http
GET /api/users/public/:userId
Authorization: Bearer <token>

Response: { success: true, user: {...} }
```

---

### 📝 Posts

#### Create Post
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Post content here",
  "post_type": "general",
  "priority": "normal",
  "media_urls": ["url1", "url2"],
  "location_lat": 40.7128,
  "location_lng": -74.0060,
  "visibility_radius": 5000,
  "tags": [1, 2, 3]
}

Response: { success: true, post: {...} }
```

#### Get Single Post
```http
GET /api/posts/:postId
Authorization: Bearer <token>

Response: { success: true, post: {...} }
```

#### Update Post ✨ NEW
```http
PUT /api/posts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated content",
  "post_type": "general",
  "priority": "high",
  "media_urls": ["url1"],
  "tags": [1, 2]
}

Response: { success: true, message: "Post updated successfully", post: {...} }
```

#### Delete Post ✨ NEW
```http
DELETE /api/posts/:id
Authorization: Bearer <token>

Response: { success: true, message: "Post deleted successfully" }
```

#### Like Post
```http
POST /api/posts/:post_id/like
Authorization: Bearer <token>

Response: { success: true, message: "Post liked!" }
```

#### Unlike Post
```http
DELETE /api/posts/:post_id/like
Authorization: Bearer <token>

Response: { success: true, message: "Unliked post" }
```

#### Check Like Status ✨ NEW
```http
GET /api/posts/:post_id/like/status
Authorization: Bearer <token>

Response: { success: true, liked: true }
```

#### Get All Tags
```http
GET /api/posts/tags/all
Authorization: Bearer <token>

Response: { success: true, tags: [...] }
```

---

### 💬 Comments

#### Add Comment
```http
POST /api/posts/:post_id/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Great post!"
}

Response: { success: true, message: "Comment added", comment_id: 123 }
```

#### Get Comments
```http
GET /api/posts/:post_id/comments
Authorization: Bearer <token>

Response: { success: true, post_id: 1, comments: [...] }
```

#### Update Comment ✨ NEW
```http
PUT /api/posts/:postId/comments/:commentId
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated comment text"
}

Response: { success: true, message: "Comment updated successfully", comment: {...} }
```

#### Delete Comment ✨ NEW
```http
DELETE /api/posts/:postId/comments/:commentId
Authorization: Bearer <token>

Response: { success: true, message: "Comment deleted successfully" }
```

---

### 📰 Feed

#### Get Feed
```http
GET /api/feed
Authorization: Bearer <token>

Response: { 
  success: true, 
  posts: [...],
  pagination: { page: 1, limit: 50, total: 100, pages: 2 }
}
```

#### Get Priority/Alert Feed
```http
GET /api/feed/priority
Authorization: Bearer <token>

Response: { success: true, alerts: [...] }
```

#### Search Posts
```http
GET /api/feed/search?query=text&tag=safety
Authorization: Bearer <token>

Response: { success: true, query: "text", posts: [...] }
```

---

### 🎉 Events

#### Create Event
```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Block Party",
  "description": "Join us!",
  "event_date": "2025-12-25T18:00:00",
  "location": "Main Street Park",
  "location_lat": 40.7128,
  "location_lng": -74.0060,
  "max_attendees": 50
}

Response: { success: true, event: {...} }
```

#### Get All Events
```http
GET /api/events?status=upcoming&limit=100
Authorization: Bearer <token>

Response: { success: true, events: [...], count: 10 }
```

#### Get Events Nearby
```http
GET /api/events/nearby?latitude=40.7128&longitude=-74.0060&radius=10
Authorization: Bearer <token>

Response: { 
  success: true, 
  events: [...],
  center: { latitude: 40.7128, longitude: -74.0060 },
  radius: 10,
  count: 5
}
```

#### Get Events in Map Bounds
```http
GET /api/events/map-bounds?north=40.8&south=40.6&east=-73.9&west=-74.1
Authorization: Bearer <token>

Response: { success: true, events: [...], bounds: {...}, count: 8 }
```

#### Get Single Event
```http
GET /api/events/:event_id
Authorization: Bearer <token>

Response: { success: true, event: {...} }
```

#### Update Event
```http
PUT /api/events/:event_id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "New description",
  "max_attendees": 100
}

Response: { success: true, event: {...} }
```

#### Delete Event
```http
DELETE /api/events/:event_id
Authorization: Bearer <token>

Response: { success: true }
```

#### RSVP to Event
```http
POST /api/events/:event_id/rsvp
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "going"  // "going", "interested", "not_going"
}

Response: { success: true, status: "going", current_attendees: 25 }
```

#### Get User's RSVP
```http
GET /api/events/:event_id/rsvp
Authorization: Bearer <token>

Response: { success: true, rsvp: {...} }
```

---

### 💬 Direct Messages

#### Send Direct Message
```http
POST /api/direct/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiver_id": 2,
  "content": "Hello!",
  "media_url": "optional-url"
}

Response: { success: true, message: {...} }
```

#### Get Messages with User
```http
GET /api/direct/:userId/messages
Authorization: Bearer <token>

Response: { success: true, messages: [...] }
```

#### Get All Conversations
```http
GET /api/direct/conversations
Authorization: Bearer <token>

Response: { 
  success: true, 
  conversations: [
    { user: {...}, last_message_time: "...", unread_count: 3 }
  ]
}
```

#### Get Unread Count
```http
GET /api/direct/unread/count
Authorization: Bearer <token>

Response: { success: true, unread: 5 }
```

---

### 👥 Groups

#### Create Group
```http
POST /api/groups/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Block Watch",
  "description": "Neighborhood safety group",
  "group_type": "street",
  "street_name": "Main Street",
  "is_private": true
}

Response: { success: true, message: "Group created successfully", group_id: 1 }
```

#### Get My Groups
```http
GET /api/groups/my-groups
Authorization: Bearer <token>

Response: { success: true, groups: [...] }
```

#### Get Group Details
```http
GET /api/groups/:groupId
Authorization: Bearer <token>

Response: { 
  success: true, 
  group: { 
    ..., 
    members: [...],
    user_role: "admin"
  }
}
```

#### Send Group Message
```http
POST /api/groups/:groupId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello group!",
  "message_type": "text",
  "media_url": "optional"
}

Response: { success: true, message: {...} }
```

#### Get Group Messages
```http
GET /api/groups/:groupId/messages?limit=50&before=100
Authorization: Bearer <token>

Response: { success: true, messages: [...] }
```

#### Add Member
```http
POST /api/groups/:groupId/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": 5
}

Response: { success: true, message: "Member added successfully" }
```

#### Remove Member
```http
DELETE /api/groups/:groupId/members/:memberId
Authorization: Bearer <token>

Response: { success: true, message: "Member removed successfully" }
```

#### Update Member Role
```http
PATCH /api/groups/:groupId/members/:memberId/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "moderator"  // "admin", "moderator", "member"
}

Response: { success: true, message: "Role updated successfully" }
```

#### Delete Group Message
```http
DELETE /api/groups/:groupId/messages/:messageId
Authorization: Bearer <token>

Response: { success: true, message: "Message deleted successfully" }
```

#### Leave Group
```http
POST /api/groups/:groupId/leave
Authorization: Bearer <token>

Response: { success: true, message: "Left group successfully" }
```

---

### 🔔 Notifications ✨ NEW

#### Get All Notifications
```http
GET /api/notifications?limit=50&unread_only=false
Authorization: Bearer <token>

Response: { 
  success: true, 
  notifications: [...],
  count: 10
}
```

#### Get Unread Count
```http
GET /api/notifications/unread/count
Authorization: Bearer <token>

Response: { success: true, unread_count: 5 }
```

#### Mark Notification as Read
```http
PATCH /api/notifications/:notificationId/read
Authorization: Bearer <token>

Response: { success: true, message: "Notification marked as read" }
```

#### Mark All as Read
```http
PATCH /api/notifications/read-all
Authorization: Bearer <token>

Response: { success: true, message: "All notifications marked as read" }
```

#### Delete Notification
```http
DELETE /api/notifications/:notificationId
Authorization: Bearer <token>

Response: { success: true, message: "Notification deleted" }
```

#### Clear Read Notifications
```http
DELETE /api/notifications/clear-read
Authorization: Bearer <token>

Response: { success: true, message: "Read notifications cleared" }
```

---

### 🏆 Badges ✨ NEW

#### Get All Badges
```http
GET /api/badges
Authorization: Bearer <token>

Response: { success: true, badges: [...] }
```

#### Get User's Badges
```http
GET /api/badges/user/:userId
Authorization: Bearer <token>

Response: { success: true, badges: [...], count: 5 }
```

#### Get My Badges
```http
GET /api/badges/my-badges
Authorization: Bearer <token>

Response: { success: true, badges: [...], count: 3 }
```

#### Toggle Badge Display
```http
PATCH /api/badges/:badgeId/display
Authorization: Bearer <token>
Content-Type: application/json

{
  "is_displayed": true
}

Response: { success: true, message: "Badge display status updated" }
```

#### Get Badge Progress
```http
GET /api/badges/progress
Authorization: Bearer <token>

Response: { 
  success: true, 
  badges: [
    {
      ...badge,
      earned: false,
      progress: { current: 3, target: 10, percentage: 30 }
    }
  ],
  stats: {...}
}
```

---

### 🤝 Trusted Contacts ✨ NEW

#### Send Contact Request
```http
POST /api/contacts/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "trusted_user_id": 5
}

Response: { success: true, message: "Contact request sent" }
```

#### Get My Contacts
```http
GET /api/contacts/my-contacts
Authorization: Bearer <token>

Response: { success: true, contacts: [...], count: 10 }
```

#### Get Pending Requests
```http
GET /api/contacts/requests
Authorization: Bearer <token>

Response: { success: true, requests: [...], count: 2 }
```

#### Accept Request
```http
PATCH /api/contacts/:contactId/accept
Authorization: Bearer <token>

Response: { success: true, message: "Contact request accepted" }
```

#### Reject Request
```http
PATCH /api/contacts/:contactId/reject
Authorization: Bearer <token>

Response: { success: true, message: "Contact request rejected" }
```

#### Block Contact
```http
PATCH /api/contacts/:contactId/block
Authorization: Bearer <token>

Response: { success: true, message: "Contact blocked" }
```

#### Remove Contact
```http
DELETE /api/contacts/:contactId
Authorization: Bearer <token>

Response: { success: true, message: "Contact removed" }
```

---

## 🔧 Frontend Implementation Examples

### Setting Up API Client

```javascript
// api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:5050/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      AsyncStorage.removeItem('authToken');
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Authentication

```javascript
// api/auth.js
import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authAPI = {
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
  },
};
```

### Posts API

```javascript
// api/posts.js
import apiClient from './client';

export const postsAPI = {
  createPost: async (postData) => {
    const response = await apiClient.post('/posts', postData);
    return response.data;
  },

  updatePost: async (postId, postData) => {
    const response = await apiClient.put(`/posts/${postId}`, postData);
    return response.data;
  },

  deletePost: async (postId) => {
    const response = await apiClient.delete(`/posts/${postId}`);
    return response.data;
  },

  getPost: async (postId) => {
    const response = await apiClient.get(`/posts/${postId}`);
    return response.data;
  },

  likePost: async (postId) => {
    const response = await apiClient.post(`/posts/${postId}/like`);
    return response.data;
  },

  unlikePost: async (postId) => {
    const response = await apiClient.delete(`/posts/${postId}/like`);
    return response.data;
  },

  checkLikeStatus: async (postId) => {
    const response = await apiClient.get(`/posts/${postId}/like/status`);
    return response.data;
  },

  addComment: async (postId, content) => {
    const response = await apiClient.post(`/posts/${postId}/comments`, { content });
    return response.data;
  },

  updateComment: async (postId, commentId, content) => {
    const response = await apiClient.put(`/posts/${postId}/comments/${commentId}`, { content });
    return response.data;
  },

  deleteComment: async (postId, commentId) => {
    const response = await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
    return response.data;
  },

  getComments: async (postId) => {
    const response = await apiClient.get(`/posts/${postId}/comments`);
    return response.data;
  },
};
```

### Profile Image Upload

```javascript
// api/users.js
import apiClient from './client';

export const usersAPI = {
  uploadProfileImage: async (imageUri) => {
    const formData = new FormData();
    formData.append('profile_image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    });

    const response = await apiClient.post('/users/profile/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/users/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put('/users/profile', profileData);
    return response.data;
  },
};
```

### Notifications

```javascript
// api/notifications.js
import apiClient from './client';

export const notificationsAPI = {
  getNotifications: async (limit = 50, unreadOnly = false) => {
    const response = await apiClient.get('/notifications', {
      params: { limit, unread_only: unreadOnly },
    });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/unread/count');
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await apiClient.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  clearRead: async () => {
    const response = await apiClient.delete('/notifications/clear-read');
    return response.data;
  },
};
```

### Feed

```javascript
// api/feed.js
import apiClient from './client';

export const feedAPI = {
  getFeed: async () => {
    const response = await apiClient.get('/feed');
    return response.data;
  },

  getPriorityAlerts: async () => {
    const response = await apiClient.get('/feed/priority');
    return response.data;
  },

  searchPosts: async (query, tag = null) => {
    const response = await apiClient.get('/feed/search', {
      params: { query, tag },
    });
    return response.data;
  },
};
```

### Events

```javascript
// api/events.js
import apiClient from './client';

export const eventsAPI = {
  createEvent: async (eventData) => {
    const response = await apiClient.post('/events', eventData);
    return response.data;
  },

  getEvents: async (status = 'upcoming', limit = 100) => {
    const response = await apiClient.get('/events', {
      params: { status, limit },
    });
    return response.data;
  },

  getNearbyEvents: async (latitude, longitude, radius = 10) => {
    const response = await apiClient.get('/events/nearby', {
      params: { latitude, longitude, radius },
    });
    return response.data;
  },

  rsvpToEvent: async (eventId, status) => {
    const response = await apiClient.post(`/events/${eventId}/rsvp`, { status });
    return response.data;
  },

  getUserRSVP: async (eventId) => {
    const response = await apiClient.get(`/events/${eventId}/rsvp`);
    return response.data;
  },
};
```

---

## 🔑 Important Notes

### Authentication
- All endpoints except `/auth/register` and `/auth/login` require authentication
- Store the JWT token securely using AsyncStorage or similar
- Include the token in the Authorization header for all authenticated requests

### Error Handling
- Always handle 401 (Unauthorized) errors by redirecting to login
- Display appropriate error messages from the API response
- Handle network errors gracefully

### Image Uploads
- Profile images must be sent as `multipart/form-data`
- Field name must be `profile_image`
- Supported formats: JPEG, JPG, PNG, GIF, WEBP
- Maximum file size: 5MB
- Old images are automatically deleted when uploading a new one

### Post Management
- Posts are soft-deleted (status changed to 'removed')
- Only post owners can update/delete their posts
- Comments can only be edited/deleted by their authors

### Real-time Features
- Consider implementing WebSocket or polling for real-time notifications
- Poll `/notifications/unread/count` periodically for notification badge
- Poll `/direct/unread/count` for message notifications

### Static Files
- Uploaded images are accessible at: `http://localhost:5050/uploads/profiles/{filename}`
- Use the full URL returned from the upload endpoint

---

## 📱 React Native Example Components

### Post Card with New Features

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { postsAPI } from '../api/posts';

const PostCard = ({ post, currentUserId, onUpdate, onDelete }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);

  useEffect(() => {
    checkLikeStatus();
  }, []);

  const checkLikeStatus = async () => {
    try {
      const response = await postsAPI.checkLikeStatus(post.post_id);
      setLiked(response.liked);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await postsAPI.unlikePost(post.post_id);
        setLikesCount(prev => prev - 1);
      } else {
        await postsAPI.likePost(post.post_id);
        setLikesCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      await postsAPI.updatePost(post.post_id, { content: editedContent });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to update post');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsAPI.deletePost(post.post_id);
              onDelete?.();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const isOwner = post.user_id === currentUserId;

  return (
    <View style={styles.card}>
      <Text>{isEditing ? editedContent : post.content}</Text>
      
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike}>
          <Text>{liked ? '❤️' : '🤍'} {likesCount}</Text>
        </TouchableOpacity>

        {isOwner && (
          <>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Text>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete}>
              <Text>🗑️ Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isEditing && (
        <View>
          <TextInput
            value={editedContent}
            onChangeText={setEditedContent}
            multiline
          />
          <Button title="Save" onPress={handleUpdate} />
          <Button title="Cancel" onPress={() => setIsEditing(false)} />
        </View>
      )}
    </View>
  );
};
```

### Notification Bell

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { notificationsAPI } from '../api/notifications';

const NotificationBell = ({ onPress }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <View>
        <Text>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
```

---

## 🐛 Bug Fixes Applied

1. **Post Deletion Status**: Changed from 'deleted' to 'removed' (valid enum value)
2. **Comment Updates**: Removed non-existent `updated_at` column reference
3. **Events Query**: Fixed LIMIT parameter binding issue
4. **Profile Image Upload**: Fixed field name from 'image' to 'profile_image'
5. **Events Creation**: Fixed event_id retrieval after insert

---

## 🚀 What's New

### Newly Implemented Endpoints:
- ✅ POST `/api/users/profile/image` - Upload profile picture
- ✅ PUT `/api/posts/:id` - Update posts
- ✅ DELETE `/api/posts/:id` - Delete posts
- ✅ PUT `/api/posts/:postId/comments/:commentId` - Update comments
- ✅ DELETE `/api/posts/:postId/comments/:commentId` - Delete comments
- ✅ GET `/api/posts/:post_id/like/status` - Check like status
- ✅ All Notification endpoints
- ✅ All Badge endpoints
- ✅ All Trusted Contact endpoints

---

## 📞 Support

If you encounter any issues:
1. Check the server logs for detailed error messages
2. Verify authentication token is valid and included
3. Ensure request body matches the expected format
4. Check that file uploads use correct field names and formats

---

**Happy Coding! 🎉**
