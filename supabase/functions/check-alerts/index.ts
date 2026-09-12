// ==============================================================================
// Supabase Edge Function: check-alerts
// Purpose: Scheduled job checking tasks & reminders due for push notification
//          alerts within the next 5 minutes across 6 offset types:
//          - 36 hours before
//          - 24 hours before
//          - 3 hours before
//          - 2 hours before
//          - 1 hour before
//          - Exactly at deadline (0 minutes before)
//
// Critical Rules:
// 1. Checks task.status at send-time: if completed, skips push completely & marks sent=true.
// 2. Dispatches notifications via OneSignal REST API with correct Key/Basic auth.
// 3. Prevents duplicates by marking sent=true upon processing.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Format contextual reminder heading & message according to the offset interval
 */
function getReminderMessage(
  taskTitle: string,
  deadlineStr: string,
  fireTimeIso: string,
  deadlineIso?: string
): { heading: string; content: string; offsetCategory: string } {
  if (!deadlineIso) {
    return {
      heading: `Reminder: ${taskTitle}`,
      content: `Reminder: "${taskTitle}" is due ${deadlineStr}. Don't forget to complete it!`,
      offsetCategory: "general",
    };
  }

  const deadlineMs = new Date(deadlineIso).getTime();
  const fireMs = new Date(fireTimeIso).getTime();
  const diffHours = Math.round((deadlineMs - fireMs) / (60 * 60 * 1000));
  const diffMinutes = Math.round((deadlineMs - fireMs) / (60 * 1000));

  if (diffMinutes <= 15) {
    return {
      heading: `🚨 Deadline Alert: ${taskTitle}`,
      content: `"${taskTitle}" deadline is NOW (${deadlineStr})! Please submit or complete it.`,
      offsetCategory: "0m",
    };
  } else if (diffHours === 1 || (diffMinutes >= 45 && diffMinutes <= 75)) {
    return {
      heading: `⏳ 1-Hour Reminder: ${taskTitle}`,
      content: `"${taskTitle}" is due in 1 hour (${deadlineStr}). Finalize your work!`,
      offsetCategory: "1h",
    };
  } else if (diffHours === 2 || (diffMinutes >= 105 && diffMinutes <= 135)) {
    return {
      heading: `⏰ 2-Hour Reminder: ${taskTitle}`,
      content: `"${taskTitle}" is due in 2 hours (${deadlineStr}). Getting close!`,
      offsetCategory: "2h",
    };
  } else if (diffHours === 3 || (diffMinutes >= 165 && diffMinutes <= 195)) {
    return {
      heading: `⏰ 3-Hour Reminder: ${taskTitle}`,
      content: `"${taskTitle}" is due in 3 hours (${deadlineStr}). Don't lose track of time!`,
      offsetCategory: "3h",
    };
  } else if (diffHours >= 20 && diffHours <= 28) {
    return {
      heading: `📅 24-Hour Reminder: ${taskTitle}`,
      content: `"${taskTitle}" is due tomorrow at ${deadlineStr}. Prepare ahead!`,
      offsetCategory: "24h",
    };
  } else if (diffHours >= 32 && diffHours <= 40) {
    return {
      heading: `📅 36-Hour Reminder: ${taskTitle}`,
      content: `"${taskTitle}" is due in 36 hours (${deadlineStr}). Get an early start!`,
      offsetCategory: "36h",
    };
  } else {
    return {
      heading: `Reminder: ${taskTitle}`,
      content: `Reminder: "${taskTitle}" is due in approx ${diffHours}h (${deadlineStr}).`,
      offsetCategory: `${diffHours}h`,
    };
  }
}

/**
 * Format timestamp into the user's localized time (e.g. "Sep 11, 9:35 PM" instead of UTC 04:05 PM)
 */
