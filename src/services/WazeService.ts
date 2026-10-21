import { Linking, Alert } from "react-native";
import { Coordinates } from "../models";

export class WazeService {
  /**
   * Open Waze navigation to destination
   */
  static async openNavigation(destination: Coordinates): Promise<void> {
    // Validate coordinates
    if (
      !destination ||
      typeof destination.lat !== "number" ||
      typeof destination.lon !== "number"
    ) {
      console.error("Invalid coordinates:", destination);
      Alert.alert("Error", "Invalid location coordinates");
      throw new Error("Invalid coordinates");
    }

    // Use Waze universal link format for better reliability with navigation
    // This format ensures Waze opens with the route already set
    const url = `https://www.waze.com/ul?ll=${destination.lat}%2C${destination.lon}&navigate=yes&z=10`;

    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Waze Not Installed",
          "Please install Waze to use navigation features.",
          [{ text: "OK" }],
        );
        // Don't throw error - just inform user
      }
    } catch (error) {
      console.error("Error opening Waze:", error);
      Alert.alert("Error", "Failed to open Waze navigation");
      throw error; // Re-throw so caller knows it failed
    }
  }
}
