import { Linking } from "react-native";
import { Coordinates } from "../models";
import { showAlert } from "../utils/alert";

export class WazeService {
  /**
   * Waze universal link that opens navigation to the destination
   */
  static navigationUrl(destination: Coordinates): string {
    return `https://www.waze.com/ul?ll=${destination.lat}%2C${destination.lon}&navigate=yes&z=10`;
  }

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
      showAlert("Error", "Invalid location coordinates");
      throw new Error("Invalid coordinates");
    }

    // Use Waze universal link format for better reliability with navigation
    // This format ensures Waze opens with the route already set
    const url = WazeService.navigationUrl(destination);

    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        showAlert(
          "Waze Not Installed",
          "Please install Waze to use navigation features.",
        );
        // Don't throw error - just inform user
      }
    } catch (error) {
      console.error("Error opening Waze:", error);
      showAlert("Error", "Failed to open Waze navigation");
      throw error; // Re-throw so caller knows it failed
    }
  }
}
