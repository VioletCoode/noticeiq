import { createClient } from '@supabase/supabase-js';
import { parseDeadlineToISO } from '../utils/dateUtils';

const STORAGE_SUPABASE_URL_KEY = 'noticeiq_supabase_url';
const STORAGE_SUPABASE_ANON_KEY = 'noticeiq_supabase_anon_key';

/**
 * Resolves Supabase credentials from environment or localStorage override
 */
export function getSupabaseCredentials() {
  const envUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();

  let localUrl = '';
  let localKey = '';

  try {
    localUrl = (localStorage.getItem(STORAGE_SUPABASE_URL_KEY) || '').trim();
    localKey = (localStorage.getItem(STORAGE_SUPABASE_ANON_KEY) || '').trim();
  } catch {
    // ignore
  }

  const url = localUrl || envUrl;
  const anonKey = localKey || envKey;

  const isValidUrl = Boolean(url && url.startsWith('http') && !url.includes('your-project-ref'));
  const isValidKey = Boolean(anonKey && anonKey.length > 20 && !anonKey.includes('...'));

  return {
    url,
    anonKey,
    isConfigured: isValidUrl && isValidKey
  };
}

export function saveSupabaseCredentials(url, anonKey) {
  try {
    if (url) localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim());
    else localStorage.removeItem(STORAGE_SUPABASE_URL_KEY);

    if (anonKey) localStorage.setItem(STORAGE_SUPABASE_ANON_KEY, anonKey.trim());
    else localStorage.removeItem(STORAGE_SUPABASE_ANON_KEY);
  } catch {
    // ignore
  }
}

// Instantiate singleton client
const { url: initialUrl, anonKey: initialKey, isConfigured } = getSupabaseCredentials();

