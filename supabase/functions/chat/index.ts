import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "gemini-3-flash-preview": { input: 0.15, output: 0.60 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00 },
};

// ─── Gemini Direct API Helpers ───

function toGeminiModelName(model: string): string {
  return model.startsWith("google/") ? model.replace("google/", "") : model;
}

function toOpenAIModelName(model: string): string {
  return model.startsWith("google/") ? model : `google/${model}`;
}

function openAIMessagesToGemini(systemPrompt: string, messages: Array<{ role: string; content: any }>) {
  const contents: Array<{ role: string; parts: any[] }> = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (typeof msg.content === "string") {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const item of msg.content) {
        if (item.type === "text") parts.push({ text: item.text });
        else if (item.type === "image_url") {
          const url = item.image_url?.url || "";
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
      }
      contents.push({ role, parts });
    }
  }
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7 },
  };
}

function geminiSSEToOpenAIStream(geminiStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = geminiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let usageData: any = null;

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush remaining buffer
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
              const chunk = processGeminiLine(line);
              if (chunk) controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          const chunk = processGeminiLine(line);
          if (chunk) {
            controller.enqueue(encoder.encode(chunk));
            return; // yield control
          }
        }
      }
    },
  });

  function processGeminiLine(line: string): string | null {
    if (!line.startsWith("data: ")) return null;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === "[DONE]") return null;
    try {
      const parsed = JSON.parse(jsonStr);
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (parsed.usageMetadata) {
        usageData = parsed.usageMetadata;
      }
      if (text) {
        const openAIChunk = {
          choices: [{ delta: { content: text }, index: 0 }],
          ...(usageData ? {
            usage: {
              prompt_tokens: usageData.promptTokenCount || 0,
              completion_tokens: usageData.candidatesTokenCount || 0,
              total_tokens: usageData.totalTokenCount || 0,
            },
          } : {}),
        };
        return `data: ${JSON.stringify(openAIChunk)}\n\n`;
      }
      // Send usage on final chunk even without text
      if (usageData && parsed.candidates?.[0]?.finishReason) {
        const openAIChunk = {
          choices: [{ delta: {}, index: 0, finish_reason: "stop" }],
          usage: {
            prompt_tokens: usageData.promptTokenCount || 0,
            completion_tokens: usageData.candidatesTokenCount || 0,
            total_tokens: usageData.totalTokenCount || 0,
          },
        };
        return `data: ${JSON.stringify(openAIChunk)}\n\n`;
      }
    } catch { /* ignore partial JSON */ }
    return null;
  }
}

