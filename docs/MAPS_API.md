# Maps & Location API Documentation

This document describes the location-based API endpoints for displaying events on maps.

## Table of Contents
1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Use Cases](#use-cases)
4. [React Native Integration](#react-native-integration)
5. [Examples](#examples)

---

## Overview

The Maps API provides endpoints to retrieve events based on geographic location, making it easy to display events on interactive maps in your React Native application. The API supports:

- **Radius-based queries**: Get events within a specific distance from a point
- **Bounding box queries**: Get events visible in the current map viewport
- **Distance calculations**: Automatic distance calculation from query point
- **Filtering**: Filter by event status and date ranges

All location calculations use the Haversine formula for accurate distance measurements on Earth's surface.

---

## Endpoints

### 1. Get Nearby Events (Radius Search)

Get all events within a specified radius from a center point.

**Endpoint:** `GET /api/events/nearby`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `latitude` (required): Center point latitude (-90 to 90)
- `longitude` (required): Center point longitude (-180 to 180)
- `radius` (optional): Search radius in kilometers (default: 10)
- `limit` (optional): Maximum number of results (default: 100)
- `status` (optional): Filter by status - 'upcoming', 'ongoing', 'completed', 'cancelled', or 'all' (default: 'upcoming')

**Example Request:**
```bash
GET /api/events/nearby?latitude=40.7128&longitude=-74.0060&radius=5&limit=50
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "events": [
    {
      "event_id": 1,
      "post_id": 10,
      "title": "Community BBQ",
      "description": "Join us for a neighborhood BBQ!",
      "event_date": "2025-01-20T15:00:00.000Z",
      "location": "Central Park",
      "location_lat": 40.7829,
      "location_lng": -73.9654,
      "max_attendees": 50,
      "current_attendees": 23,
      "organizer_id": 5,
      "organizer_name": "John Doe",
      "organizer_image": "https://example.com/profile.jpg",
      "status": "upcoming",
      "distance": 1.23,
      "going_count": 23,
      "interested_count": 15,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ],
  "center": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius": 5,
  "count": 1
}
```

**Notes:**
- Events are sorted by distance (nearest first), then by date
- Only returns events with valid location coordinates
- Distance is in kilometers
- Includes RSVP counts (going_count, interested_count)

---

### 2. Get Events by Map Bounds

Get all events visible within a map's viewport (bounding box).

**Endpoint:** `GET /api/events/map-bounds`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `north` (required): Northern boundary latitude
- `south` (required): Southern boundary latitude
- `east` (required): Eastern boundary longitude
- `west` (required): Western boundary longitude
- `status` (optional): Filter by status (default: 'upcoming')
- `limit` (optional): Maximum results (default: 200)

**Example Request:**
```bash
GET /api/events/map-bounds?north=40.8&south=40.7&east=-73.9&west=-74.1&status=upcoming
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "events": [
    {
      "event_id": 1,
      "title": "Community BBQ",
      "description": "Join us for a neighborhood BBQ!",
      "event_date": "2025-01-20T15:00:00.000Z",
      "location": "Central Park",
      "location_lat": 40.7829,
      "location_lng": -73.9654,
      "max_attendees": 50,
      "current_attendees": 23,
      "organizer_id": 5,
      "organizer_name": "John Doe",
      "organizer_image": "https://example.com/profile.jpg",
      "status": "upcoming",
      "going_count": 23,
      "interested_count": 15,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ],
  "bounds": {
    "north": 40.8,
    "south": 40.7,
    "east": -73.9,
    "west": -74.1
  },
  "count": 1
}
```

**Use Case:**
This endpoint is ideal for map applications where you want to show all events currently visible in the user's viewport. As the user pans or zooms the map, call this endpoint with the new bounds.

---

### 3. Get All Events (Enhanced)

Get events with optional filters (no location requirement).

**Endpoint:** `GET /api/events`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `status` (optional): Filter by status - 'upcoming', 'ongoing', 'completed', 'cancelled', or 'all'
- `from_date` (optional): Start date filter (ISO 8601 format)
- `to_date` (optional): End date filter (ISO 8601 format)
- `limit` (optional): Maximum results (default: 100)

**Example Request:**
```bash
GET /api/events?status=upcoming&from_date=2025-01-15&limit=20
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "events": [
    {
      "event_id": 1,
      "title": "Community BBQ",
      "event_date": "2025-01-20T15:00:00.000Z",
      "location": "Central Park",
      "location_lat": 40.7829,
      "location_lng": -73.9654,
      "organizer_name": "John Doe",
      "organizer_image": "https://example.com/profile.jpg",
      "going_count": 23,
      "interested_count": 15,
      "status": "upcoming"
    }
  ],
  "count": 1
}
```

---

## Location Utilities

The backend includes several location utility functions:

### Distance Calculation
- Uses Haversine formula for accurate Earth surface distances
- Returns distance in kilometers

### Coordinate Validation
- Validates latitude (-90 to 90) and longitude (-180 to 180)
- Checks for valid numeric values

### Bounding Box Calculation
- Calculate map bounds from center point and radius

### Additional Utilities
- Bearing calculation between two points
- Compass direction from bearing (N, NE, E, etc.)
- Center point calculation from multiple coordinates
- Distance formatting (meters/kilometers)

---

## Use Cases

### 1. **Map View with Pins**
Display events as pins on a map:
1. Get user's current location
2. Call `/api/events/nearby` with user's coordinates
3. Display events as markers on the map
4. Show distance from user to each event

### 2. **Dynamic Map Updates**
Update events as user pans/zooms the map:
1. Track map viewport bounds (north, south, east, west)
2. Call `/api/events/map-bounds` when bounds change
3. Update map markers with new events

### 3. **Search Nearby Events**
Let users search for events near a specific location:
1. Allow user to enter an address or search location
2. Convert address to coordinates (geocoding)
3. Call `/api/events/nearby` with those coordinates
4. Display results in a list or on a map

### 4. **Event Details with Directions**
Show event location and provide navigation:
1. Get event details including location_lat and location_lng
2. Use coordinates to show event location on map
3. Calculate distance from user to event
4. Integrate with native maps for directions

---

## React Native Integration

### Example: Using react-native-maps

```javascript
import React, { useState, useEffect } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

function EventsMap() {
  const [events, setEvents] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [region, setRegion] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  // Get user location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    })();
  }, []);

  // Fetch nearby events
  const fetchNearbyEvents = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://your-api.com/api/events/nearby?latitude=${latitude}&longitude=${longitude}&radius=10`,
        {
          headers: {
            'Authorization': `Bearer ${yourJWTToken}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Fetch events when region changes
  const onRegionChangeComplete = (newRegion) => {
    fetchNearbyEvents(newRegion.latitude, newRegion.longitude);
  };

  // Alternative: Fetch events by map bounds
  const fetchEventsByBounds = async (region) => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const north = latitude + latitudeDelta / 2;
    const south = latitude - latitudeDelta / 2;
    const east = longitude + longitudeDelta / 2;
    const west = longitude - longitudeDelta / 2;

    try {
      const response = await fetch(
        `https://your-api.com/api/events/map-bounds?north=${north}&south=${south}&east=${east}&west=${west}`,
        {
          headers: {
            'Authorization': `Bearer ${yourJWTToken}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
      showsUserLocation={true}
    >
      {events.map((event) => (
        <Marker
          key={event.event_id}
          coordinate={{
            latitude: event.location_lat,
            longitude: event.location_lng,
          }}
          title={event.title}
          description={`${event.distance.toFixed(1)}km away • ${event.going_count} going`}
          onCalloutPress={() => {
            // Navigate to event details
            navigation.navigate('EventDetails', { eventId: event.event_id });
          }}
        />
      ))}
    </MapView>
  );
}

export default EventsMap;
```

### Example: List View with Distance

```javascript
import React, { useState, useEffect } from 'react';
import { View, FlatList, Text } from 'react-native';
import * as Location from 'expo-location';

function NearbyEventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNearbyEvents();
  }, []);

  const loadNearbyEvents = async () => {
    try {
      // Get user location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Fetch nearby events
      const response = await fetch(
        `https://your-api.com/api/events/nearby?latitude=${latitude}&longitude=${longitude}&radius=20&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${yourJWTToken}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderEvent = ({ item }) => (
    <View style={{ padding: 16, borderBottomWidth: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.title}</Text>
      <Text style={{ color: '#666' }}>
        {item.distance.toFixed(1)}km away • {item.going_count} going
      </Text>
      <Text>{item.location}</Text>
      <Text>{new Date(item.event_date).toLocaleString()}</Text>
    </View>
  );

  return (
    <FlatList
      data={events}
      renderItem={renderEvent}
      keyExtractor={(item) => item.event_id.toString()}
      refreshing={loading}
      onRefresh={loadNearbyEvents}
    />
  );
}
```

---

## Best Practices

### 1. **Performance**
- Use map bounds endpoint for map views (more efficient)
- Use nearby endpoint for list views with distance
- Set appropriate limits to avoid large responses
- Cache results when possible

### 2. **User Experience**
- Request location permissions clearly
- Show loading states while fetching
- Handle permission denials gracefully
- Display distances in user-friendly format (km/miles)
- Sort by distance or date based on context

### 3. **Error Handling**
- Validate coordinates before sending
- Handle network errors
- Provide fallback behavior if location unavailable
- Show meaningful error messages

### 4. **Map Updates**
- Debounce map region changes (avoid excessive API calls)
- Only fetch when region changes significantly
- Use appropriate radius/bounds for zoom level
- Show loading indicator during fetch

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Latitude and longitude are required"
}
```

### 400 Invalid Coordinates
```json
{
  "error": "Latitude must be between -90 and 90"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

---

## Example Coordinate Systems

### Common Cities (for testing)
- **New York City**: 40.7128, -74.0060
- **Los Angeles**: 34.0522, -118.2437
- **Chicago**: 41.8781, -87.6298
- **Miami**: 25.7617, -80.1918
- **San Francisco**: 37.7749, -122.4194

### Testing Tips
1. Use real coordinates for testing
2. Test with different radius values (1km, 5km, 10km, 50km)
3. Test map bounds with realistic viewport sizes
4. Test edge cases (poles, international date line)
5. Test with no events in range

---

## Future Enhancements

Consider these potential improvements:
- [ ] Clustering for dense event areas
- [ ] Heat maps for event density
- [ ] Route optimization for multiple events
- [ ] Geofencing notifications
- [ ] Distance-based search suggestions
- [ ] Save favorite locations
- [ ] Event categories on map
- [ ] Filter by event type on map

---

For more information about other API endpoints, see:
- [Messaging API Documentation](./MESSAGING_API.md)
- [Main API Documentation](../README.md)
