import { saveOneSignalPlayerId } from './supabase';

const ONESIGNAL_SCRIPT_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const STORAGE_ONESIGNAL_APP_ID_KEY = 'noticeiq_onesignal_app_id';

let oneSignalInitialized = false;
let oneSignalInitPromise = null;
let activeUserId = null;

/**
 * Resolves OneSignal App ID from Vite env or localStorage override
 */
export function getOneSignalAppId() {
  const envAppId = (import.meta.env?.VITE_ONESIGNAL_APP_ID || '').trim();
  let localAppId = '';
  if (typeof window !== 'undefined') {
    try {
      localAppId = (localStorage.getItem(STORAGE_ONESIGNAL_APP_ID_KEY) || '').trim();
    } catch {
      // ignore
    }
  }
  const resolved = localAppId || envAppId;
  return resolved;
}

/**
 * Saves OneSignal App ID to localStorage for instant UI configuration
 */
export function setOneSignalAppId(appId) {
  if (typeof window === 'undefined') return;
  try {
    if (appId && appId.trim()) {
      localStorage.setItem(STORAGE_ONESIGNAL_APP_ID_KEY, appId.trim());
    } else {
      localStorage.removeItem(STORAGE_ONESIGNAL_APP_ID_KEY);
    }
  } catch (e) {
    console.warn('[OneSignal] Could not save App ID to localStorage:', e);
  }
}

/**
 * Polling helper to wait for OneSignal.User.PushSubscription.id to populate
 */
