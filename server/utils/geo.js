/**
 * Haversine distance in km between two [lng, lat] points.
 */
function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Distance curve shared by Rule 1 (SAI) and Rule 2 (Academy) and Rule 10 (Coach),
 * exactly as specified in the rules document:
 * 0-10km=100; 10-25km=90; 25-50km=75; 50-100km=50; 100-200km=25; >200km=10
 */
function distanceScore(km) {
  if (km <= 10) return 100;
  if (km <= 25) return 90;
  if (km <= 50) return 75;
  if (km <= 100) return 50;
  if (km <= 200) return 25;
  return 10;
}

module.exports = { haversineKm, distanceScore };
