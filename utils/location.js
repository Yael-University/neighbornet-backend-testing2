/**
 * Location utilities for distance calculations and coordinate validation
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians
 * @returns {number} Degrees
 */
function toDegrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Validate coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {object} { isValid: boolean, error?: string }
 */
function validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return { isValid: false, error: 'Coordinates must be numbers' };
    }

    if (isNaN(latitude) || isNaN(longitude)) {
        return { isValid: false, error: 'Invalid coordinate values' };
    }

    if (latitude < -90 || latitude > 90) {
        return { isValid: false, error: 'Latitude must be between -90 and 90' };
    }

    if (longitude < -180 || longitude > 180) {
        return { isValid: false, error: 'Longitude must be between -180 and 180' };
    }

    return { isValid: true };
}

/**
 * Calculate bounding box for a given center point and radius
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {object} { north, south, east, west }
 */
function getBoundingBox(latitude, longitude, radiusKm) {
    const R = 6371; // Earth's radius in km
    
    // Angular distance in radians on a great circle
    const radDist = radiusKm / R;
    
    const minLat = latitude - toDegrees(radDist);
    const maxLat = latitude + toDegrees(radDist);
    
    // Adjust for longitude based on latitude
    const deltaLng = toDegrees(Math.asin(Math.sin(radDist) / Math.cos(toRadians(latitude))));
    
    const minLng = longitude - deltaLng;
    const maxLng = longitude + deltaLng;
    
    return {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
    };
}

/**
 * Check if a point is within a bounding box
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {object} bounds - { north, south, east, west }
 * @returns {boolean}
 */
function isPointInBounds(lat, lng, bounds) {
    return lat >= bounds.south && 
           lat <= bounds.north && 
           lng >= bounds.west && 
           lng <= bounds.east;
}

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
        return `${distanceKm.toFixed(1)}km`;
    } else {
        return `${Math.round(distanceKm)}km`;
    }
}

/**
 * Get center point of multiple coordinates
 * @param {Array} coordinates - Array of {latitude, longitude} objects
 * @returns {object} { latitude, longitude }
 */
function getCenterPoint(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return null;
    }

    if (coordinates.length === 1) {
        return coordinates[0];
    }

    let x = 0, y = 0, z = 0;

    for (let coord of coordinates) {
        const lat = toRadians(coord.latitude);
        const lng = toRadians(coord.longitude);

        x += Math.cos(lat) * Math.cos(lng);
        y += Math.cos(lat) * Math.sin(lng);
        z += Math.sin(lat);
    }

    const total = coordinates.length;
    x = x / total;
    y = y / total;
    z = z / total;

    const centralLng = Math.atan2(y, x);
    const centralSquareRoot = Math.sqrt(x * x + y * y);
    const centralLat = Math.atan2(z, centralSquareRoot);

    return {
        latitude: toDegrees(centralLat),
        longitude: toDegrees(centralLng)
    };
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
              Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
    
    let bearing = toDegrees(Math.atan2(y, x));
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
}

/**
 * Get compass direction from bearing
 * @param {number} bearing - Bearing in degrees
 * @returns {string} Compass direction (N, NE, E, SE, S, SW, W, NW)
 */
function getCompassDirection(bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

module.exports = {
    calculateDistance,
    toRadians,
    toDegrees,
    validateCoordinates,
    getBoundingBox,
    isPointInBounds,
    formatDistance,
    getCenterPoint,
    calculateBearing,
    getCompassDirection
};