async function waitForSubscriptionId(maxWaitMs = 10000, intervalMs = 500) {
  const startTime = Date.now();
  console.log('[OneSignal] Awaiting PushSubscription ID from OneSignal servers (timeout: ' + maxWaitMs + 'ms)...');

  while (Date.now() - startTime < maxWaitMs) {
    const subId = window.OneSignal?.User?.PushSubscription?.id;
    const optedIn = window.OneSignal?.User?.PushSubscription?.optedIn;
    if (subId) {
      console.log(`[OneSignal] ✅ PushSubscription ID received (${Date.now() - startTime}ms):`, subId);
      return subId;
    }
    if (optedIn === false) {
      console.log('[OneSignal] PushSubscription optedIn is false, skipping wait.');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const finalSubId = window.OneSignal?.User?.PushSubscription?.id || null;
  console.log('[OneSignal] PushSubscription ID wait ended. Final ID:', finalSubId);
  return finalSubId;
}

/**
 * Helper to sync the current OneSignal PushSubscription ID with the user profile in Supabase
 */
export async function syncSubscriptionWithProfile(userId) {
  if (!userId) {
    console.log('[OneSignal] syncSubscriptionWithProfile skipped: No userId provided');
    return null;
  }

  console.log('[OneSignal] 🔄 Syncing PushSubscription with Supabase profiles table for userId:', userId);
  const subId = await waitForSubscriptionId(8000, 500);

  if (subId) {
    console.log('[OneSignal] 💾 Saving subscription ID to profiles.onesignal_id:', { userId, subId });
    try {
      const saved = await saveOneSignalPlayerId(userId, subId);
      if (saved) {
        console.log('[OneSignal] ✅ Successfully verified & saved profiles.onesignal_id in Supabase!');
      } else {
        console.warn('[OneSignal] ⚠️ Supabase saveOneSignalPlayerId returned false');
      }
      return subId;
    } catch (saveErr) {
      console.error('[OneSignal] ❌ Error saving subscription ID to Supabase:', saveErr);
      return subId;
    }
  } else {
    console.warn('[OneSignal] ⚠️ No subscription ID acquired yet. Device may not be opted in or subscription creation is still pending.');
    return null;
  }
}

/**
 * Initializes OneSignal SDK v16 with full logging and error diagnostics
 */
export async function initOneSignal(userId = null) {
  if (typeof window === 'undefined') return false;

  if (userId) activeUserId = userId;

  const envAppId = (import.meta.env?.VITE_ONESIGNAL_APP_ID || '').trim();
  const appId = envAppId || getOneSignalAppId();

  // Log masked value (first 8 chars) to console to confirm VITE_ONESIGNAL_APP_ID is loaded
  const maskedAppId = envAppId ? `${envAppId.slice(0, 8)}...` : '❌ NOT CONFIGURED';
  console.log('[OneSignal] ----------------------------------------------------');
  console.log('[OneSignal] 🔔 initOneSignal called.');
  console.log(`[OneSignal] VITE_ONESIGNAL_APP_ID: ${maskedAppId}`);
  console.log('[OneSignal] User ID:', userId || 'None (anonymous / pre-login)');

  if (!appId) {
    console.warn('[OneSignal] ⚠️ Cannot initialize OneSignal: VITE_ONESIGNAL_APP_ID is missing.');
    console.warn('[OneSignal] Please set VITE_ONESIGNAL_APP_ID in your .env file, or configure it via the Settings modal.');
    console.log('[OneSignal] ----------------------------------------------------');
    return false;
  }

  // If already initializing, return active promise
  if (oneSignalInitPromise) {
    console.log('[OneSignal] Initialization already in progress, awaiting existing promise...');
    const ok = await oneSignalInitPromise;
    if (userId && window.OneSignal) {
      try {
        console.log('[OneSignal] Linking userId to initialized instance:', userId);
        await window.OneSignal.login(userId);
        await syncSubscriptionWithProfile(userId);
      } catch (e) {
        console.warn('[OneSignal] Error during post-init login:', e);
      }
    }
    return ok;
  }

  if (oneSignalInitialized) {
    console.log('[OneSignal] SDK already initialized previously.');
    if (userId && window.OneSignal) {
      try {
        console.log('[OneSignal] Calling OneSignal.login for userId:', userId);
        await window.OneSignal.login(userId);
        await syncSubscriptionWithProfile(userId);
      } catch (loginErr) {
        console.warn('[OneSignal] OneSignal login error:', loginErr);
      }
    }
    console.log('[OneSignal] ----------------------------------------------------');
    return true;
  }

  // Ensure SDK script tag exists in document head
  if (!document.querySelector(`script[src="${ONESIGNAL_SCRIPT_URL}"]`)) {
    console.log('[OneSignal] Injecting OneSignal v16 SDK script into document head...');
    const script = document.createElement('script');
    script.src = ONESIGNAL_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  oneSignalInitPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        window.OneSignal = OneSignal;
        console.log('[OneSignal] ⚙️ Executing OneSignal.init() with configuration:', {
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: 'sw.js'
        });

        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID || appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: 'sw.js'
        });

        oneSignalInitialized = true;
        console.log('[OneSignal] ✅ OneSignal.init() completed successfully!');

        // Inspect current subscription state
        const currentOptedIn = OneSignal.User?.PushSubscription?.optedIn;
        const currentSubId = OneSignal.User?.PushSubscription?.id;
        console.log('[OneSignal] Current PushSubscription state:', {
          optedIn: currentOptedIn,
          subscriptionId: currentSubId,
          notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
        });

        // Set up subscription change listener
        try {
          OneSignal.User?.PushSubscription?.addEventListener('change', async (event) => {
            console.log('[OneSignal] 🔔 PushSubscription "change" event triggered:', {
              previous: event?.previous,
              current: event?.current
            });

            const newSubId = event?.current?.id;
            const targetUser = activeUserId || userId;
            if (newSubId && targetUser) {
              console.log('[OneSignal] 💾 Detected new subscription ID via change listener. Updating Supabase profile...', { targetUser, newSubId });
              await saveOneSignalPlayerId(targetUser, newSubId);
            }
          });
          console.log('[OneSignal] Subscribed to PushSubscription "change" event listener.');
        } catch (listenerErr) {
          console.warn('[OneSignal] Failed to attach subscription change listener:', listenerErr);
        }

        // If user is already logged in, associate user & sync subscription
        const targetUser = activeUserId || userId;
        if (targetUser) {
          console.log('[OneSignal] Logging in user to OneSignal:', targetUser);
          await OneSignal.login(targetUser);
          await syncSubscriptionWithProfile(targetUser);
        }

        console.log('[OneSignal] ----------------------------------------------------');
        resolve(true);
      } catch (err) {
        console.error('[OneSignal] ❌ OneSignal.init() failed with error:', err);
        console.log('[OneSignal] ----------------------------------------------------');
        resolve(false);
      }
    });
  });

  return oneSignalInitPromise;
}

/**
 * Helper to retrieve OneSignal instance once ready
 */
export function getOneSignalInstance() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.OneSignal && window.OneSignal.Notifications) {
      return resolve(window.OneSignal);
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal) => {
      window.OneSignal = OneSignal;
      resolve(OneSignal);
    });
  });
}

/**
 * Request notification permission and explicitly register the subscription with OneSignal & Supabase
 */