// ─── Main Handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { messages, projectId, chatOnly } = await req.json();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, description, stack, day_one_features, status, source_repo, ai_model")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: secrets } = await serviceClient
      .from("project_secrets")
      .select("key, value")
      .eq("project_id", projectId);
    const secretsMap: Record<string, string> = {};
    (secrets || []).forEach((s: any) => { secretsMap[s.key] = s.value; });
    const configuredKeys = Object.keys(secretsMap);

    // Determine AI provider
    const geminiApiKey = secretsMap["GOOGLE_GEMINI_API_KEY"] || Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const useGemini = !!geminiApiKey;

    // Load FULL file contents for context
    let fileContext = "";
    const { data: projectFiles } = await supabase
      .from("project_files")
      .select("file_path, content")
      .eq("project_id", projectId);
    
    if (projectFiles && projectFiles.length > 0) {
      const fileEntries = projectFiles.map((f: any) => {
        const content = f.content.length > 4000 ? f.content.slice(0, 4000) + "\n// ... (truncated)" : f.content;
        return `\n--- ${f.file_path} ---\n${content}`;
      });
      fileContext = `\n\nEXISTING PROJECT FILES (with contents — read carefully before making changes):\n${fileEntries.join("\n")}

CRITICAL: You have the full source code above. When the user asks to change ONE thing:
- Read the existing code carefully
- ONLY modify the specific thing requested
- Output ONLY the files that need changes
- Preserve ALL existing imports, components, routes, styles, text, and logic in any file you output
- If you output App.tsx, it must be IDENTICAL to the existing one except for the specific addition`;
    }

    const chatOnlyPrefix = chatOnly ? `IMPORTANT: You are in CHAT-ONLY mode. Answer the user's question conversationally. Do NOT output any code blocks, file changes, or modifications. Just discuss, explain, advise, and answer questions. Never output fenced code blocks with file paths.\n\n` : '';

    const systemPrompt = `${chatOnlyPrefix}You are a world-class React + Supabase engineer. You build robust, production-quality applications for "${project.name}".
Description: ${project.description || "No description"}
Features: ${(project.day_one_features || []).join(", ") || "Not specified"}

ENVIRONMENT:
- React 18 + TypeScript
- Tailwind CSS (JIT via CDN — ALL utility classes work)
- NO import aliases — use relative paths (./components/X)

PRE-INSTALLED LIBRARIES (use freely — NO [NEEDS_DEPENDENCY] markers needed):

UI Primitives (Radix UI — use for all accessible interactive components):
  @radix-ui/react-dialog, @radix-ui/react-popover, @radix-ui/react-tabs,
  @radix-ui/react-tooltip, @radix-ui/react-select, @radix-ui/react-checkbox,
  @radix-ui/react-switch, @radix-ui/react-accordion, @radix-ui/react-avatar,
  @radix-ui/react-progress, @radix-ui/react-slider, @radix-ui/react-label,
  @radix-ui/react-slot, @radix-ui/react-separator, @radix-ui/react-toggle,
  @radix-ui/react-toggle-group, @radix-ui/react-dropdown-menu,
  @radix-ui/react-context-menu, @radix-ui/react-alert-dialog,
  @radix-ui/react-hover-card, @radix-ui/react-navigation-menu,
  @radix-ui/react-radio-group, @radix-ui/react-scroll-area,
  @radix-ui/react-aspect-ratio, @radix-ui/react-collapsible,
  @radix-ui/react-menubar

Icons & Animation:
  lucide-react (icons — import individually), framer-motion (animations)

Forms (ALWAYS use for any form):
  react-hook-form, zod, @hookform/resolvers

Data Fetching & Backend:
  @tanstack/react-query (use for ALL data fetching — queries, mutations, caching)
  @supabase/supabase-js (database, auth, storage, realtime)

Routing: react-router-dom

Layout & Input:
  react-resizable-panels, embla-carousel-react, vaul (drawer),
  input-otp, react-day-picker, cmdk (command palette)

Utilities:
  date-fns, clsx, tailwind-merge, class-variance-authority,
  next-themes (dark/light mode), react-markdown, html2canvas

Charts: recharts
Notifications: sonner (toast)

3D / WebGL (use for any 3D scenes, games, or WebGL features):
  three (Three.js core), @react-three/fiber (React renderer for Three.js — use <Canvas>),
  @react-three/drei (helpers: OrbitControls, Text3D, Environment, useGLTF, Stars, Sky, etc.)

  3D GUIDELINES:
  - Always wrap 3D content in <Canvas> from @react-three/fiber
  - Use drei helpers for common needs: OrbitControls, PerspectiveCamera, Environment
  - For games: use useFrame() for game loops, drei Physics helpers for collisions
  - For lighting: <ambientLight>, <pointLight>, <directionalLight>
  - For models: useGLTF from drei to load .glb/.gltf files
  - Standard meshes: <mesh>, <boxGeometry>, <sphereGeometry>, <planeGeometry>
  - Materials: <meshStandardMaterial>, <meshPhongMaterial>, <meshBasicMaterial>

PREFERENCES:
- Use @radix-ui primitives for accessible dialogs, popovers, selects, etc.
- Use react-hook-form + zod for ALL forms (validation, error handling)
- Use @tanstack/react-query for data fetching with proper loading/error states
- Use sonner toast() for notifications — NEVER alert/confirm/prompt

███████████████████████████████████████████
RULE 0 — REAL INTEGRATIONS ONLY (HIGHEST PRIORITY)
███████████████████████████████████████████

A. NEVER SIMULATE, FAKE, OR APPROXIMATE A THIRD-PARTY LIBRARY.
B. DEPENDENCY DECLARATION — MANDATORY: [NEEDS_DEPENDENCY:package-name:version]
C. API KEY DECLARATION — MANDATORY: [NEEDS_API_KEY:KEY_NAME:Description]
D. IF YOU CANNOT INTEGRATE A LIBRARY: TELL THE USER WHY.
E. MARKER ORDER: [NEEDS_DEPENDENCY] first, then [NEEDS_API_KEY], then code.

═══════════════════════════════════════════
ABSOLUTE RULES — NEVER VIOLATE
═══════════════════════════════════════════

1. NO BROWSER DIALOGS — EVER
2. EVERY BUTTON MUST WORK
3. BUILD WITH REAL DATA PERSISTENCE
4. PROTECT EXISTING CODE — HIGHEST PRIORITY
5. COMPLETE IMPLEMENTATIONS ONLY

OUTPUT FORMAT:
1. Output markers FIRST (if any)
2. ONE-LINE summary
3. Complete files using: \`\`\`tsx:src/path/File.tsx
4. ONLY output files you are CREATING or MODIFYING

API KEY HANDLING:
- Currently configured: ${configuredKeys.length > 0 ? configuredKeys.join(", ") : "None"}
${fileContext}
`;

    const modelName = (project as any).ai_model || "google/gemini-3-flash-preview";

    if (useGemini) {
      // ─── Direct Gemini API ───
      const geminiModel = toGeminiModelName(modelName);
      const geminiBody = openAIMessagesToGemini(systemPrompt, messages);
      
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Gemini API error:", response.status, t);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Gemini API error: " + response.status }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Transform Gemini SSE to OpenAI SSE format
      const openAIStream = geminiSSEToOpenAIStream(response.body!);

      // Tee the stream for usage logging
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = openAIStream.getReader();

      (async () => {
        let usageData: any = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
            // Parse for usage data
            const text = new TextDecoder().decode(value);
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.usage) usageData = parsed.usage;
              } catch {}
            }
          }
        } catch (e) { console.error("stream relay error:", e); }
        finally { await writer.close(); }

        // Log usage
        try {
          const promptTokens = usageData?.prompt_tokens ?? 0;
          const completionTokens = usageData?.completion_tokens ?? 0;
          const totalTokens = usageData?.total_tokens ?? (promptTokens + completionTokens);
          const costs = MODEL_COSTS[geminiModel] || MODEL_COSTS[modelName] || { input: 0.15, output: 0.60 };
          const estimatedCost = (promptTokens / 1_000_000) * costs.input + (completionTokens / 1_000_000) * costs.output;
          await serviceClient.from("usage_logs").insert({
            project_id: projectId, user_id: userId, model: modelName,
            prompt_tokens: promptTokens, completion_tokens: completionTokens,
            total_tokens: totalTokens, estimated_cost: estimatedCost,
          });
        } catch (logErr) { console.error("Failed to log usage:", logErr); }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else {
      // ─── Lovable Gateway (fallback) ───
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("No AI provider configured. Add a GOOGLE_GEMINI_API_KEY in project secrets or ensure LOVABLE_API_KEY is set.");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      (async () => {
        let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.usage) usageData = parsed.usage;
              } catch {}
            }
          }
        } catch (e) { console.error("stream relay error:", e); }
        finally { await writer.close(); }

        try {
          const promptTokens = usageData?.prompt_tokens ?? 0;
          const completionTokens = usageData?.completion_tokens ?? 0;
          const totalTokens = usageData?.total_tokens ?? (promptTokens + completionTokens);
          const costs = MODEL_COSTS[modelName] || { input: 0.15, output: 0.60 };
          const estimatedCost = (promptTokens / 1_000_000) * costs.input + (completionTokens / 1_000_000) * costs.output;
          await serviceClient.from("usage_logs").insert({
            project_id: projectId, user_id: userId, model: modelName,
            prompt_tokens: promptTokens, completion_tokens: completionTokens,
            total_tokens: totalTokens, estimated_cost: estimatedCost,
          });
        } catch (logErr) { console.error("Failed to log usage:", logErr); }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
