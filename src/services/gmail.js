import { supabase } from './supabase';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * Initiates the Google OAuth consent flow for Gmail reading.
 * @param {string} userId - Current Supabase user ID passed in state for security.
 */
export function initiateGmailOAuth(userId) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured in your environment.');
  }

  const redirectUri = `${window.location.origin}/auth/callback/gmail`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: userId || ''
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  window.location.href = authUrl;
}

/**
 * Handles the OAuth code exchange via the Supabase Edge Function.
 * @param {string} code - Authorization code returned by Google.
 * @param {string} redirectUri - Exact redirect URI used during authorization.
 */
export async function exchangeGmailOAuthCode(code, redirectUri) {
  try {
    const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
      body: { code, redirectUri }
    });

    if (error) {
      console.error('[GmailService] Error exchanging OAuth code:', error);
      return { success: false, error: error.message || 'Failed to exchange code' };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[GmailService] Exception exchanging OAuth code:', err);
    return { success: false, error: err.message || 'Unknown error during token exchange' };
  }
}

/**
 * Fetches Gmail connection status for the current user.
 * @param {string} userId
 */
export async function getGmailConnectionStatus(userId) {
  if (!userId) return { isConnected: false, lastSyncedAt: null };

  try {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('user_id, last_synced_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[GmailService] Error fetching gmail_tokens:', error);
      return { isConnected: false, lastSyncedAt: null, error };
    }

    return {
      isConnected: Boolean(data?.user_id),
      lastSyncedAt: data?.last_synced_at || null
    };
  } catch (err) {
    console.error('[GmailService] Exception fetching status:', err);
    return { isConnected: false, lastSyncedAt: null, error: err };
  }
}

/**
 * Triggers Gmail sync edge function for the user.
 * @param {string} userId
 */
export async function syncGmail(userId) {
  if (!userId) return { success: false, error: 'User ID is required' };

  try {
    const { data, error } = await supabase.functions.invoke('gmail-sync', {
      body: { userId }
    });

    if (error) {
      console.error('[GmailService] Error invoking gmail-sync:', error);
      return { success: false, error: error.message || 'Sync failed' };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[GmailService] Exception during sync:', err);
    return { success: false, error: err.message || 'Unknown sync error' };
  }
}

/**
 * Disconnects Gmail by deleting the user's tokens.
 * @param {string} userId
 */
export async function disconnectGmail(userId) {
  if (!userId) return { success: false, error: 'User ID is required' };

  try {
    const { error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[GmailService] Error deleting gmail_tokens:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[GmailService] Exception during disconnect:', err);
    return { success: false, error: err.message };
  }
}
