// ==============================================================================
// Supabase Edge Function: gmail-sync
// Purpose: Periodically checks user's Gmail (newer_than:1d), decodes circular
//          emails, runs Gemini notice extraction, creates tasks + reminders,
//          and dispatches OneSignal push alerts.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Reminder intervals matching src/services/supabase.js
const REMINDER_OFFSETS = [
  { label: "36h", minutes: 36 * 60 },
  { label: "24h", minutes: 24 * 60 },
  { label: "3h", minutes: 3 * 60 },
  { label: "2h", minutes: 2 * 60 },
  { label: "1h", minutes: 60 },
  { label: "0m", minutes: 0 },
];

/**
 * Base64URL decoder for Gmail API message payload bodies
 */
function decodeBase64Url(base64Url: string): string {
  try {
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (err) {
    console.warn("[gmail-sync] Base64 decoding warning:", err);
    return "";
  }
}

/**
 * Strips HTML tags, styles, scripts, and collapses whitespace
 */
function cleanHtmlText(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

/**
 * Recursively extracts plain text and/or HTML text from Gmail message payload parts
 */
function extractBodyFromPayload(payload: any): string {
  if (!payload) return "";

  // 1. Direct body data
  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      return cleanHtmlText(decoded);
    }
    return decoded;
  }

  // 2. Multipart payload
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain if present
    const plainPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (plainPart && plainPart.body && plainPart.body.data) {
      return decodeBase64Url(plainPart.body.data);
    }

    // Fallback to text/html
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return cleanHtmlText(decodeBase64Url(htmlPart.body.data));
    }

    // Recursive search in subparts
    let combined = "";
    for (const part of payload.parts) {
      const text = extractBodyFromPayload(part);
      if (text) combined += "\n" + text;
    }
    return combined.trim();
  }

  return "";
}

/**
 * Dispatches an instant OneSignal notification for newly parsed circular task
 */
