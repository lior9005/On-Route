import { Platform, Share } from "react-native";
import { showAlert } from "./alert";

/**
 * Open the share sheet with a text message.
 * Web: use the Web Share API when available, otherwise copy to clipboard.
 */
export async function shareText(message: string, title: string, copiedNote: string): Promise<void> {
  try {
    if (Platform.OS === "web" && !(navigator as any).share) {
      await navigator.clipboard.writeText(message);
      showAlert("Copied", copiedNote);
      return;
    }

    await Share.share({ message, title });
  } catch (err) {
    console.error("Error sharing:", err);
  }
}
