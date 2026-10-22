import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions, Share, Platform } from 'react-native';
import { CandidatePoint, Coordinates } from '../models';
import { RouteMap } from '../components/RouteMap';
import { meetingPointLabel } from '../components/CandidateList';
import { useRouteVisualization } from '../hooks/useRouteVisualization';
import { WazeService } from '../services/WazeService';
import { showAlert } from '../utils/alert';
import { secondsToMinutes, metersToKilometers } from '../utils/distance';

interface RoutePreviewScreenProps {
  candidate: CandidatePoint;
  startPoint: Coordinates;
  endPoint: Coordinates;
  passengerHome: Coordinates;
  onConfirm: () => void;
  onBack: () => void;
}

export function RoutePreviewScreen({
  candidate,
  startPoint,
  endPoint,
  passengerHome,
  onConfirm,
  onBack,
}: RoutePreviewScreenProps) {
  const { visualization, loading, error, fetchVisualization } = useRouteVisualization();
  const [showTransferInstructions, setShowTransferInstructions] = useState(false);
  
  // Animation values for the Waze screen
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    fetchVisualization(candidate, startPoint, endPoint, passengerHome);
  }, [candidate, startPoint, endPoint, passengerHome, fetchVisualization]);

  // Animate the Waze screen when it appears
  useEffect(() => {
    if (showTransferInstructions) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);

      // Fade in and scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Continuous rotation for navigation icon
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      pulse.start();
      rotate.start();

      return () => {
        pulse.stop();
        rotate.stop();
      };
    }
  }, [showTransferInstructions]);

  const handleOpenWaze = async () => {
    try {
      // First, try to open Waze
      await WazeService.openNavigation(candidate.coordinates);
      
      // If Waze opens successfully, save the journey state
      await onConfirm();
    } catch (err) {
      console.error('Error in handleOpenWaze:', err);
      // WazeService already shows error alerts for Waze-related issues
    }
  };

  const handleShareLocation = async () => {
    try {
      const locationUrl = `https://www.google.com/maps/search/?api=1&query=${candidate.coordinates.lat},${candidate.coordinates.lon}`;
      const message = `📍 Meeting Point: ${candidate.name || 'Drop/Pick Location'}\n\nLocation: ${locationUrl}`;
      
      // Web: use the Web Share API when available, otherwise copy to clipboard
      if (Platform.OS === 'web' && !(navigator as any).share) {
        await navigator.clipboard.writeText(message);
        showAlert('Copied', 'Meeting point link copied to clipboard');
        return;
      }

      await Share.share({
        message,
        title: 'Meeting Point Location',
      });
    } catch (err) {
      console.error('Error sharing location:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" style={styles.loader} />
        <Text>Loading route preview...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!visualization) {
    return null;
  }

  // Waze transfer instruction screen (after tapping Let's Go)
  if (showTransferInstructions) {
    const rotation = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={styles.wazeContainer}>
        {/* Animated background circles */}
        <Animated.View 
          style={[
            styles.backgroundCircle1,
            {
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]} 
        />
        <Animated.View 
          style={[
            styles.backgroundCircle2,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3],
              }),
              transform: [{ scale: pulseAnim.interpolate({
                inputRange: [1, 1.15],
                outputRange: [1, 1.1],
              }) }],
            },
          ]} 
        />

        <Animated.View 
          style={[
            styles.transferInstructions,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Navigation Icon with animation */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.navIconWrapper,
                {
                  transform: [
                    { scale: pulseAnim },
                    { rotate: rotation },
                  ],
                },
              ]}
            >
              <Text style={styles.navIcon}>🧭</Text>
            </Animated.View>
            <View style={styles.iconGlow} />
          </View>

          <Text style={styles.transferTitle}>Ready to Navigate!</Text>
          
          <View style={styles.messageCard}>
            <Text style={styles.transferBody}>
              🗺️ You'll be transferred to Waze for navigation to the drop/pick location.
            </Text>
            <Text style={styles.transferBody}>
              ✅ When you arrive, return to this app and tap "Navigate to Driver Destination" to continue.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.openWazeButton} 
            onPress={handleOpenWaze}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.buttonContent,
                {
                  transform: [{ scale: pulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [1, 0.98],
                  }) }],
                },
              ]}
            >
              <Text style={styles.wazeIcon}>🗺️</Text>
              <Text style={styles.openWazeButtonText}>Open Waze</Text>
            </Animated.View>
            <View style={styles.buttonShadow} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.transferBackButton} 
            onPress={() => setShowTransferInstructions(false)}
            activeOpacity={0.6}
          >
            <Text style={styles.transferBackButtonText}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RouteMap
        style={styles.map}
        visualization={visualization}
        candidate={candidate}
        startPoint={startPoint}
        endPoint={endPoint}
        passengerHome={passengerHome}
      />

      {/* Route Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Route Summary</Text>
          <TouchableOpacity 
            style={styles.shareButton} 
            onPress={handleShareLocation}
            activeOpacity={0.7}
          >
            <Text style={styles.shareButtonText}>📤 Share Meeting Point</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.dropoffName}>
          Drop/Pick Location: {meetingPointLabel(candidate)}
        </Text>
        
        <View style={styles.routeSegment}>
          <Text style={styles.segmentLabel}>🚗 Your Location → Drop/Pick Location</Text>
          <Text style={styles.segmentDetails}>
            {secondsToMinutes(candidate.leg1.duration)} min • {metersToKilometers(candidate.leg1.distance).toFixed(1)} km
          </Text>
        </View>
        
        <View style={styles.routeSegment}>
          <Text style={styles.segmentLabel}>🚗 Drop/Pick Location → Destination</Text>
          <Text style={styles.segmentDetails}>
            {secondsToMinutes(candidate.leg2.duration)} min • {metersToKilometers(candidate.leg2.distance).toFixed(1)} km
          </Text>
        </View>
        
        <View style={styles.routeSegment}>
          <Text style={styles.segmentLabel}>🚶 Passenger Walk</Text>
          <Text style={styles.segmentDetails}>
            {secondsToMinutes(candidate.passengerLeg.duration)} min • {metersToKilometers(candidate.passengerLeg.distance).toFixed(1)} km
          </Text>
        </View>
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Driving Time:</Text>
          <Text style={styles.totalValue}>{secondsToMinutes(candidate.totalDetour)} min</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.letsGoButton} onPress={() => setShowTransferInstructions(true)}>
          <Text style={styles.letsGoButtonText}>Let's Go!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    marginTop: 100,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    margin: 20,
  },
  map: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dropoffName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 12,
  },
  routeSegment: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  segmentDetails: {
    fontSize: 13,
    color: '#666',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#2196F3',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  backButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  letsGoButton: {
    flex: 2,
    padding: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  letsGoButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  button: {
    padding: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  wazeContainer: {
    flex: 1,
    backgroundColor: '#0A1929',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.5,
    height: Dimensions.get('window').width * 1.5,
    borderRadius: Dimensions.get('window').width * 0.75,
    backgroundColor: '#1E3A5F',
    top: -Dimensions.get('window').width * 0.4,
    left: -Dimensions.get('window').width * 0.25,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').width * 1.2,
    borderRadius: Dimensions.get('window').width * 0.6,
    backgroundColor: '#2E5984',
    top: Dimensions.get('window').height * 0.5,
    right: -Dimensions.get('window').width * 0.3,
  },
  transferInstructions: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  navIcon: {
    fontSize: 64,
  },
  iconGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2196F3',
    opacity: 0.1,
    zIndex: -1,
  },
  transferTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  messageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 40,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  transferBody: {
    fontSize: 17,
    color: '#2C3E50',
    lineHeight: 26,
    marginBottom: 18,
    textAlign: 'left',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  openWazeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonShadow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#1976D2',
    opacity: 0.3,
    top: 4,
    left: 0,
    zIndex: -1,
  },
  wazeIcon: {
    fontSize: 24,
  },
  openWazeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  transferBackButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  transferBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0BEC5',
  },
});
