import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Modal, Dimensions, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DestinationInput } from './src/components/DestinationInput';
import { MaxWalkingSlider, MaxDetourSlider } from './src/components/MaxWalkingSlider';
import { SegmentedControl } from './src/components/SegmentedControl';
import { DepartureTimePicker } from './src/components/DepartureTimePicker';
import { CandidateList } from './src/components/CandidateList';
import { SearchingIndicator } from './src/components/SearchingIndicator';
import { RoutePreviewScreen } from './src/screens/RoutePreviewScreen';
import { useJourneyState } from './src/hooks/useJourneyState';
import { useOptimization } from './src/hooks/useOptimization';
import { Coordinates, CandidatePoint, TravelMode, TripDirection } from './src/models';
import { CONFIG } from './src/constants/config';
import { showAlert } from './src/utils/alert';

function HomeScreenCarLoop({ carAnim }: { carAnim: Animated.Value }) {
  useEffect(() => {
    const drive = Animated.loop(
      Animated.sequence([
        Animated.timing(carAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(carAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    drive.start();
    return () => {
      drive.stop();
    };
  }, [carAnim]);
  return null;
}

export default function App() {
  const [driverStart, setDriverStart] = useState<Coordinates | null>(null);
  const [driverDestination, setDriverDestination] = useState<Coordinates | null>(null);
  const [passengerHome, setPassengerHome] = useState<Coordinates | null>(null);
  const [driverStartText, setDriverStartText] = useState<string>('');
  const [driverDestinationText, setDriverDestinationText] = useState<string>('');
  const [passengerHomeText, setPassengerHomeText] = useState<string>('');
  const [maxWalkingDistance, setMaxWalkingDistance] = useState<number>(CONFIG.DEFAULT_WALKING_DISTANCE);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALK');
  const [tripDirection, setTripDirection] = useState<TripDirection>('DROP_OFF');
  const [maxDetourMinutes, setMaxDetourMinutes] = useState<number>(CONFIG.DEFAULT_MAX_DETOUR_MINUTES);
  const [departureTime, setDepartureTime] = useState<Date | null>(null); // null = leave now
  const [selectedCandidate, setSelectedCandidate] = useState<CandidatePoint | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const carAnim = useRef(new Animated.Value(0)).current;
  
  // Animation values for the Journey Progress screen
  const journeyPulseAnim = useRef(new Animated.Value(1)).current;
  const journeyRotateAnim = useRef(new Animated.Value(0)).current;
  const journeyFadeAnim = useRef(new Animated.Value(0)).current;
  const journeyScaleAnim = useRef(new Animated.Value(0.8)).current;
  const journeyCarAnim = useRef(new Animated.Value(0)).current;
  
  // Animation values for the Home screen
  const homePulseAnim = useRef(new Animated.Value(1)).current;
  const homeRotateAnim = useRef(new Animated.Value(0)).current;
  const homeFadeAnim = useRef(new Animated.Value(0)).current;
  const homeScaleAnim = useRef(new Animated.Value(0.8)).current;
  
  // Animation values for the Form screen
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formScaleAnim = useRef(new Animated.Value(0.9)).current;

  const { journey, saveJourney, advanceStage, clearJourney } = useJourneyState();
  const { candidates, loading, error, searchSummary, runOptimization, clearCandidates } = useOptimization();

  const handleFindDropoff = async () => {
    const startEmpty = !driverStartText.trim();
    const destEmpty = !driverDestinationText.trim();
    const passengerEmpty = !passengerHomeText.trim();
    if (startEmpty || destEmpty || passengerEmpty) {
      setShowValidationErrors(true);
      return;
    }
    if (!driverStart || !driverDestination || !passengerHome) {
      showAlert('Missing Information', 'Please enter all three locations');
      return;
    }
    if (departureTime && departureTime.getTime() <= Date.now()) {
      showAlert('Departure time passed', 'Pick a later time, or choose "Leave now".');
      return;
    }
    setShowValidationErrors(false);

    await runOptimization({
      start: driverStart,
      end: driverDestination,
      passengerHome,
      mode: travelMode,
      maxWalkingDistance,
      direction: tripDirection,
      maxDetourMinutes,
      departureTime,
    });
  };

  // Show modal when candidates are found
  useEffect(() => {
    if (candidates.length > 0 && !showPreview) {
      setShowCandidatesModal(true);
    }
  }, [candidates, showPreview]);

  const handleSelectCandidate = (candidate: CandidatePoint) => {
    setSelectedCandidate(candidate);
    setShowCandidatesModal(false);
    setShowPreview(true);
  };

  const handleConfirmNavigation = async () => {
    if (!selectedCandidate || !driverStart || !driverDestination || !passengerHome) {
      return;
    }

    // Save journey with the stage already set - no need to call advanceStage
    await saveJourney({
      startPoint: driverStart,
      endPoint: driverDestination,
      passengerHome,
      selectedDropoff: selectedCandidate,
      stage: 'EN_ROUTE_TO_DROPOFF',
      timestamp: Date.now(),
    });

    setShowPreview(false);
  };

  const handleNavigateToDestination = async () => {
    if (!journey?.endPoint) {
      return;
    }

    const { WazeService } = await import('./src/services/WazeService');
    await WazeService.openNavigation(journey.endPoint);
    
    // Clear journey and reset app state to go back to home screen
    await clearJourney();
    clearCandidates();
    setDriverStart(null);
    setDriverDestination(null);
    setPassengerHome(null);
    setDriverStartText('');
    setDriverDestinationText('');
    setPassengerHomeText('');
    setSelectedCandidate(null);
    setShowPreview(false);
    setShowCandidatesModal(false);
    setShowForm(false);
  };

  // Animate the Journey Progress screen when it appears
  useEffect(() => {
    if (journey?.stage === 'EN_ROUTE_TO_DROPOFF') {
      // Reset animations
      journeyFadeAnim.setValue(0);
      journeyScaleAnim.setValue(0.8);
      journeyPulseAnim.setValue(1);
      journeyRotateAnim.setValue(0);
      journeyCarAnim.setValue(0);

      // Fade in and scale up
      Animated.parallel([
        Animated.timing(journeyFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(journeyScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(journeyPulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(journeyPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Continuous rotation for car icon
      const rotate = Animated.loop(
        Animated.timing(journeyRotateAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      );

      // Car moving animation
      const carMove = Animated.loop(
        Animated.sequence([
          Animated.timing(journeyCarAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(journeyCarAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

      pulse.start();
      rotate.start();
      carMove.start();

      return () => {
        pulse.stop();
        rotate.stop();
        carMove.stop();
      };
    }
  }, [journey?.stage]);

  // Animate the Home screen when it appears
  useEffect(() => {
    if (!showForm && journey?.stage !== 'EN_ROUTE_TO_DROPOFF' && !showPreview) {
      // Reset animations
      homeFadeAnim.setValue(0);
      homeScaleAnim.setValue(0.8);
      homePulseAnim.setValue(1);
      homeRotateAnim.setValue(0);

      // Fade in and scale up
      Animated.parallel([
        Animated.timing(homeFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(homeScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(homePulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(homePulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Continuous rotation for icon
      const rotate = Animated.loop(
        Animated.timing(homeRotateAnim, {
          toValue: 1,
          duration: 5000,
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
  }, [showForm, journey?.stage, showPreview]);

  // Animate the Form screen when it appears
  useEffect(() => {
    if (showForm) {
      // Reset animations
      formFadeAnim.setValue(0);
      formScaleAnim.setValue(0.9);

      // Fade in and scale up
      Animated.parallel([
        Animated.timing(formFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(formScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showForm]);

  // Show "Navigate to Destination" button if journey in progress (CHECK THIS FIRST)
  if (journey?.stage === 'EN_ROUTE_TO_DROPOFF') {
    const rotation = journeyRotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
    
    const carTranslateX = journeyCarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [Dimensions.get('window').width + 60, -60],
    });

    return (
      <View style={styles.journeyContainer}>
        {/* Animated background circles */}
        <Animated.View 
          style={[
            styles.journeyBackgroundCircle1,
            {
              opacity: journeyFadeAnim,
              transform: [{ scale: journeyPulseAnim }],
            },
          ]} 
        />
        <Animated.View 
          style={[
            styles.journeyBackgroundCircle2,
            {
              opacity: journeyFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3],
              }),
              transform: [{ scale: journeyPulseAnim.interpolate({
                inputRange: [1, 1.15],
                outputRange: [1, 1.1],
              }) }],
            },
          ]} 
        />

        {/* Animated road line */}
        <View style={styles.journeyRoadContainer}>
          <View style={styles.journeyRoadLine} />
          <Animated.View
            style={[
              styles.journeyCarWrapper,
              {
                transform: [{ translateX: carTranslateX }],
              },
            ]}
          >
            <Text style={styles.journeyCarEmoji}>🚗</Text>
          </Animated.View>
        </View>

        <Animated.View 
          style={[
            styles.journeyContent,
            {
              opacity: journeyFadeAnim,
              transform: [{ scale: journeyScaleAnim }],
            },
          ]}
        >
          {/* Status Icon with animation */}
          <View style={styles.journeyIconContainer}>
            <Animated.View
              style={[
                styles.journeyIconWrapper,
                {
                  transform: [
                    { scale: journeyPulseAnim },
                    { rotate: rotation },
                  ],
                },
              ]}
            >
              <Text style={styles.journeyIcon}>🚦</Text>
            </Animated.View>
            <View style={styles.journeyIconGlow} />
          </View>

          <Text style={styles.journeyTitle}>Journey in Progress</Text>
          
          <View style={styles.journeyMessageCard}>
            <Text style={styles.journeyBody}>
              🗺️ You're en route to the drop/pick location.
            </Text>
            <Text style={styles.journeyBody}>
              ✅ When you arrive, press the button below to navigate to your final destination.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.journeyNavButton} 
            onPress={handleNavigateToDestination}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.journeyButtonContent,
                {
                  transform: [{ scale: journeyPulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [1, 0.98],
                  }) }],
                },
              ]}
            >
              <Text style={styles.journeyButtonIcon}>🎯</Text>
              <Text style={styles.journeyNavButtonText}>Navigate to Driver Destination</Text>
            </Animated.View>
            <View style={styles.journeyButtonShadow} />
          </TouchableOpacity>
        </Animated.View>
        <StatusBar style="auto" />
      </View>
    );
  }

  // Show route preview screen
  if (showPreview && selectedCandidate && driverStart && driverDestination && passengerHome) {
    return (
      <>
        <RoutePreviewScreen
          candidate={selectedCandidate}
          startPoint={driverStart}
          endPoint={driverDestination}
          passengerHome={passengerHome}
          onConfirm={handleConfirmNavigation}
          onBack={() => {
            setShowPreview(false);
            setShowForm(true); // Ensure form shows when going back
          }}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  // Home screen: app name + car animation + button to go to form
  if (!showForm) {
    const screenWidth = Dimensions.get('window').width;
    const carDrive = carAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [screenWidth + 60, -60],
    });
    
    const homeRotation = homeRotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={styles.homeContainer}>
        {/* Animated background circles */}
        <Animated.View 
          style={[
            styles.homeBackgroundCircle1,
            {
              opacity: homeFadeAnim,
              transform: [{ scale: homePulseAnim }],
            },
          ]} 
        />
        <Animated.View 
          style={[
            styles.homeBackgroundCircle2,
            {
              opacity: homeFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3],
              }),
              transform: [{ scale: homePulseAnim.interpolate({
                inputRange: [1, 1.15],
                outputRange: [1, 1.1],
              }) }],
            },
          ]} 
        />

        {/* Animated road line */}
        <View style={styles.homeRoadContainer}>
          <View style={styles.homeRoadLine} />
          <Animated.View
            style={[
              styles.homeCarWrapper,
              {
                transform: [
                  { translateX: carDrive },
                ],
              },
            ]}
          >
            <Text style={styles.homeCarEmoji}>🚗</Text>
          </Animated.View>
        </View>

        <Animated.View 
          style={[
            styles.homeScreen,
            {
              opacity: homeFadeAnim,
              transform: [{ scale: homeScaleAnim }],
            },
          ]}
        >
          {/* App Icon with animation */}
          <View style={styles.homeIconContainer}>
            <Animated.View
              style={[
                styles.homeIconWrapper,
                {
                  transform: [
                    { scale: homePulseAnim },
                    { rotate: homeRotation },
                  ],
                },
              ]}
            >
              <Text style={styles.homeIcon}>🚀</Text>
            </Animated.View>
            <View style={styles.homeIconGlow} />
          </View>

          <Text style={styles.homeScreenTitle}>On the Way</Text>
          
          <View style={styles.homeMessageCard}>
            <Text style={styles.homeBody}>
              🎯 Find the perfect drop/pick location for your journey
            </Text>
            <Text style={styles.homeBody}>
              ✨ Optimize your route and save time
            </Text>
          </View>

          <TouchableOpacity
            style={styles.homeScreenButton}
            onPress={() => {
              clearCandidates();
              setShowForm(true);
            }}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.homeButtonContent,
                {
                  transform: [{ scale: homePulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [1, 0.98],
                  }) }],
                },
              ]}
            >
              <Text style={styles.homeButtonIcon}>📍</Text>
              <Text style={styles.homeScreenButtonText} numberOfLines={1}>Find Drop/Pick Location</Text>
            </Animated.View>
            <View style={styles.homeButtonShadow} />
          </TouchableOpacity>
        </Animated.View>
        <StatusBar style="auto" />
        <HomeScreenCarLoop carAnim={carAnim} />
      </View>
    );
  }

  return (
    <View style={styles.formScreenContainer}>
      {/* Animated background circles */}
      <Animated.View 
        style={[
          styles.formBackgroundCircle1,
          {
            opacity: formFadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4],
            }),
          },
        ]} 
      />
      <Animated.View 
        style={[
          styles.formBackgroundCircle2,
          {
            opacity: formFadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2],
            }),
          },
        ]} 
      />

      <SafeAreaView style={styles.formSafeArea}>
        <Animated.View 
          style={[
            styles.formContent,
            {
              opacity: formFadeAnim,
              transform: [{ scale: formScaleAnim }],
            },
          ]}
        >
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Plan Your Journey</Text>
            <Text style={styles.formSubtitle}>Enter your locations to find the best route</Text>
          </View>

          <View style={styles.formCard}>
            <DestinationInput
              driverStartText={driverStartText}
              driverDestinationText={driverDestinationText}
              passengerHomeText={passengerHomeText}
              invalidDriverStart={showValidationErrors && !driverStartText.trim()}
              invalidDriverDestination={showValidationErrors && !driverDestinationText.trim()}
              invalidPassengerHome={showValidationErrors && !passengerHomeText.trim()}
              onDriverStartChange={(coord, text) => {
                setDriverStart(coord);
                if (text !== undefined) setDriverStartText(text);
              }}
              onDriverDestinationChange={(coord, text) => {
                setDriverDestination(coord);
                if (text !== undefined) setDriverDestinationText(text);
              }}
              onPassengerHomeChange={(coord, text) => {
                setPassengerHome(coord);
                if (text !== undefined) setPassengerHomeText(text);
              }}
              onDriverStartTextChange={setDriverStartText}
              onDriverDestinationTextChange={setDriverDestinationText}
              onPassengerHomeTextChange={setPassengerHomeText}
            />

          <DepartureTimePicker
            value={departureTime}
            onChange={(value) => {
              setDepartureTime(value);
              clearCandidates();
            }}
          />

          <SegmentedControl<TravelMode>
            options={[
              { value: 'WALK', label: '🚶 Walk' },
              { value: 'BUS', label: '🚌 Bus' },
            ]}
            value={travelMode}
            onChange={(mode) => {
              setTravelMode(mode);
              clearCandidates();
            }}
          />

          {travelMode === 'BUS' && (
            <SegmentedControl<TripDirection>
              options={[
                { value: 'DROP_OFF', label: 'Drop-off' },
                { value: 'PICK_UP', label: 'Pick-up' },
              ]}
              value={tripDirection}
              onChange={(direction) => {
                setTripDirection(direction);
                clearCandidates();
              }}
            />
          )}

          {travelMode === 'WALK' ? (
            <MaxWalkingSlider
              value={maxWalkingDistance}
              onValueChange={(value) => setMaxWalkingDistance(value)}
            />
          ) : (
            <MaxDetourSlider
              value={maxDetourMinutes}
              onValueChange={(value) => setMaxDetourMinutes(value)}
            />
          )}

            <TouchableOpacity
              style={[styles.formButton, loading && styles.formButtonDisabled]}
              onPress={handleFindDropoff}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <SearchingIndicator mode={travelMode} />
              ) : (
                <View style={styles.formButtonContent}>
                  <Text style={styles.formButtonIcon}>🔍</Text>
                  <Text style={styles.formButtonText} numberOfLines={1}>Find Drop/Pick Location</Text>
                </View>
              )}
              <View style={styles.formButtonShadow} />
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>

      <StatusBar style="auto" />

      {/* Candidates Modal */}
      <Modal
        visible={showCandidatesModal && candidates.length > 0}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCandidatesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCandidatesModal(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Select Drop/Pick Location</Text>
                <Text style={styles.modalSubtitle}>{candidates.length} options found</Text>
                {searchSummary && (
                  <Text style={styles.searchSummary}>{searchSummary}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCandidatesModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <CandidateList
                candidates={candidates}
                selectedId={selectedCandidate?.id}
                onSelect={handleSelectCandidate}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    paddingTop: 48,
  },
  formScreenContainer: {
    flex: 1,
    backgroundColor: '#0A1929',
    position: 'relative',
    overflow: 'hidden',
  },
  formBackgroundCircle1: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.5,
    height: Dimensions.get('window').width * 1.5,
    borderRadius: Dimensions.get('window').width * 0.75,
    backgroundColor: '#1E3A5F',
    top: -Dimensions.get('window').width * 0.3,
    right: -Dimensions.get('window').width * 0.25,
  },
  formBackgroundCircle2: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').width * 1.2,
    borderRadius: Dimensions.get('window').width * 0.6,
    backgroundColor: '#2E5984',
    bottom: -Dimensions.get('window').width * 0.2,
    left: -Dimensions.get('window').width * 0.3,
  },
  formSafeArea: {
    flex: 1,
  },
  formContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 80,
    marginTop: 0,
  },
  formHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#B0BEC5',
    textAlign: 'center',
    marginBottom: 8,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 20,
  },
  formButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  formButtonDisabled: {
    backgroundColor: '#1976D2', // Searching: darker, keeps the animation readable
  },
  formButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  formButtonShadow: {
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
  formButtonIcon: {
    fontSize: 20,
  },
  formButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    height: Dimensions.get('window').height * 0.75,
    maxHeight: '75%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
    flexDirection: 'column',
  },
  modalHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchSummary: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    minHeight: 300,
  },
  homeContainer: {
    flex: 1,
    backgroundColor: '#0A1929',
    position: 'relative',
    overflow: 'hidden',
  },
  homeBackgroundCircle1: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.5,
    height: Dimensions.get('window').width * 1.5,
    borderRadius: Dimensions.get('window').width * 0.75,
    backgroundColor: '#1E3A5F',
    top: -Dimensions.get('window').width * 0.4,
    left: -Dimensions.get('window').width * 0.25,
  },
  homeBackgroundCircle2: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').width * 1.2,
    borderRadius: Dimensions.get('window').width * 0.6,
    backgroundColor: '#2E5984',
    top: Dimensions.get('window').height * 0.5,
    right: -Dimensions.get('window').width * 0.3,
  },
  homeRoadContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 60,
    overflow: 'hidden',
  },
  homeRoadLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  homeCarWrapper: {
    position: 'absolute',
    top: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeCarEmoji: {
    fontSize: 44,
  },
  homeScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 120,
    zIndex: 1,
  },
  homeIconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  homeIcon: {
    fontSize: 64,
  },
  homeIconGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2196F3',
    opacity: 0.1,
    zIndex: -1,
  },
  homeScreenTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  homeMessageCard: {
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
  homeBody: {
    fontSize: 17,
    color: '#2C3E50',
    lineHeight: 26,
    marginBottom: 14,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  homeScreenButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  homeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  homeButtonShadow: {
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
  homeButtonIcon: {
    fontSize: 24,
  },
  homeScreenButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    paddingTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    padding: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  navButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  journeyContainer: {
    flex: 1,
    backgroundColor: '#0A1929',
    position: 'relative',
    overflow: 'hidden',
  },
  journeyBackgroundCircle1: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.5,
    height: Dimensions.get('window').width * 1.5,
    borderRadius: Dimensions.get('window').width * 0.75,
    backgroundColor: '#1E5F3A',
    top: -Dimensions.get('window').width * 0.4,
    left: -Dimensions.get('window').width * 0.25,
  },
  journeyBackgroundCircle2: {
    position: 'absolute',
    width: Dimensions.get('window').width * 1.2,
    height: Dimensions.get('window').width * 1.2,
    borderRadius: Dimensions.get('window').width * 0.6,
    backgroundColor: '#2E8459',
    top: Dimensions.get('window').height * 0.5,
    right: -Dimensions.get('window').width * 0.3,
  },
  journeyRoadContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 60,
    overflow: 'hidden',
  },
  journeyRoadLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  journeyCarWrapper: {
    position: 'absolute',
    top: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyCarEmoji: {
    fontSize: 44,
  },
  journeyContent: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 200,
    alignItems: 'center',
    zIndex: 1,
  },
  journeyIconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  journeyIcon: {
    fontSize: 64,
  },
  journeyIconGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4CAF50',
    opacity: 0.1,
    zIndex: -1,
  },
  journeyTitle: {
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
  journeyMessageCard: {
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
  journeyBody: {
    fontSize: 17,
    color: '#2C3E50',
    lineHeight: 26,
    marginBottom: 18,
    textAlign: 'left',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  journeyNavButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  journeyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  journeyButtonShadow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#388E3C',
    opacity: 0.3,
    top: 4,
    left: 0,
    zIndex: -1,
  },
  journeyButtonIcon: {
    fontSize: 24,
  },
  journeyNavButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    padding: 16,
    textAlign: 'center',
  },
});