async function sendNewNoticePushAlert(
  oneSignalAppId: string,
  oneSignalRestKey: string,
  onesignalId: string,
  taskTitle: string,
  deadlineStr: string
) {
  if (!oneSignalAppId || !oneSignalRestKey || !onesignalId) return;

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${oneSignalRestKey}`,
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        include_aliases: {
          onesignal_id: [onesignalId],
        },
        target_channel: "push",
        headings: { en: `📩 New College Notice: ${taskTitle}` },
        contents: { en: `Circular parsed from Gmail! Action required by ${deadlineStr}.` },
        url: "https://noticeiq-wheat.vercel.app/",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[gmail-sync] OneSignal push alert warning:", errText);
    } else {
      console.log(`[gmail-sync] 🔔 OneSignal push alert sent for "${taskTitle}"`);
    }
  } catch (pushErr) {
    console.warn("[gmail-sync] OneSignal notification failed:", pushErr);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || "";
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization Bearer token or request body
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && user) {
        userId = user.id;
      }
    }

    const body = await req.json().catch(() => ({}));
    if (!userId && body?.userId) {
      userId = body.userId;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Active user session required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch stored tokens from gmail_tokens
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("gmail_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenErr) {
      console.error(`[gmail-sync] Error querying gmail_tokens for user ${userId}:`, tokenErr);
      return new Response(
        JSON.stringify({ error: "Database error fetching gmail_tokens", details: tokenErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenRow || !tokenRow.refresh_token) {
      return new Response(
        JSON.stringify({ message: "Gmail not connected for this user.", isConnected: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenRow.access_token;
    const expiresAtMs = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
    const nowMs = Date.now();

    // 3. Token Refresh (if expired or expiring within 60s)
    if (!accessToken || expiresAtMs <= nowMs + 60000) {
      console.log(`[gmail-sync] 🔄 Access token expired or expiring soon for user ${userId}. Refreshing...`);

      if (!googleClientId || !googleClientSecret) {
        console.error("[gmail-sync] ❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in Supabase secrets for token refresh");
        return new Response(
          JSON.stringify({ error: "Google OAuth credentials not configured in Supabase secrets" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: tokenRow.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        // EXPLICIT ERROR LOGGING - NOT SWALLOWED
        console.error(`[gmail-sync] ❌ Token refresh failed for user ${userId}:`, refreshData);
        return new Response(
          JSON.stringify({
            error: "token_refresh_failed",
            message: "Google token refresh failed. User re-authentication required.",
            details: refreshData,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

      await supabase
        .from("gmail_tokens")
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log(`[gmail-sync] ✅ Access token successfully refreshed for user ${userId}`);
    }

    // 4. Query recent messages (newer_than:1d) from Gmail REST API
    console.log(`[gmail-sync] 📬 Fetching recent messages (newer_than:1d) for user ${userId}...`);
    const listUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:1d&maxResults=20";
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      if (listRes.status === 429 || listRes.status === 403) {
        // EXPLICIT RATE LIMIT HANDLING
        console.warn(`[gmail-sync] ⚠️ Gmail API rate limit / quota exceeded (HTTP ${listRes.status}) for user ${userId}`);
        return new Response(
          JSON.stringify({
            status: "rate_limited",
            message: "Gmail API rate limit reached. Safe retry on next sync cycle.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const listErr = await listRes.json().catch(() => ({}));
      console.error(`[gmail-sync] ❌ Gmail messages.list error (HTTP ${listRes.status}):`, listErr);
      return new Response(
        JSON.stringify({ error: "Failed to list Gmail messages", details: listErr }),
        { status: listRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listRes.json();
    const messages = Array.isArray(listData.messages) ? listData.messages : [];

    // 5. CRITICAL DUPLICATE GUARD: Check processed_message_ids BEFORE decoding & task creation
    let processedArray: string[] = [];
    if (Array.isArray(tokenRow.processed_message_ids)) {
      processedArray = tokenRow.processed_message_ids.map(String);
    } else if (typeof tokenRow.processed_message_ids === "string") {
      try {
        const parsed = JSON.parse(tokenRow.processed_message_ids);
        if (Array.isArray(parsed)) processedArray = parsed.map(String);
      } catch {}
    }

    const processedSet = new Set<string>(processedArray);

    const unhandledMessages = messages.filter((m: any) => m?.id && !processedSet.has(m.id));

    console.log(`[gmail-sync] Found ${messages.length} total messages in last 24h. ${unhandledMessages.length} unhandled.`);

    if (unhandledMessages.length === 0) {
      await supabase
        .from("gmail_tokens")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ message: "Sync complete. No new messages to process.", processed: 0, tasksCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's OneSignal ID for notifications if available
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("onesignal_id")
      .eq("user_id", userId)
      .maybeSingle();

    let tasksCreatedCount = 0;
    let processedCount = 0;

    // 6. Process each unhandled email inside its own try/catch to ensure batch resilience
    for (const msgRef of unhandledMessages) {
      const msgId = msgRef.id;

      // Double-check duplicate guard right before processing
      if (processedSet.has(msgId)) continue;

      try {
        console.log(`[gmail-sync] 📩 Fetching details for message ${msgId}...`);
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgRes.ok) {
          if (msgRes.status === 429 || msgRes.status === 403) {
            console.warn(`[gmail-sync] ⚠️ Rate limit encountered on message ${msgId}, halting batch cleanly.`);
            break;
          }
          console.warn(`[gmail-sync] Could not fetch message ${msgId}: HTTP ${msgRes.status}`);
          processedSet.add(msgId);
          continue;
        }

        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "College Circular";
        const sender = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "";
        const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === "date")?.value || "";

        const bodyContent = extractBodyFromPayload(msgData.payload);
        const snippet = msgData.snippet || "";
        const emailFullText = `Subject: ${subject}\nFrom: ${sender}\nDate: ${dateHeader}\n\n${bodyContent || snippet}`;

        // Filter out obviously non-circular automated emails
        if (
          sender.toLowerCase().includes("no-reply") &&
          !bodyContent.toLowerCase().includes("deadline") &&
          !bodyContent.toLowerCase().includes("due") &&
          !bodyContent.toLowerCase().includes("submit") &&
          !bodyContent.toLowerCase().includes("circular") &&
          !bodyContent.toLowerCase().includes("exam")
        ) {
          console.log(`[gmail-sync] Skipping non-academic notification email: "${subject}"`);
          processedSet.add(msgId);
          processedCount++;
          continue;
        }

        console.log(`[gmail-sync] 🧠 Calling extract-notice for email "${subject.slice(0, 40)}..."`);

        // 7. Invoke existing Gemini extraction logic via extract-notice Edge Function
        const { data: extractionResult, error: extractErr } = await supabase.functions.invoke(
          "extract-notice",
          {
            body: {
              noticeText: emailFullText,
              userTimezone: "Asia/Kolkata",
            },
          }
        );

        if (extractErr) {
          console.warn(`[gmail-sync] ⚠️ extract-notice error for message ${msgId}:`, extractErr);
        }

        const taskData = extractionResult?.data || extractionResult;

        // 8. If a deadline or actionable task is identified, create task & schedule reminders
        if (taskData && taskData.title && taskData.deadline) {
          console.log(`[gmail-sync] 🎯 Deadline found in email "${subject}": ${taskData.deadline}. Creating task...`);

          const taskTitle = taskData.title || subject || "Academic Action Item";
          const reqs = Array.isArray(taskData.requirements) ? taskData.requirements : [];

          // Create Task in Supabase tasks table
          const { data: newTask, error: taskInsertErr } = await supabase
            .from("tasks")
            .insert([
              {
                user_id: userId,
                title: taskTitle,
                deadline: taskData.deadline,
                audience: taskData.audience || "All Students",
                requirements: reqs,
                priority: taskData.priority || "medium",
                status: "pending",
                confidence: typeof taskData.confidence === "number" ? taskData.confidence : 0.95,
              },
            ])
            .select()
            .single();

          if (taskInsertErr) {
            console.error(`[gmail-sync] ❌ Error inserting task for message ${msgId}:`, taskInsertErr);
          } else if (newTask) {
            tasksCreatedCount++;

            // Create multi-offset reminders (reusing existing schedule offsets: 36h, 24h, 3h, 2h, 1h, 0m)
            const deadlineDate = new Date(newTask.deadline);
            if (!isNaN(deadlineDate.getTime())) {
              const minFutureTime = Date.now() - 60000;
              const remindersToInsert = REMINDER_OFFSETS
                .map((offset) => {
                  const fireTime = new Date(deadlineDate.getTime() - offset.minutes * 60 * 1000);
                  return {
                    task_id: newTask.id,
                    fire_time: fireTime.toISOString(),
                    sent: false,
                    notification_type: "push",
                  };
                })
                .filter((r) => new Date(r.fire_time).getTime() > minFutureTime);

              if (remindersToInsert.length > 0) {
                const { error: remErr } = await supabase.from("reminders").insert(remindersToInsert);
                if (remErr) {
                  console.warn("[gmail-sync] Could not insert multi-offset reminders:", remErr);
                } else {
                  console.log(`[gmail-sync] ⏰ Scheduled ${remindersToInsert.length} reminders for "${taskTitle}"`);
                }
              }
            }

            // Dispatch instant OneSignal Push Notification to student
            if (userProfile?.onesignal_id) {
              const formattedDate = new Date(newTask.deadline).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              await sendNewNoticePushAlert(
                oneSignalAppId,
                oneSignalRestKey,
                userProfile.onesignal_id,
                taskTitle,
                formattedDate
              );
            }
          }
        } else {
          console.log(`[gmail-sync] Email "${subject}" had no actionable deadline.`);
        }

        // Mark message as processed
        processedSet.add(msgId);
        processedCount++;
      } catch (emailErr) {
        console.error(`[gmail-sync] Error processing individual email ${msgId}:`, emailErr);
        // Mark as processed so it doesn't repeatedly fail the batch
        processedSet.add(msgId);
      }
    }

    // 9. Persist updated processed_message_ids & last_synced_at in gmail_tokens
    const updatedProcessedIds = Array.from(processedSet).slice(-200); // keep last 200 IDs
    await supabase
      .from("gmail_tokens")
      .update({
        processed_message_ids: updatedProcessedIds,
        last_synced_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    console.log(`[gmail-sync] 🏁 Sync completed for user ${userId}. Processed: ${processedCount}, Tasks Created: ${tasksCreatedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        tasksCreated: tasksCreatedCount,
        lastSyncedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[gmail-sync] 💥 Fatal sync handler error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error during gmail sync" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
