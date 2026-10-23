import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { CandidatePoint, Coordinates, RouteVisualization } from '../models';
import { decodePolyline } from '../utils/polylineDecoder';
import { CONFIG } from '../constants/config';

export interface RouteMapProps {
  visualization: RouteVisualization;
  candidate: CandidatePoint;
  startPoint: Coordinates;
  endPoint: Coordinates;
  passengerHome: Coordinates;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native route map (react-native-maps). The web version lives in RouteMap.web.tsx.
 */
export function RouteMap({
  visualization,
  candidate,
  startPoint,
  endPoint,
  passengerHome,
  style,
}: RouteMapProps) {
  // Calculate map region with padding
  const { northeast, southwest } = visualization.bounds;
  const latDelta = (northeast.lat - southwest.lat) * (1 + CONFIG.MAP_PADDING);
  const lonDelta = (northeast.lon - southwest.lon) * (1 + CONFIG.MAP_PADDING);
  const centerLat = (northeast.lat + southwest.lat) / 2;
  const centerLon = (northeast.lon + southwest.lon) / 2;

  return (
    <MapView
      style={style}
      initialRegion={{
        latitude: centerLat,
        longitude: centerLon,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      }}
    >
      {/* Render polylines for each route segment */}
      {visualization.segments.map((segment, index) => {
        const coordinates = decodePolyline(segment.polyline);
        return (
          <Polyline
            key={index}
            coordinates={coordinates}
            strokeColor={segment.color}
            strokeWidth={CONFIG.POLYLINE_WIDTH}
            lineDashPattern={segment.label.includes('Walking') ? [5, 5] : undefined}
          />
        );
      })}

      {/* Native default pins - stable, full shape, no blinking */}
      <Marker
        coordinate={{ latitude: startPoint.lat, longitude: startPoint.lon }}
        title="🚗 Your Starting Point"
        description="You start here"
        pinColor="#4285F4"
      />
      <Marker
        coordinate={{ latitude: candidate.coordinates.lat, longitude: candidate.coordinates.lon }}
        title={`🤝 ${candidate.name || 'Drop/Pick Location'}`}
        description="Pick/drop passenger here"
        pinColor="#E91E63"
      />
      <Marker
        coordinate={{ latitude: endPoint.lat, longitude: endPoint.lon }}
        title="🎯 Your Destination"
        description="Your final destination"
        pinColor="#34A853"
      />
      <Marker
        coordinate={{ latitude: passengerHome.lat, longitude: passengerHome.lon }}
        title="🚶 Passenger start/end of trip"
        description="Where passenger starts or ends trip"
        pinColor="#FF9800"
      />
    </MapView>
  );
}