function formatTaskDeadlineInTimezone(deadlineIso: string, timeZone: string = "Asia/Kolkata"): string {
  try {
    const d = new Date(deadlineIso);
    if (isNaN(d.getTime())) return String(deadlineIso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timeZone || "Asia/Kolkata",
    });
  } catch {
    return String(deadlineIso);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[check-alerts] 🚀 Function invoked at:", new Date().toISOString());

  try {
    let reqBody: any = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        if (text) {
          reqBody = JSON.parse(text);
        }
      } catch {
        // Non-JSON or empty body
      }
    }

    // 1. Validate required environment variables and server secrets
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const supabaseServiceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const oneSignalAppId = (Deno.env.get("ONESIGNAL_APP_ID") || "").trim();
    const oneSignalRestApiKey = (Deno.env.get("ONESIGNAL_REST_API_KEY") || "").trim();

    // Determine correct Authorization header format for OneSignal
    // For os_v2_app_... or os_v2_org_... keys: OneSignal requires "Key <API_KEY>"
    // For legacy UUID keys: OneSignal used "Basic <API_KEY>"
    let authHeader = oneSignalRestApiKey;
    if (!authHeader.startsWith("Basic ") && !authHeader.startsWith("Key ")) {
      authHeader = oneSignalRestApiKey.startsWith("os_v2_")
        ? `Key ${oneSignalRestApiKey}`
        : `Basic ${oneSignalRestApiKey}`;
    }

    const secretDebugInfo = {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceRoleKey,
      oneSignalAppId: oneSignalAppId ? `${oneSignalAppId.slice(0, 8)}...${oneSignalAppId.slice(-4)}` : "missing",
      rawOneSignalAppId: oneSignalAppId,
      keyPrefix: oneSignalRestApiKey.slice(0, 12),
      keyLength: oneSignalRestApiKey.length,
      authHeaderPrefix: authHeader.slice(0, 16),
    };

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Supabase server configuration missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
          secretDebug: secretDebugInfo,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!oneSignalAppId || !oneSignalRestApiKey) {
      return new Response(
        JSON.stringify({
          error: "OneSignal credentials missing. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in Supabase secrets.",
          secretDebug: secretDebugInfo,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Supabase Service Role client (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    if (reqBody.getProfile === true) {
      const { data: profs } = await supabase.from("profiles").select("*").limit(5);
      return new Response(
        JSON.stringify({ success: true, profiles: profs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reqBody.verifyStudent) {
      const studentQuery = String(reqBody.verifyStudent).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentQuery);

      let pQuery = supabase
        .from("profiles")
        .select("id, user_id, name, department, student_id, photo_url, github_url, linkedin_url, portfolio_url, leetcode_url, kaggle_url, created_at");

      if (isUuid) {
        pQuery = pQuery.or(`user_id.eq.${studentQuery},id.eq.${studentQuery}`);
      } else {
        pQuery = pQuery.eq("student_id", studentQuery);
      }

      const { data: prof, error: pErr } = await pQuery.maybeSingle();

      return new Response(
        JSON.stringify({ success: true, profile: prof || null, error: pErr?.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    // Automated test scenario handler for verification
    let testReport: any = null;
    if (reqBody.testScenario === true) {
      console.log("[check-alerts] 🧪 Running test scenario for 10m deadline...");
      const { data: sampleProfile } = await supabase.from("profiles").select("user_id").limit(1).maybeSingle();
      const userId = sampleProfile?.user_id || "d7e4228b-4452-4542-a962-af16a1e95e01";
      const deadline10m = new Date(now.getTime() + 10 * 60 * 1000);

      // Create Active task
      const { data: activeTask } = await supabase.from("tasks").insert({
        user_id: userId,
        title: "Test Active Task (10m deadline)",
        deadline: deadline10m.toISOString(),
        status: "pending",
      }).select().single();

      // Create Completed task
      const { data: completedTask } = await supabase.from("tasks").insert({
        user_id: userId,
        title: "Test Completed Task (10m deadline)",
        deadline: deadline10m.toISOString(),
        status: "completed",
      }).select().single();

      // The 6 offsets required:
      const offsets = [
        { label: "36h", ms: 36 * 3600000 },
        { label: "24h", ms: 24 * 3600000 },
        { label: "3h", ms: 3 * 3600000 },
        { label: "2h", ms: 2 * 3600000 },
        { label: "1h", ms: 1 * 3600000 },
        { label: "0m", ms: 0 },
      ];

      const minFutureTime = now.getTime() - 60000;
      const keptOffsets = offsets.filter(o => (deadline10m.getTime() - o.ms) > minFutureTime);

      const activeReminders = keptOffsets.map(o => ({
        task_id: activeTask.id,
        fire_time: new Date(deadline10m.getTime() - o.ms).toISOString(),
        sent: false,
        notification_type: "push",
      }));

      const completedReminders = keptOffsets.map(o => ({
        task_id: completedTask.id,
        fire_time: new Date(deadline10m.getTime() - o.ms).toISOString(),
        sent: false,
        notification_type: "push",
      }));

      const { data: insActive } = await supabase.from("reminders").insert(activeReminders).select();
      const { data: insCompleted } = await supabase.from("reminders").insert(completedReminders).select();

      testReport = {
        activeTaskId: activeTask.id,
        completedTaskId: completedTask.id,
        deadline: deadline10m.toISOString(),
        totalOffsetsEvaluated: offsets.length,
        offsetsKept: keptOffsets.map(o => o.label),
        offsetsSkippedBecausePast: offsets.filter(o => (deadline10m.getTime() - o.ms) <= minFutureTime).map(o => o.label),
        activeRemindersInserted: insActive?.length || 0,
        completedRemindersInserted: insCompleted?.length || 0,
      };
    }

    // Look ahead window (default 5 minutes, or 15 minutes when running testScenario or requested)
    const lookaheadMinutes = reqBody.testScenario ? 15 : (typeof reqBody.lookaheadMinutes === "number" ? reqBody.lookaheadMinutes : 5);
    const windowEnd = new Date(now.getTime() + lookaheadMinutes * 60 * 1000);

    // 3. Query pending reminders that are due: fire_time <= windowEnd and sent = false
    const { data: dueReminders, error: remQueryError } = await supabase
      .from("reminders")
      .select(`
        id,
        task_id,
        fire_time,
        sent,
        tasks (
          id,
          title,
          deadline,
          status,
          user_id
        )
      `)
      .eq("sent", false)
      .lte("fire_time", windowEnd.toISOString())
      .order("fire_time", { ascending: true });

    if (remQueryError) {
      console.error("[check-alerts] ❌ Reminders query error:", remQueryError);
      return new Response(
        JSON.stringify({ error: remQueryError.message, secretDebug: secretDebugInfo }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Also query legacy tasks table with alert_time set directly: alert_time <= windowEnd and notified = false
    const { data: dueTasks, error: taskQueryError } = await supabase
      .from("tasks")
      .select("id, title, deadline, alert_time, notified, status, user_id")
      .eq("notified", false)
      .not("alert_time", "is", null)
      .lte("alert_time", windowEnd.toISOString());

    if (taskQueryError) {
      console.error("[check-alerts] ❌ Tasks query error:", taskQueryError);
    }

    const totalMatched = (dueReminders?.length || 0) + (dueTasks?.length || 0);

    if (totalMatched === 0) {
      console.log("[check-alerts] ℹ️ No reminders or tasks due within the next window.");
      return new Response(
        JSON.stringify({
          success: true,
          message: `No reminders due for alerts within the next ${lookaheadMinutes} minutes.`,
          matchedCount: 0,
          sentCount: 0,
          skippedCompletedCount: 0,
          testScenarioReport: testReport,
          secretDebug: secretDebugInfo,
          executionTimeMs: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-alerts] 📋 Processing ${dueReminders?.length || 0} reminder(s) and ${dueTasks?.length || 0} task alert(s).`);

    // Fetch user profile timezones to format messages in user's actual local time
    const { data: userProfiles } = await supabase
      .from("profiles")
      .select("user_id, timezone");
    const profileTimezoneMap = new Map((userProfiles || []).map((p: any) => [p.user_id, p.timezone]));

    let sentCount = 0;
    let skippedCompletedCount = 0;
    const sentReminders: Array<{ id: string; taskId: string; title: string; offset: string }> = [];
    const skippedCompleted: Array<{ id: string; taskId: string; title: string; reason: string }> = [];
    const errors: Array<{ id: string; taskId?: string; httpStatus?: number; error: string; rawResponse?: any }> = [];

    // 5. Process Reminders
    if (dueReminders && dueReminders.length > 0) {
      for (const reminder of dueReminders) {
        const task = (reminder as any).tasks;

        // If task was deleted or missing, delete the orphan reminder completely so it never fires
        if (!task || !task.id) {
          console.warn(`[check-alerts] ⚠️ Reminder ${reminder.id} references missing/deleted task. Deleting orphan reminder.`);
          await supabase.from("reminders").delete().eq("id", reminder.id);
          continue;
        }

        // CONDITION 2: Check task status at send-time.
        // If task is already marked 'completed', skip sending reminder entirely!
        if (task.status === "completed") {
          console.log(`[check-alerts] ⏭️ Skipping reminder ${reminder.id}: Task "${task.title}" (${task.id}) is already COMPLETED.`);
          // Mark sent=true so it is resolved and won't fire repeatedly
          await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
          skippedCompletedCount++;
          skippedCompleted.push({
            id: reminder.id,
            taskId: task.id,
            title: task.title || "Untitled",
            reason: "Task is completed at send-time",
          });
          continue;
        }

        const userTimeZone = (task.user_id ? profileTimezoneMap.get(task.user_id) : null) || reqBody.timeZone || "Asia/Kolkata";
        const taskTitle = task.title || "Upcoming Task";
        let deadlineStr = "soon";
        if (task.deadline) {
          deadlineStr = formatTaskDeadlineInTimezone(task.deadline, userTimeZone);
        }

        const msg = getReminderMessage(taskTitle, deadlineStr, reminder.fire_time, task.deadline);

        const notificationBody: any = {
          app_id: oneSignalAppId,
          target_channel: "push",
          headings: { en: msg.heading },
          contents: { en: msg.content },
          data: {
            reminderId: reminder.id,
            taskId: task.id,
            deadline: task.deadline,
            offsetCategory: msg.offsetCategory,
            source: "check-alerts-edge-function",
          },
        };

        if (task.user_id) {
          notificationBody.include_aliases = { external_id: [task.user_id] };
        } else {
          notificationBody.included_segments = ["Subscribed Users"];
        }

        try {
          console.log(`[check-alerts] 📤 Sending OneSignal push [${msg.offsetCategory}] for task "${taskTitle}" (${task.id})...`);

          const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": authHeader,
            },
            body: JSON.stringify(notificationBody),
          });

          const osStatus = osResponse.status;
          const osStatusText = osResponse.statusText;
          let osResult: any = null;
          try {
            osResult = await osResponse.json();
          } catch {
            osResult = await osResponse.text();
          }

          if (osResponse.ok && (!osResult || !osResult.errors)) {
            console.log(`[check-alerts] ✅ OneSignal push sent for reminder ${reminder.id}.`);
            sentCount++;

            // Mark reminder as sent to avoid duplicate dispatches
            await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
            sentReminders.push({
              id: reminder.id,
              taskId: task.id,
              title: taskTitle,
              offset: msg.offsetCategory,
            });
          } else {
            const errMsg = osResult?.errors ? JSON.stringify(osResult.errors) : `HTTP ${osStatus} ${osStatusText}`;
            console.error(`[check-alerts] ❌ OneSignal API error for reminder ${reminder.id}:`, errMsg);
            errors.push({
              id: reminder.id,
              taskId: task.id,
              httpStatus: osStatus,
              error: errMsg,
              rawResponse: osResult,
            });
          }
        } catch (err: any) {
          console.error(`[check-alerts] ❌ Network error for reminder ${reminder.id}:`, err);
          errors.push({ id: reminder.id, taskId: task.id, error: err.message || "Unknown error" });
        }
      }
    }

    // 6. Process legacy Tasks with direct alert_time
    if (dueTasks && dueTasks.length > 0) {
      for (const task of dueTasks) {
        // CONDITION 2: Skip completed tasks
        if (task.status === "completed") {
          console.log(`[check-alerts] ⏭️ Skipping legacy alert for task "${task.title}" (${task.id}): COMPLETED.`);
          await supabase.from("tasks").update({ notified: true }).eq("id", task.id);
          skippedCompletedCount++;
          skippedCompleted.push({
            id: task.id,
            taskId: task.id,
            title: task.title || "Untitled",
            reason: "Task is completed at send-time",
          });
          continue;
        }

        const userTimeZone = (task.user_id ? profileTimezoneMap.get(task.user_id) : null) || reqBody.timeZone || "Asia/Kolkata";
        const taskTitle = task.title || "Upcoming Task";
        let deadlineStr = "soon";
        if (task.deadline) {
          deadlineStr = formatTaskDeadlineInTimezone(task.deadline, userTimeZone);
        }

        const notificationBody: any = {
          app_id: oneSignalAppId,
          target_channel: "push",
          headings: { en: `Reminder: ${taskTitle}` },
          contents: { en: `Reminder: "${taskTitle}" is due ${deadlineStr}. Don't forget to complete it!` },
          data: {
            taskId: task.id,
            deadline: task.deadline,
            source: "check-alerts-edge-function",
          },
        };

        if (task.user_id) {
          notificationBody.include_aliases = { external_id: [task.user_id] };
        } else {
          notificationBody.included_segments = ["Subscribed Users"];
        }

        try {
          const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": authHeader,
            },
            body: JSON.stringify(notificationBody),
          });

          const osStatus = osResponse.status;
          let osResult: any = null;
          try {
            osResult = await osResponse.json();
          } catch {
            osResult = await osResponse.text();
          }

          if (osResponse.ok && (!osResult || !osResult.errors)) {
            sentCount++;
            await supabase.from("tasks").update({ notified: true }).eq("id", task.id);
            sentReminders.push({
              id: task.id,
              taskId: task.id,
              title: taskTitle,
              offset: "legacy",
            });
          } else {
            const errMsg = osResult?.errors ? JSON.stringify(osResult.errors) : `HTTP ${osStatus}`;
            errors.push({
              id: task.id,
              taskId: task.id,
              httpStatus: osStatus,
              error: errMsg,
              rawResponse: osResult,
            });
          }
        } catch (err: any) {
          errors.push({ id: task.id, taskId: task.id, error: err.message || "Unknown error" });
        }
      }
    }

    // Optional cleanup of test tasks
    if (reqBody.cleanupAfterTest === true && testReport) {
      if (testReport.activeTaskId) {
        await supabase.from("tasks").delete().eq("id", testReport.activeTaskId);
      }
      if (testReport.completedTaskId) {
        await supabase.from("tasks").delete().eq("id", testReport.completedTaskId);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[check-alerts] 🏁 Completed in ${durationMs}ms. Sent: ${sentCount}, Skipped Completed: ${skippedCompletedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        matchedCount: totalMatched,
        sentCount,
        skippedCompletedCount,
        sentReminders,
        skippedCompleted,
        testScenarioReport: testReport,
        errors: errors.length > 0 ? errors : undefined,
        secretDebug: secretDebugInfo,
        executionTimeMs: durationMs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (globalErr: any) {
    console.error("[check-alerts] 💥 Unhandled fatal error:", globalErr);
    return new Response(
      JSON.stringify({
        error: globalErr.message || "Internal server error",
        stack: globalErr.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
