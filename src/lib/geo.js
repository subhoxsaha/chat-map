/**
 * Calculate the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
}

/**
 * Filter a list of users to find only those within a certain radius.
 *
 * @param {Object} currentUser - { lat, lng }
 * @param {Array} allUsers - Array of user objects containing lat and lng
 * @param {number} radiusMeters - Radius in meters
 * @returns {Array} List of nearby users
 */
export function findNearbyUsers(currentUser, allUsers, radiusMeters = 500) {
  if (!currentUser || !currentUser.lat || !currentUser.lng) return [];

  return allUsers.filter(user => {
    // Don't include self
    if (user.id === currentUser.id) return false;
    
    // Must have coordinates
    if (!user.lat || !user.lng) return false;

    const distance = haversineDistance(
      currentUser.lat,
      currentUser.lng,
      user.lat,
      user.lng
    );

    return distance <= radiusMeters;
  });
}