const dummyUrl = 'https://placeholder.supabase.co';
const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase = createClient(
  isConfigured ? initialUrl : dummyUrl,
  isConfigured ? initialKey : dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export function isSupabaseConfigured() {
  return getSupabaseCredentials().isConfigured;
}

// ==========================================================
// AUTHENTICATION HELPERS (Email & Password Only)
// ==========================================================

export async function signUpUser({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || 'Student'
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function signInUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPasswordForEmail(email, redirectTo) {
  const redirectUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}` : undefined);
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });
  if (error) throw error;
  return data;
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ==========================================================
// PROFILES DATA LAYER (New Schema)
// ==========================================================

export async function fetchProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[NoticeIQ Supabase] Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function upsertProfile(userId, profileData) {
  if (!userId) return null;

  const payload = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...profileData
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[NoticeIQ Supabase] Error upserting profile:', error);
    throw error;
  }

  return data;
}

/**
 * Uploads student photo to Supabase Storage (no base64 in DB) and updates profile
 */
export async function uploadProfilePhoto(userId, file) {
  if (!userId || !file) throw new Error('User and file are required');

  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

  // 1. Upload to Supabase Storage bucket 'campus_vault'
  const { error: uploadError } = await supabase.storage
    .from('campus_vault')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (uploadError) {
    console.error('[NoticeIQ Supabase] Error uploading avatar to storage:', uploadError);
    throw uploadError;
  }

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('campus_vault')
    .getPublicUrl(filePath);

  // 3. Save URL to profiles table
  await upsertProfile(userId, { photo_url: publicUrl });

  return publicUrl;
}

/**
 * Save OneSignal Player ID / Subscription ID to profile
 */
export async function saveOneSignalPlayerId(userId, onesignalId) {
  if (!userId || !onesignalId) {
    console.warn('[NoticeIQ Supabase] saveOneSignalPlayerId skipped: missing params', { userId, onesignalId });
    return false;
  }
  try {
    console.log(`[NoticeIQ Supabase] 💾 Updating profiles table for user ${userId} with onesignal_id: ${onesignalId}`);
    const result = await upsertProfile(userId, { onesignal_id: onesignalId });
    console.log('[NoticeIQ Supabase] ✅ Successfully updated profiles.onesignal_id:', result);
    return true;
  } catch (err) {
    console.error('[NoticeIQ Supabase] ❌ Error saving onesignal_id to profile:', err);
    return false;
  }
}

// ==========================================================
// NOTICES DATA LAYER (New Schema)
// ==========================================================

export async function createNotice(userId, rawText, sourceType = 'text') {
  if (!userId) throw new Error('User is not authenticated');

  const { data, error } = await supabase
    .from('notices')
    .insert([
      {
        user_id: userId,
        raw_text: rawText,
        source_type: sourceType
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('[NoticeIQ Supabase] Error creating notice:', error);
    throw error;
  }

  return data;
}

// ==========================================================
// TASKS DATA LAYER (New Schema with Backward-Compatible UI Mapping)
// ==========================================================

function mapTaskRow(t) {
  const isCompleted = t.status === 'completed';
  return {
    id: t.id,
    user_id: t.user_id,
    notice_id: t.notice_id,
    title: t.title,
    task_name: t.title, // alias for UI backward compatibility
    description: t.description || '',
    deadline: t.deadline,
    audience: t.audience || 'All Students',
    requirements: Array.isArray(t.requirements) ? t.requirements : [],
    required_documents: Array.isArray(t.requirements) ? t.requirements : [], // alias for UI
    priority: t.priority || 'medium',
    status: t.status || 'pending',
    completed: isCompleted, // alias for UI
    confidence: t.confidence !== null && t.confidence !== undefined ? Number(t.confidence) : 0.95,
    source_label: t.audience ? `${t.audience} Notice` : 'College Circular',
    created_at: t.created_at
  };
}

export async function fetchTasks(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NoticeIQ Supabase] Error fetching tasks:', error);
    throw error;
  }

  return (data || []).map(mapTaskRow);
}

export async function createTask(userId, task) {
  if (!userId) throw new Error('User is not authenticated');

  const title = task.title || task.task_name || 'Action Item from Notice';
  const reqs = task.requirements || task.required_documents || [];

  // Parse deadline safely without throwing RangeError
  let parsedDeadline = null;
  if (task.deadline) {
    parsedDeadline = parseDeadlineToISO(task.deadline);
    if (!parsedDeadline) {
      console.warn('[NoticeIQ Supabase] Unparseable deadline string provided:', task.deadline);
      throw new Error(`Unparseable deadline "${task.deadline}". Please enter a recognizable date or format.`);
    }
  }

  const row = {
    user_id: userId,
    notice_id: task.notice_id || null,
    title: title,
    deadline: parsedDeadline,
    audience: task.audience || 'All Students',
    requirements: Array.isArray(reqs) ? reqs : [],
    priority: task.priority || 'medium',
    status: task.completed ? 'completed' : (task.status || 'pending'),
    confidence: task.confidence !== undefined ? Number(task.confidence) : 0.95
  };

  console.log('[NoticeIQ Supabase] 4. Executing Supabase tasks.insert with row:', row);

  const { data, error } = await supabase
    .from('tasks')
    .insert([row])
    .select()
    .single();

  console.log('[NoticeIQ Supabase] 5. Supabase insert response:', { data, error });

  if (error) {
    console.error('[NoticeIQ Supabase] Error creating task:', error);
    throw error;
  }

  // Create scheduled reminders at multiple offsets before the deadline (36h, 24h, 3h, 2h, 1h, 0m)
  if (data.deadline) {
    try {
      await createMultiOffsetReminders(data.id, data.deadline);
    } catch (reminderErr) {
      console.warn('[NoticeIQ] Could not schedule auto-reminders:', reminderErr);
    }
  }

  return mapTaskRow(data);
}

export async function updateTask(taskId, updates) {
  if (!taskId) return null;

  const payload = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.task_name !== undefined) payload.title = updates.task_name;
  if (updates.deadline !== undefined) {
    if (updates.deadline) {
      const parsed = parseDeadlineToISO(updates.deadline);
      if (!parsed) {
        console.warn('[NoticeIQ Supabase] Unparseable deadline string provided in updateTask:', updates.deadline);
        throw new Error(`Unparseable deadline "${updates.deadline}". Please enter a recognizable date or format.`);
      }
      payload.deadline = parsed;
    } else {
      payload.deadline = null;
    }
  }
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.requirements !== undefined) payload.requirements = updates.requirements;
  if (updates.required_documents !== undefined) payload.requirements = updates.required_documents;
  if (updates.audience !== undefined) payload.audience = updates.audience;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.completed !== undefined) {
    payload.status = updates.completed ? 'completed' : 'pending';
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('[NoticeIQ Supabase] Error updating task:', error);
    throw error;
  }

  // If deadline was updated, refresh future unsent reminders
  if (updates.deadline !== undefined) {
    try {
      await supabase.from('reminders').delete().eq('task_id', taskId).eq('sent', false);
      if (payload.deadline) {
        await createMultiOffsetReminders(taskId, payload.deadline);
      }
    } catch (remErr) {
      console.warn('[NoticeIQ] Could not refresh reminders on task update:', remErr);
    }
  }

  return mapTaskRow(data);
}

export async function deleteTask(taskId) {
  if (!taskId) return;

  console.log('[NoticeIQ Supabase] Deleting task and pending reminders for taskId:', taskId);

  // 1. Explicitly delete associated reminders first
  try {
    await supabase
      .from('reminders')
      .delete()
      .eq('task_id', taskId);
  } catch (remErr) {
    console.warn('[NoticeIQ Supabase] Warning deleting reminders before task delete:', remErr);
  }

  // 2. Delete the task itself (also guarded by database trigger trg_delete_task_reminders)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('[NoticeIQ Supabase] Error deleting task:', error);
    throw error;
  }
}

export async function clearAllUserTasks(userId) {
  if (!userId) return;

  console.log('[NoticeIQ Supabase] Clearing all tasks and pending reminders for userId:', userId);

  try {
    // 1. Fetch user task IDs to delete associated reminders
    const { data: userTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId);

    const taskIds = (userTasks || []).map((t) => t.id);
    if (taskIds.length > 0) {
      await supabase
        .from('reminders')
        .delete()
        .in('task_id', taskIds);
    }
  } catch (remErr) {
    console.warn('[NoticeIQ Supabase] Warning deleting reminders on clearAllUserTasks:', remErr);
  }

  // 2. Delete all tasks for the user (also guarded by database trigger trg_delete_task_reminders)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('[NoticeIQ Supabase] Error clearing tasks:', error);
    throw error;
  }
}

// ==========================================================
// REMINDERS DATA LAYER (Multi-Offset Schedule)
// ==========================================================

export const REMINDER_OFFSETS = [
  { label: '36h', hours: 36, minutes: 36 * 60 },
  { label: '24h', hours: 24, minutes: 24 * 60 },
  { label: '3h', hours: 3, minutes: 3 * 60 },
  { label: '2h', hours: 2, minutes: 2 * 60 },
  { label: '1h', hours: 1, minutes: 60 },
  { label: '0m', hours: 0, minutes: 0 },
];

/**
 * Generate reminder rows for a task at specified offsets before the deadline:
 * - 36 hours before
 * - 24 hours before
 * - 3 hours before
 * - 2 hours before
 * - 1 hour before
 * - Exactly at deadline (0 minutes before)
 *
 * Condition 1: Only creates reminder rows for offsets that are still in the future.
 */
export async function createMultiOffsetReminders(taskId, deadlineIso) {
  if (!taskId || !deadlineIso) return [];

  const deadlineDate = new Date(deadlineIso);
  if (isNaN(deadlineDate.getTime())) return [];

  const now = Date.now();
  // Buffer of 60 seconds so exact-hour user selections close to 'now' aren't dropped by minor clock variance
  const minFutureTime = now - 60 * 1000;

  const remindersToInsert = REMINDER_OFFSETS
    .map((offset) => {
      const fireTime = new Date(deadlineDate.getTime() - offset.minutes * 60 * 1000);
      return {
        task_id: taskId,
        fire_time: fireTime.toISOString(),
        sent: false,
        notification_type: 'push',
      };
    })
    .filter((r) => new Date(r.fire_time).getTime() > minFutureTime);

  if (remindersToInsert.length === 0) return [];

  const { data, error } = await supabase
    .from('reminders')
    .insert(remindersToInsert)
    .select();

  if (error) {
    console.error('[NoticeIQ Supabase] Error creating multi-offset reminders:', error);
    return [];
  }

  return data || [];
}

export async function createReminder(taskId, fireTime, notificationType = 'push') {
  if (!taskId || !fireTime) return null;

  const { data, error } = await supabase
    .from('reminders')
    .insert([
      {
        task_id: taskId,
        fire_time: fireTime,
        sent: false,
        notification_type: notificationType
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('[NoticeIQ Supabase] Error creating reminder:', error);
    return null;
  }

  return data;
}

export async function fetchUpcomingReminders(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('reminders')
    .select('*, tasks!inner(*)')
    .eq('tasks.user_id', userId)
    .neq('tasks.status', 'completed')
    .eq('sent', false)
    .order('fire_time', { ascending: true })
    .limit(10);

  if (error) {
    console.warn('[NoticeIQ Supabase] Error fetching upcoming reminders:', error);
    return [];
  }

  return data || [];
}

// ==========================================================
// DOCUMENTS DATA LAYER (CAMPUS VAULT - Real Supabase Storage)
// ==========================================================

export async function fetchDocuments(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NoticeIQ Supabase] Error fetching documents:', error);
    throw error;
  }

  return (data || []).map((d) => ({
    id: d.id,
    name: d.file_name,
    file_name: d.file_name,
    file_url: d.file_url,
    category: d.category || 'General',
    status: 'Available',
    created_at: d.created_at
  }));
}

export async function uploadVaultDocument(userId, file, category = 'Identification') {
  if (!userId || !file) throw new Error('User and file are required');

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${userId}/${Date.now()}-${sanitizedFileName}`;

  // 1. Upload to Supabase Storage bucket
  const { error: uploadError } = await supabase.storage
    .from('campus_vault')
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type
    });

  if (uploadError) {
    console.error('[NoticeIQ Supabase] Error uploading document to storage:', uploadError);
    throw uploadError;
  }

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('campus_vault')
    .getPublicUrl(filePath);

  // 3. Insert record into documents table
  const { data, error: dbError } = await supabase
    .from('documents')
    .insert([
      {
        user_id: userId,
        file_url: publicUrl,
        file_name: file.name,
        category: category
      }
    ])
    .select()
    .single();

  if (dbError) {
    console.error('[NoticeIQ Supabase] Error inserting document record:', dbError);
    throw dbError;
  }

  return {
    id: data.id,
    name: data.file_name,
    file_name: data.file_name,
    file_url: data.file_url,
    category: data.category,
    status: 'Available',
    created_at: data.created_at
  };
}

export async function deleteVaultDocument(docId, fileUrl) {
  if (!docId) return;

  // 1. Delete record from database
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (dbError) {
    console.error('[NoticeIQ Supabase] Error deleting document record:', dbError);
    throw dbError;
  }

  // 2. Try removing from storage if path can be extracted
  if (fileUrl && fileUrl.includes('/campus_vault/')) {
    try {
      const storagePath = fileUrl.split('/campus_vault/')[1];
      if (storagePath) {
        await supabase.storage.from('campus_vault').remove([decodeURIComponent(storagePath)]);
      }
    } catch (storageErr) {
      console.warn('[NoticeIQ Supabase] Non-fatal error cleaning storage file:', storageErr);
    }
  }
}
