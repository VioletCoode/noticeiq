// ==========================================================
// Supabase Edge Function: check-reminders
// Purpose: Scheduled job that checks due reminders and sends push notifications via OneSignal
// ==========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "";
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query pending reminders that are due now or overdue
    const nowIso = new Date().toISOString();
    const { data: dueReminders, error: queryError } = await supabase
      .from("reminders")
      .select(`
        id,
        task_id,
        fire_time,
        notification_type,
        tasks (
          id,
          title,
          deadline,
          user_id
        )
      `)
      .eq("sent", false)
      .lte("fire_time", nowIso);

    if (queryError) {
      console.error("Error fetching due reminders:", queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders due at this time.", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    const processedIds: string[] = [];

    for (const reminder of dueReminders) {
      const task = (reminder as any).tasks;
      if (!task || !task.user_id) {
        processedIds.push(reminder.id);
        continue;
      }

      // Fetch user profile for OneSignal ID if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("onesignal_id")
        .eq("user_id", task.user_id)
        .maybeSingle();

      const taskTitle = task.title || "College Deadline Alert";
      const taskDeadline = task.deadline
        ? new Date(task.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "soon";

      if (oneSignalAppId && oneSignalRestKey) {
        try {
          const payload: any = {
            app_id: oneSignalAppId,
            target_channel: "push",
            headings: { en: "NoticeIQ Deadline Alert" },
            contents: { en: `Upcoming: "${taskTitle}" is due ${taskDeadline}!` },
            data: { taskId: task.id }
          };

          // Target by external_id (Supabase user_id) or specific subscription ID
          if (profile?.onesignal_id) {
            payload.include_subscription_ids = [profile.onesignal_id];
          } else {
            payload.include_aliases = { external_id: [task.user_id] };
          }

          const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${oneSignalRestKey}`
            },
            body: JSON.stringify(payload)
          });

          if (osRes.ok) {
            sentCount++;
          } else {
            const osError = await osRes.text();
            console.warn("OneSignal API response error:", osError);
          }
        } catch (osErr) {
          console.warn("OneSignal notification failed:", osErr);
        }
      }

      processedIds.push(reminder.id);
    }

    // Mark processed reminders as sent
    if (processedIds.length > 0) {
      await supabase
        .from("reminders")
        .update({ sent: true })
        .in("id", processedIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersFound: dueReminders.length,
        pushNotificationsDispatched: sentCount,
        markedSent: processedIds.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