export async function requestNotificationPermissionAndRegister(userId = null) {
  console.log('[OneSignal] ====================================================');
  console.log('[OneSignal] 🚀 Starting Notification Permission & Subscription Registration Flow');
  console.log('[OneSignal] Target User ID:', userId || 'None (anonymous)');

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.error('[OneSignal] ❌ Notifications are not supported in this browser environment.');
    alert('This browser does not support push notifications.');
    return { granted: false, reason: 'unsupported' };
  }

  const appId = (import.meta.env?.VITE_ONESIGNAL_APP_ID || getOneSignalAppId() || '').trim();
  if (!appId) {
    const errorMsg = 'OneSignal App ID is not configured! Please enter your OneSignal App ID in Settings or add VITE_ONESIGNAL_APP_ID to your .env file.';
    console.error('[OneSignal] ❌ ' + errorMsg);
    alert(errorMsg);
    return { granted: false, reason: 'missing_app_id', message: errorMsg };
  }

  // 1. Ensure OneSignal is initialized
  console.log('[OneSignal] Step 1: Ensuring OneSignal is initialized...');
  const initSuccess = await initOneSignal(userId);
  if (!initSuccess) {
    console.error('[OneSignal] ❌ OneSignal initialization failed. Aborting registration.');
    return { granted: false, reason: 'init_failed' };
  }

  const OneSignal = await getOneSignalInstance();

  // 2. Check current browser permission & request if needed
  console.log('[OneSignal] Step 2: Checking current Notification.permission:', Notification.permission);
  let permission = Notification.permission;

  if (permission !== 'granted') {
    try {
      console.log('[OneSignal] Requesting browser notification permission...');
      if (OneSignal?.Notifications?.requestPermission) {
        console.log('[OneSignal] Using OneSignal.Notifications.requestPermission()...');
        await OneSignal.Notifications.requestPermission();
      } else {
        console.log('[OneSignal] Using standard Notification.requestPermission()...');
        await Notification.requestPermission();
      }
      permission = Notification.permission;
      console.log('[OneSignal] Notification permission after prompt:', permission);
    } catch (permErr) {
      console.error('[OneSignal] ❌ Error requesting notification permission:', permErr);
    }
  }

  if (permission !== 'granted') {
    console.warn('[OneSignal] ⚠️ User did not grant notification permission. Current status:', permission);
    return { granted: false, reason: permission };
  }

  console.log('[OneSignal] ✅ Notification permission granted!');

  // 3. Register device subscription using OneSignal.User.PushSubscription.optIn()
  console.log('[OneSignal] Step 3: Invoking OneSignal.User.PushSubscription.optIn()...');
  try {
    if (OneSignal?.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
      console.log('[OneSignal] ✅ OneSignal.User.PushSubscription.optIn() completed.');
    } else {
      console.warn('[OneSignal] ⚠️ OneSignal.User.PushSubscription.optIn is not available');
    }

    // 4. Associate user external ID
    if (userId && OneSignal?.login) {
      console.log('[OneSignal] Step 4: Calling OneSignal.login(userId):', userId);
      await OneSignal.login(userId);
    }

    // 5. Retrieve Subscription ID & persist to Supabase profiles.onesignal_id
    console.log('[OneSignal] Step 5: Waiting for subscription ID and persisting to profiles.onesignal_id...');
    const subscriptionId = await syncSubscriptionWithProfile(userId);

    const finalSubId = subscriptionId || OneSignal?.User?.PushSubscription?.id;
    const finalOptedIn = OneSignal?.User?.PushSubscription?.optedIn;

    if (!finalSubId && !finalOptedIn) {
      const errorMsg = 'Notification permission is granted, but push subscription could not be registered with OneSignal (timed out). Please check network connection, service worker status, or disable ad blockers.';
      console.error('[OneSignal] ❌ ' + errorMsg);
      alert(errorMsg);
      console.log('[OneSignal] ====================================================');
      return {
        granted: true,
        subscriptionId: null,
        optedIn: false,
        error: errorMsg
      };
    }

    console.log('[OneSignal] ====================================================');
    return {
      granted: true,
      subscriptionId: finalSubId,
      optedIn: finalOptedIn ?? true
    };
  } catch (err) {
    console.error('[OneSignal] ❌ Error during OneSignal registration flow:', err);
    alert(`Push notification registration error: ${err.message || err}`);
    console.log('[OneSignal] ====================================================');
    return { granted: true, error: err.message || String(err) };
  }
}

/**
 * Manual UI trigger for testing OneSignal permission and subscription flow
 */
export async function promptPushSubscription(userId = null) {
  console.log('[OneSignal] 🔔 Manual "Enable Notifications" button triggered.');
  return await requestNotificationPermissionAndRegister(userId);
}

/**
 * Checks whether the current device is actively subscribed to push notifications
 */
export function isPushSubscribed() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const optedIn = window.OneSignal?.User?.PushSubscription?.optedIn;
  const subId = window.OneSignal?.User?.PushSubscription?.id;
  return Boolean(optedIn && subId);
}
