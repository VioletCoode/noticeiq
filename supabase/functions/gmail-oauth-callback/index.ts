// ==========================================================
// Supabase Edge Function: gmail-oauth-callback
// Purpose: Exchanges Google OAuth authorization code for
//          access_token & refresh_token and stores in gmail_tokens
// ==========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!googleClientId || !googleClientSecret) {
      console.error("[gmail-oauth-callback] ❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in Supabase secrets");
      return new Response(
        JSON.stringify({ error: "Google OAuth credentials not configured on server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate caller
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
    const { code, redirectUri, stateUserId } = body;

    if (!userId && stateUserId) {
      userId = stateUserId;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Active user session required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing code or redirectUri in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[gmail-oauth-callback] 🔄 Exchanging OAuth code for user ${userId} (redirectUri: ${redirectUri})`);

    // 2. Exchange code at Google token endpoint
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(`[gmail-oauth-callback] ❌ Google token exchange failed:`, tokenData);
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error || "Google token exchange failed", details: tokenData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // 3. Preserve existing refresh_token if Google did not issue a new one on re-auth
    const { data: existingRow } = await supabase
      .from("gmail_tokens")
      .select("refresh_token, processed_message_ids")
      .eq("user_id", userId)
      .maybeSingle();

    const finalRefreshToken = refresh_token || existingRow?.refresh_token;

    if (!finalRefreshToken) {
      console.warn(`[gmail-oauth-callback] ⚠️ No refresh_token returned by Google and none found in DB for user ${userId}`);
    }

    const upsertPayload: Record<string, any> = {
      user_id: userId,
      access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    if (finalRefreshToken) {
      upsertPayload.refresh_token = finalRefreshToken;
    }

    // Preserve existing processed_message_ids or initialize to empty array
    if (!existingRow) {
      upsertPayload.processed_message_ids = [];
    }

    const { error: upsertErr } = await supabase
      .from("gmail_tokens")
      .upsert(upsertPayload, { onConflict: "user_id" });

    if (upsertErr) {
      console.error(`[gmail-oauth-callback] ❌ Database upsert error:`, upsertErr);
      return new Response(
        JSON.stringify({ error: "Failed to store tokens in database", details: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[gmail-oauth-callback] ✅ Successfully stored tokens for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Gmail account connected successfully!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[gmail-oauth-callback] 💥 Unexpected handler error:`, err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
