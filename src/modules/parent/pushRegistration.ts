import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { parentApi } from "./api/parentApi";

export type PushState = "on" | "denied" | "unsupported" | "not_configured" | "error";

/**
 * Ask for permission, get this phone's Expo push token and tell the server
 * which session it belongs to. Signing out revokes the session, and with it
 * the token, so a handed-down phone stops getting the family's alerts.
 *
 * Web and simulators have no push; the inbox and SMS still reach the family.
 * The notifications library is loaded only on a phone — on the web it only
 * prints warnings into every staff member's console.
 */
export async function registerForPush(): Promise<PushState> {
  last = await attempt();
  listeners.forEach((l) => l());
  return last;
}

// the latest result, so the Account tab shows what the sign-in attempt found
let last: PushState | null = null;
const listeners = new Set<() => void>();
export function usePushState(): PushState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => last,
  );
}

async function attempt(): Promise<PushState> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const [Device, Notifications] = await Promise.all([import("expo-device"), import("expo-notifications")]);
    if (!Device.isDevice) return "unsupported";
    // alerts show while the app is open too; a parent glancing at the app still hears it
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === "android") {
      // the server sends with channelId "attendance"; no `sound` means the phone's
      // own alert sound (a name here must be a file bundled with the app)
      await Notifications.setNotificationChannelAsync("attendance", {
        name: "Attendance alerts",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return "not_configured";
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await parentApi.setPushToken(token);
    return "on";
  } catch (e) {
    // an Android build without google-services.json cannot get a token at all; say so, not "check the internet"
    return /FirebaseApp|google-services|FCM|Firebase/i.test(String((e as Error)?.message)) ? "not_configured" : "error";
  }
}
