import polyline from "@mapbox/polyline";

/**
 * Decode Google encoded polyline to array of coordinates
 * @param encodedPolyline - Encoded polyline string from Google Maps API
 * @returns Array of {latitude, longitude} objects for react-native-maps
 */
export function decodePolyline(
  encodedPolyline: string,
): Array<{ latitude: number; longitude: number }> {
  try {
    const decoded = polyline.decode(encodedPolyline);
    return decoded.map(([lat, lon]) => ({ latitude: lat, longitude: lon }));
  } catch (error) {
    return [];
  }
}
