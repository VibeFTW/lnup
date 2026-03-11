import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn("Push notifications require a physical device");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LNUP",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.warn("registerForPushNotifications error:", e);
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: session.user.id,
        token,
        platform: Platform.OS,
      },
      { onConflict: "user_id,token" }
    );
    if (error) console.warn("savePushToken error:", error.message);
  } catch (e) {
    console.warn("savePushToken failed:", e);
  }
}

export async function removePushToken(token: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", session.user.id)
      .eq("token", token);
  } catch (e) {
    console.warn("removePushToken failed:", e);
  }
}

export async function scheduleEventReminder(
  eventId: string,
  title: string,
  venueName: string,
  eventDate: string,
  timeStart: string
): Promise<string | null> {
  try {
    if (!eventDate || !timeStart) return null;

    const [year, month, day] = eventDate.split("-").map(Number);
    const [hours, minutes] = timeStart.split(":").map(Number);

    if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) return null;

    const eventTime = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(eventTime.getTime())) return null;

    const reminderTime = new Date(eventTime.getTime() - 60 * 60 * 1000);
    if (reminderTime <= new Date()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${title} startet in 1 Stunde`,
        body: `Um ${timeStart} Uhr @ ${venueName || "Unbekannt"}`,
        data: { eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });

    return id;
  } catch (e) {
    console.warn("scheduleEventReminder error:", e);
    return null;
  }
}

export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.warn("cancelScheduledNotification error:", e);
  }
}
