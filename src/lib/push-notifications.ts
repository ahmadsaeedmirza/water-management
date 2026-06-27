import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function setupPushNotifications(userId: string) {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    console.log("Push notifications not supported on this device/browser");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker registered");

    // Request permissions
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Push notification permission denied");
      return;
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn("VITE_VAPID_PUBLIC_KEY is not defined in env variables");
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("User subscribed to push:", subscription);

    // Save to Supabase profile
    const { error } = await supabase
      .from("profiles")
      .update({ push_subscription: subscription.toJSON() as any })
      .eq("id", userId);

    if (error) {
      console.error("Failed to save push subscription to profile:", error);
    } else {
      console.log("Push subscription stored successfully");
    }
  } catch (error) {
    console.error("Error setting up push notifications:", error);
  }
}
