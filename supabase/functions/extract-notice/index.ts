// ==========================================================
// Supabase Edge Function: extract-notice
// Purpose: Server-side Gemini AI extraction for NoticeIQ
// Multimodal: Accepts text, images (png, jpg, webp), and PDFs directly.
// Model Priority: gemini-flash-latest (primary), gemini-3.5-flash (fallback)
// ==========================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_TIMEOUT_MS = 25000;
const MAX_REQUESTS_PER_MINUTE = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const rateLimitMap = new Map<string, number[]>();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLACEHOLDER_NAMES = new Set([
  "action item",
  "college action item",
  "college notice",
  "notice",
  "circular",
  "untitled task",
  "placeholder",
  "sample task",
  "new notice"
]);

function checkRateLimit(clientKey: string): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();
  let timestamps = rateLimitMap.get(clientKey) || [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldest = timestamps[0];
    const elapsed = now - oldest;
    const remainingSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000));
    rateLimitMap.set(clientKey, timestamps);
    return { allowed: false, remainingSeconds };
  }

  timestamps.push(now);
  rateLimitMap.set(clientKey, timestamps);
  return { allowed: true, remainingSeconds: 0 };
}

function cleanAndParseJSON(rawText: string): any {
  if (!rawText) {
    console.error("[extract-notice] cleanAndParseJSON received empty or null rawText");
    throw new Error("Empty AI response");
  }

  let cleaned = rawText.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Strip code fences: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {
      // continue
    }
  }

  // Strip leading/trailing code fence delimiters if partially matched
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Fallback: extract substring between first '{' and last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (subErr: any) {
      console.error(`[extract-notice] Substring JSON parse failed: ${subErr.message}. Raw generated text was:\n${rawText}`);
      throw new Error(`Could not parse valid JSON from AI response: ${subErr.message}`);
    }
  }
  console.error(`[extract-notice] No enclosing JSON braces found in generated text. Raw generated text:\n${rawText}`);
  throw new Error("Could not parse valid JSON from AI response: no JSON object found");
}

