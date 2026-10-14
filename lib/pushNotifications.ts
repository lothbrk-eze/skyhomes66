/**
 * Push notifications have been disabled for this build.
 * The app now uses the backend-only notification list instead.
 */

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function savePushTokenToBackend(_userId: string, _token: string): Promise<boolean> {
  return false;
}

export function setupNotificationListeners() {
  return () => undefined;
}

export async function sendTestNotification(
  _title: string,
  _message: string,
  _pushToken: string
): Promise<boolean> {
  return false;
}
