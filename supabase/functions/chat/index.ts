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
};

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

    const { messages, projectId } = await req.json();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, description, stack, day_one_features, status, source_repo")
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
      .select("key")
      .eq("project_id", projectId);
    const configuredKeys = (secrets || []).map((s: any) => s.key);

    // Load FULL file contents for context (not just paths)
    let fileContext = "";
    const { data: projectFiles } = await supabase
      .from("project_files")
      .select("file_path, content")
      .eq("project_id", projectId);
    
    if (projectFiles && projectFiles.length > 0) {
      // Build full file context — include content for AI to understand existing code
      const fileEntries = projectFiles.map((f: any) => {
        // Truncate very large files to avoid context overflow
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

    const systemPrompt = `You are a world-class React + Supabase engineer. You build robust, production-quality applications for "${project.name}".
Description: ${project.description || "No description"}
Features: ${(project.day_one_features || []).join(", ") || "Not specified"}

ENVIRONMENT:
- React 18 + TypeScript
- Tailwind CSS (JIT via CDN — ALL utility classes work)
- lucide-react for icons
- framer-motion for animations
- react-router-dom for routing
- @supabase/supabase-js for database, auth, and storage
- NO import aliases — use relative paths (./components/X)

███████████████████████████████████████████
RULE 0 — REAL INTEGRATIONS ONLY (HIGHEST PRIORITY)
███████████████████████████████████████████

This is the MOST IMPORTANT rule. Violating it is an IMMEDIATE, CRITICAL FAILURE.

A. NEVER SIMULATE, FAKE, OR APPROXIMATE A THIRD-PARTY LIBRARY.
   - If the user asks to integrate Cesium, MapboxGL, Three.js, Stripe, D3, Leaflet,
     Chart.js, PixiJS, Babylon.js, or ANY other library, you MUST use the REAL library
     via real \`import\` statements.
   - NEVER create a "simulation", "placeholder", "visual approximation", "mock map",
     "canvas drawing that looks like a map", or ANY substitute for a real library.
   - NEVER draw shapes, gradients, or static images to simulate what a library renders.
   - If you catch yourself writing code that doesn't import the actual library the user
     requested, STOP and follow the rules below instead.

B. DEPENDENCY DECLARATION — MANDATORY:
   When a library is needed that isn't already imported in the project, you MUST output
   this marker at the TOP of your response, BEFORE any code blocks:
   [NEEDS_DEPENDENCY:package-name:version]
   Examples:
   [NEEDS_DEPENDENCY:cesium:^1.119.0]
   [NEEDS_DEPENDENCY:three:^0.168.0]
   [NEEDS_DEPENDENCY:@react-three/fiber:^8.17.0]
   [NEEDS_DEPENDENCY:mapbox-gl:^3.7.0]
   [NEEDS_DEPENDENCY:leaflet:^1.9.4]
   You may output MULTIPLE markers, one per line.

C. API KEY DECLARATION — MANDATORY:
   When a library requires an API key or access token, you MUST output this marker
   at the TOP of your response, BEFORE any code blocks:
   [NEEDS_API_KEY:KEY_NAME:Description of where to get it (include URL)]
   Examples:
   [NEEDS_API_KEY:CESIUM_ION_TOKEN:Get your free token at https://ion.cesium.com/tokens]
   [NEEDS_API_KEY:MAPBOX_ACCESS_TOKEN:Get your token at https://account.mapbox.com/access-tokens/]
   DO NOT write code that uses the API key until this marker has been emitted.
   The user's environment will block code application until they provide the key.

D. IF YOU CANNOT INTEGRATE A LIBRARY:
   - If a library requires server-side setup, Node.js runtime, native binaries, or WASM
     that cannot run in a browser sandbox, EXPLICITLY TELL THE USER WHY.
   - Say "I cannot integrate X because it requires Y. Here's what you'd need to do…"
   - NEVER silently fall back to a fake implementation.

E. MARKER ORDER: [NEEDS_DEPENDENCY] markers first, then [NEEDS_API_KEY] markers,
   then your one-line summary, then code blocks.

═══════════════════════════════════════════
ABSOLUTE RULES — NEVER VIOLATE
═══════════════════════════════════════════

1. NO BROWSER DIALOGS — EVER
   - NEVER use alert(), confirm(), prompt(), or window.alert/confirm/prompt
   - Instead: use toast notifications, inline messages, or modal components
   - For confirmations: use a custom modal/dialog with "Confirm" and "Cancel" buttons
   - For alerts: use a toast notification or an inline banner
   - This is a HARD RULE — any use of alert/confirm/prompt is a critical failure

2. EVERY BUTTON MUST WORK
   - Every button, link, and interactive element MUST have a real, working handler
   - No onClick={() => {}} or onClick={() => alert('...')} — ever
   - If a feature needs backend data, implement it with Supabase or realistic state management
   - If a button opens a modal, BUILD the modal with full form/content
   - If a button navigates, use react-router-dom navigate() or <Link>
   - If a button submits data, implement the full create/update/delete flow
   - If you genuinely cannot implement a feature yet, DON'T render the button at all

3. BUILD WITH REAL DATA PERSISTENCE
   - For ANY data that should persist (user-created content, settings, lists, preferences),
     use localStorage at MINIMUM. For multi-user or cross-device data, use Supabase tables.
   - NEVER use in-memory-only arrays as the primary data source for user-facing features.
   - Mock/seed data is acceptable ONLY as initial data loaded into localStorage or state on first run.
   - For any CRUD feature: implement full create, read, update, delete with real state management
   - Forms must validate inputs, show loading states, handle errors, and show success feedback
   - Lists must handle: loading skeleton, empty state, error state, populated state
   - Implement optimistic updates where appropriate

4. PROTECT EXISTING CODE — HIGHEST PRIORITY
   - ONLY output files that are directly related to the user's request
   - NEVER re-output files that don't need changes
   - If you must modify a file (e.g. App.tsx to add a route), preserve EVERYTHING existing
   - NEVER change: app name, titles, hero text, descriptions, branding, colors, copy, existing routes, existing components
   - NEVER remove, rename, or reorganize existing code
   - NEVER restyle existing pages or sections unless explicitly asked
   - When in doubt, DON'T touch the file

5. COMPLETE IMPLEMENTATIONS ONLY
   - Every feature must be fully implemented on delivery — not a skeleton
   - Include all states: loading, empty, error, success, hover, active, disabled
   - Include realistic mock data (10+ items for lists)
   - Include proper TypeScript types for all data structures
   - Include proper error handling with try/catch in async operations
   - Include proper form validation with user feedback
   - Multi-page features need ALL pages with working routing

OUTPUT FORMAT:
1. Output [NEEDS_DEPENDENCY] and [NEEDS_API_KEY] markers FIRST (if any)
2. Then a ONE-LINE summary: "Created N files: FileName.tsx, FileName.tsx"
3. Output complete files using: \`\`\`tsx:src/path/File.tsx
4. Always output COMPLETE file contents — never partial
5. Keep explanations to 1-2 sentences MAX
6. ONLY output files you are CREATING or MODIFYING

INTERACTIVE PATTERNS (use these instead of browser dialogs):
- Confirmation: Build a Dialog/Modal component with confirm/cancel buttons
- Notifications: Use toast() from sonner or a custom Toast component
- Form feedback: Inline success/error messages below the form
- Delete confirmation: "Are you sure?" modal with item details
- Loading: Skeleton UI or spinner with descriptive text
- Empty states: Illustrated message with CTA button

ROBUST FEATURE PATTERNS:
- Lists: Search/filter bar, sort options, pagination, empty state, loading skeleton
- Forms: Labeled inputs, validation, error messages, submit loading, success toast
- Modals: Proper open/close state, form inside, cancel/submit buttons, loading state
- Navigation: Active route highlighting, mobile responsive menu, proper <Link> usage
- Data tables: Column headers, row actions (edit/delete with real handlers), responsive scroll
- Auth flows: Login/signup forms with validation, error handling, redirect on success

API KEY HANDLING:
- When a feature requires an external API key, output: [NEEDS_API_KEY:KEY_NAME:Description]
- Currently configured: ${configuredKeys.length > 0 ? configuredKeys.join(", ") : "None"}
- If a key is already configured, use it directly

CODE QUALITY:
- className not class
- Tailwind for ALL styling — no inline styles
- Dark theme: bg-gray-950 base, bg-gray-900/800 cards, text-white/gray-300/400/500
- Every component responsive (mobile-first with sm: md: lg: breakpoints)
- Proper TypeScript types — no \`any\`
- lucide-react icons (import individually)
- framer-motion animations where appropriate
- Semantic HTML (nav, main, section, article, footer)
- All interactive elements need hover/focus/active states
${fileContext}
`;
    const modelName = "google/gemini-3-flash-preview";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
              if (parsed.usage) {
                usageData = parsed.usage;
              }
            } catch { /* partial JSON, ignore */ }
          }
        }
      } catch (e) {
        console.error("stream relay error:", e);
      } finally {
        await writer.close();
      }

      try {
        const promptTokens = usageData?.prompt_tokens ?? 0;
        const completionTokens = usageData?.completion_tokens ?? 0;
        const totalTokens = usageData?.total_tokens ?? (promptTokens + completionTokens);
        const costs = MODEL_COSTS[modelName] || { input: 0.15, output: 0.60 };
        const estimatedCost = (promptTokens / 1_000_000) * costs.input + (completionTokens / 1_000_000) * costs.output;

        await serviceClient.from("usage_logs").insert({
          project_id: projectId,
          user_id: userId,
          model: modelName,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost,
        });
      } catch (logErr) {
        console.error("Failed to log usage:", logErr);
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
