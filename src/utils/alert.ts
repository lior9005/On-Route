import { Alert, Platform } from "react-native";

/**
 * Show a simple message dialog.
 * react-native-web's Alert.alert is a no-op, so fall back to window.alert on web.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
