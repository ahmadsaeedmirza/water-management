/**
 * Shifaf Aab Push Notifications Server Actions
 *
 * NOTE ON AUTO-CLEANUP CRON:
 * To enable automatic cleanup of notifications older than 48 hours, run this SQL in Supabase editor:
 *
 * create extension if not exists pg_cron;
 * select cron.schedule(
 *   'delete-old-notifications',
 *   '0 * * * *',
 *   $$
 *     delete from notifications
 *     where created_at < now() - interval '48 hours';
 *   $$
 * );
 */

import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import webpush from "web-push";

export const sendPushNotification = createServerFn({ method: "POST" })
  .validator((d: { userId: string; payload: { title: string; body: string; url?: string } }) => d)
  .handler(async ({ data: { userId, payload } }) => {
    try {
      const vapidPublic =
        process.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY || import.meta.env.VAPID_PRIVATE_KEY;

      if (!vapidPublic || !vapidPrivate) {
        console.warn("VAPID keys not configured on server");
        return { success: false, error: "VAPID keys not configured" };
      }

      webpush.setVapidDetails("mailto:admin@shifafaab.com", vapidPublic, vapidPrivate);

      // Fetch subscription from profiles table
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("push_subscription")
        .eq("id", userId)
        .single();

      if (error || !profile?.push_subscription) {
        console.log(`No push subscription found for user ${userId}`);
        return { success: false, error: "No subscription" };
      }

      const subscription = profile.push_subscription as any;
      await webpush.sendNotification(subscription, JSON.stringify(payload));

      console.log(`Push notification sent successfully to user ${userId}`);
      return { success: true };
    } catch (err: any) {
      console.error("Error sending push notification:", err);
      return { success: false, error: err.message };
    }
  });

export const notifyAdminsPush = createServerFn({ method: "POST" })
  .validator((d: { title: string; body: string; url?: string }) => d)
  .handler(async ({ data: payload }) => {
    try {
      // Fetch all admin users
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (!adminRoles || adminRoles.length === 0) return { success: true };

      const vapidPublic =
        process.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY || import.meta.env.VAPID_PRIVATE_KEY;

      if (!vapidPublic || !vapidPrivate) return { success: false, error: "No VAPID keys" };

      webpush.setVapidDetails("mailto:admin@shifafaab.com", vapidPublic, vapidPrivate);

      // Send to each admin in parallel
      await Promise.all(
        adminRoles.map(async (ar) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("push_subscription")
            .eq("id", ar.user_id)
            .single();

          if (profile?.push_subscription) {
            try {
              await webpush.sendNotification(
                profile.push_subscription as any,
                JSON.stringify(payload),
              );
            } catch (e) {
              console.warn("Failed sending notification to admin", ar.user_id, e);
            }
          }
        }),
      );
      return { success: true };
    } catch (err: any) {
      console.error("Error broadcasting to admins:", err);
      return { success: false, error: err.message };
    }
  });
