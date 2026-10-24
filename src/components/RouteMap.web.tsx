import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RouteMapProps } from './RouteMap';
import { decodePolyline } from '../utils/polylineDecoder';
import { CONFIG } from '../constants/config';

declare global {
  interface Window {
    google?: any;
  }
}

let mapsScriptPromise: Promise<any> | null = null;

/**
 * Load the Google Maps JavaScript API once per page
 */
function loadGoogleMaps(apiKey: string): Promise<any> {
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (!mapsScriptPromise) {
    mapsScriptPromise = new Promise((resolve, reject) => {
      const callbackName = '__onGoogleMapsLoaded';
      (window as any)[callbackName] = () => resolve(window.google);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => {
        mapsScriptPromise = null;
        reject(new Error('Failed to load Google Maps'));
      };
      document.head.appendChild(script);
    });
  }
  return mapsScriptPromise;
}

/**
 * Web route map (Google Maps JavaScript API), mirrors the native RouteMap.
 */
export function RouteMap({
  visualization,
  candidate,
  startPoint,
  endPoint,
  passengerHome,
  style,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const overlays: any[] = [];

    loadGoogleMaps(CONFIG.GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
        });

        // Fit map to route bounds
        const { northeast, southwest } = visualization.bounds;
        map.fitBounds(
          new google.maps.LatLngBounds(
            { lat: southwest.lat, lng: southwest.lon },
            { lat: northeast.lat, lng: northeast.lon },
          ),
          40,
        );

        // Render polylines for each route segment (walking segment dashed)
        for (const segment of visualization.segments) {
          const path = decodePolyline(segment.polyline).map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
          }));
          const isWalking = segment.label.includes('Walking');
          overlays.push(
            new google.maps.Polyline({
              map,
              path,
              strokeColor: segment.color,
              strokeWeight: CONFIG.POLYLINE_WIDTH,
              strokeOpacity: isWalking ? 0 : 1,
              icons: isWalking
                ? [
                    {
                      icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: CONFIG.POLYLINE_WIDTH },
                      offset: '0',
                      repeat: '15px',
                    },
                  ]
                : undefined,
            }),
          );
        }

        const markers = [
          { coord: startPoint, title: '🚗 Your Starting Point', color: '#4285F4' },
          {
            coord: candidate.coordinates,
            title: `🤝 ${candidate.name || 'Drop/Pick Location'}`,
            color: '#E91E63',
          },
          { coord: endPoint, title: '🎯 Your Destination', color: '#34A853' },
          { coord: passengerHome, title: '🚶 Passenger start/end of trip', color: '#FF9800' },
        ];

        for (const m of markers) {
          overlays.push(
            new google.maps.Marker({
              map,
              position: { lat: m.coord.lat, lng: m.coord.lon },
              title: m.title,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: m.color,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
            }),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      overlays.forEach((o) => o.setMap(null));
    };
  }, [visualization, candidate, startPoint, endPoint, passengerHome]);

  return (
    <View style={style}>
      {loadError ? (
        <Text style={styles.error}>{loadError}</Text>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: 'red',
    textAlign: 'center',
    margin: 20,
  },
});