function sanitizeInput(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|applet|form|meta|link)\b[^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "anonymous-client";
    const clientIdentifier = authHeader ? authHeader.slice(-20) : clientIp;

    const rateResult = checkRateLimit(clientIdentifier);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Please retry in ${rateResult.remainingSeconds} seconds.`
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateResult.remainingSeconds) }
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { 
      noticeText, 
      fileData, 
      source_type,
      userTimezone = "Asia/Kolkata", 
      timezoneOffset = "+05:30" 
    } = body;

    if (!noticeText && !fileData) {
      return new Response(
        JSON.stringify({ error: "Either noticeText or fileData must be provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fileData) {
      const allowedMimes = [
        "image/png", "image/jpeg", "image/jpg", "image/webp",
        "application/pdf"
      ];
      if (fileData.mimeType && !allowedMimes.includes(fileData.mimeType.toLowerCase())) {
        return new Response(
          JSON.stringify({ error: "Unsupported file type. Only PNG, JPG, WEBP images and PDF documents are supported." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (fileData.base64Data) {
        const approxSize = (fileData.base64Data.length * 3) / 4;
        if (approxSize > MAX_FILE_SIZE_BYTES) {
          return new Response(
            JSON.stringify({ error: "File exceeds 10MB limit." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const groqKey = Deno.env.get("GROQ_API_KEY") || Deno.env.get("VITE_GROQ_API_KEY") || "";
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "";

    const now = new Date();
    const todayFormatted = now.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const currentTimeFormatted = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    const currentYear = now.getFullYear();

    const cleanInputText = sanitizeInput(noticeText || "");

    const prompt = `You are NoticeIQ's precision college circular parser.
CRITICAL TIME & TIMEZONE CONTEXT:
- Today's date is: ${todayFormatted} (${now.toISOString().split('T')[0]})
- Current local time: ${currentTimeFormatted}
- Campus & Student Local Timezone: ${userTimezone} (UTC${timezoneOffset})
- Current year: ${currentYear}

INSTRUCTIONS:
1. Parse actionable requirements, deadlines, audience, and paperwork from the notice (which may be plain text, a photo/screenshot, or a PDF circular).
2. TIMEZONE HANDLING: All times in notices (e.g. "tomorrow 5pm", "due tomorrow at 3pm", "11:59 PM", "noon", "17:00") are in the student's local timezone (${userTimezone}, UTC${timezoneOffset}).
3. DEADLINE FORMAT: Return the deadline as an ISO-8601 string WITH the explicit local timezone offset ${timezoneOffset} (e.g. "YYYY-MM-DDTHH:mm:ss${timezoneOffset}").
   - For example: if a notice says "due tomorrow at 3pm", the deadline MUST be "YYYY-MM-DDT15:00:00${timezoneOffset}".
   - For example: if a notice says "tomorrow 5pm", the deadline MUST be "YYYY-MM-DDT17:00:00${timezoneOffset}".
   - MANDATORY TIME RULE: If a deadline date is specified WITHOUT an explicit time of day, default the time to 23:59:00 in local timezone: "YYYY-MM-DDT23:59:00${timezoneOffset}".
   - If no deadline is mentioned, return null.
4. Priority rule:
   - "high" = due within 48 hours or urgent
   - "medium" = due within 7 days
   - "low" = due after 7 days or date not urgent
5. Extract confidence as a decimal between 0.00 and 1.00 indicating clarity and completeness of the extracted information.
6. Return ONLY a valid JSON object with exact keys:
{
  "title": "Specific concise notice title (e.g. 'Python Lab Record Submission')",
  "description": "One concise line summarizing the action needed",
  "deadline": "ISO-8601 string with offset (e.g. '2026-09-10T17:00:00${timezoneOffset}') or null",
  "audience": "Target audience (e.g. 'B.Tech CSE 3rd Year' or 'All Students')",
  "requirements": ["List of documents or items required, e.g. 'College ID', 'Fee Receipt'"],
  "priority": "high" | "medium" | "low",
  "confidence": 0.95
}
${cleanInputText ? `Notice Content:\n${cleanInputText}` : "Notice Content is in the attached image or PDF."}`;

    // ROUTING: If plain text notice and Groq key is available, execute via Groq
    const isTextNotice = source_type === "text" || (!fileData && Boolean(cleanInputText));
    if (isTextNotice && groqKey) {
      console.log("[extract-notice] ⚡ Routing text notice to Groq OpenAI-compatible API...");
      const groqModels = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "groq/compound-mini"
      ];

      for (const model of groqModels) {
        try {
          const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.1,
              max_tokens: 1024
            })
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const text = gData.choices?.[0]?.message?.content;
            if (text) {
              const parsed = cleanAndParseJSON(text);
              return new Response(
                JSON.stringify({ success: true, data: parsed, provider: "groq", model }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } else {
            const errJson = await gRes.json().catch(() => ({}));
            console.warn(`[extract-notice] Groq model ${model} HTTP ${gRes.status}:`, errJson.error?.message);
          }
        } catch (gErr: any) {
          console.warn(`[extract-notice] Groq exception on ${model}:`, gErr?.message);
        }
      }
      console.log("[extract-notice] Groq attempts exhausted or failed, falling back to Gemini...");
    }

    // MULTIMODAL (OR TEXT FALLBACK) VIA GEMINI
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured in Supabase Edge Function secrets."
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts: any[] = [{ text: prompt }];

    if (fileData && fileData.base64Data) {
      parts.push({
        inline_data: {
          mime_type: fileData.mimeType || "image/png",
          data: fileData.base64Data
        }
      });
    }

    // Model hierarchy: gemini-flash-latest first, gemini-3.5-flash fallback
    const models = ["gemini-flash-latest", "gemini-3.5-flash"];
    let lastError: Error | null = null;
    let extractedData: any = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const isPrimary = i === 0;
      const modelTimeout = isPrimary ? 12000 : GEMINI_TIMEOUT_MS;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), modelTimeout);
      const callStart = Date.now();

      try {
        console.log(`[extract-notice] [Attempt ${i + 1}/${models.length}] Calling model: ${model} (timeout: ${modelTimeout}ms) for text: "${cleanInputText.slice(0, 50)}..."`);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              responseMimeType: "application/json"
            }
          })
        });

        clearTimeout(timer);
        const durationMs = Date.now() - callStart;

        console.log(`[extract-notice] Model ${model} HTTP status: ${response.status} ${response.statusText} (${durationMs}ms)`);

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          console.warn(`[extract-notice] Model ${model} returned error status ${response.status}: ${errMsg}`);
          throw new Error(errMsg);
        }

        const data = await response.json();
        console.log(`[extract-notice] Model ${model} candidates count:`, data.candidates?.length || 0);
        console.log(`[extract-notice] Model ${model} raw payload:`, JSON.stringify(data));
        
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason;
        if (finishReason === "MAX_TOKENS") {
          console.warn(`[extract-notice] Model ${model} finished with MAX_TOKENS, candidate tokens may be truncated!`);
        }

        const textContent = (candidate?.content?.parts || [])
          .map((p: any) => p.text || "")
          .join("")
          .trim();

        if (!textContent) {
          console.error(`[extract-notice] Model ${model} returned payload without text parts. Raw candidate:`, JSON.stringify(candidate));
          throw new Error("Empty model response text parts");
        }

        console.log(`[extract-notice] Model ${model} generated text:\n${textContent}`);
        const parsed = cleanAndParseJSON(textContent);
        console.log(`[extract-notice] Model ${model} parsed JSON successfully:`, JSON.stringify(parsed));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid parsed JSON structure");
        }

        const rawTitle = sanitizeInput(parsed.title || parsed.task_name || "");
        const title = (!rawTitle || PLACEHOLDER_NAMES.has(rawTitle.toLowerCase()))
          ? "Action Item from College Notice"
          : rawTitle;

        const rawPriority = String(parsed.priority || "medium").toLowerCase();
        const priority = ["high", "medium", "low"].includes(rawPriority) ? rawPriority : "medium";

        const rawDocs = Array.isArray(parsed.requirements)
          ? parsed.requirements
          : (Array.isArray(parsed.required_documents) ? parsed.required_documents : []);
        const sanitizedDocs = rawDocs
          .map((d: any) => sanitizeInput(String(d || "").trim()))
          .filter(Boolean);

        let finalDeadline: string | null = null;
        if (parsed.deadline) {
          try {
            const parsedDate = new Date(parsed.deadline);
            if (!isNaN(parsedDate.getTime())) {
              finalDeadline = parsedDate.toISOString();
            }
          } catch (_e) {
            finalDeadline = null;
          }
        }

        extractedData = {
          title,
          task_name: title, // alias for UI
          description: sanitizeInput(parsed.description || ""),
          deadline: finalDeadline,
          audience: sanitizeInput(parsed.audience || "All Students"),
          requirements: sanitizedDocs,
          required_documents: sanitizedDocs, // alias for UI
          priority: priority,
          confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0.1, parsed.confidence)) : 0.95
        };

        console.log(`[extract-notice] Extraction successful using model: ${model}`);
        break;
      } catch (err: any) {
        clearTimeout(timer);
        const durationMs = Date.now() - callStart;
        lastError = err;
        const isAbort = err.name === "AbortError" || (err.message && err.message.includes("timed out"));
        if (isAbort) {
          lastError = new Error(`Request timed out on ${model} after ${durationMs}ms`);
        }
        console.warn(`[extract-notice] Model ${model} failed after ${durationMs}ms: ${lastError.message}. Initiating fallback if available...`);
      }
    }


    if (!extractedData) {
      return new Response(
        JSON.stringify({
          error: lastError?.message || "Failed to extract structured notice info",
          fallbackRequired: true
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (globalErr: any) {
    return new Response(
      JSON.stringify({ error: globalErr.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
