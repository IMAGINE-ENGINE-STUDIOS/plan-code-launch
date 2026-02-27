import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify user owns the project
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

    // Load project secrets (key names only) using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: secrets } = await serviceClient
      .from("project_secrets")
      .select("key")
      .eq("project_id", projectId);
    const configuredKeys = (secrets || []).map((s: any) => s.key);

    // Load existing project files for context
    let fileListContext = "";
    const { data: projectFiles } = await supabase
      .from("project_files")
      .select("file_path")
      .eq("project_id", projectId);
    
    if (projectFiles && projectFiles.length > 0) {
      const paths = projectFiles.map((f: any) => f.file_path).join("\n  ");
      fileListContext = `\n\nEXISTING PROJECT FILES:\n  ${paths}\n\nThis is an imported project. When modifying code, maintain existing patterns, component naming, and file structure. Reference existing files by their exact paths. Only output files you are creating or modifying.`;
    }

    const systemPrompt = `You are a world-class React engineer. You build beautiful, production-quality UIs for "${project.name}".
Description: ${project.description || "No description"}
Features: ${(project.day_one_features || []).join(", ") || "Not specified"}

ENVIRONMENT:
- React 18 + TypeScript
- Tailwind CSS (JIT via CDN — ALL utility classes work including arbitrary values like bg-[#1a1a2e])
- lucide-react for icons
- framer-motion for animations
- react-router-dom for routing
- NO import aliases — use relative paths (./components/X)

OUTPUT FORMAT:
1. Start with a ONE-LINE summary: "Created N files: FileName.tsx, FileName.tsx"
2. Then output complete files using this exact format:
\`\`\`tsx:src/App.tsx
// complete file content
\`\`\`
3. Always output COMPLETE file contents for files you output — never partial snippets.
4. Keep explanations to 1-2 sentences MAX. The code IS the answer.
5. ONLY output files you are CREATING NEW or MODIFYING. Do NOT re-output unchanged files.

COMPLETENESS — CRITICAL:
- You MUST implement EVERY feature the user asks for. Do NOT skip any.
- If the user asks for 5 features, deliver ALL 5 in working code.
- If a feature needs multiple pages, create ALL pages with routing.
- If a feature needs data, create realistic mock data arrays (10+ items).
- NEVER say "I'll add this later" — build it NOW.
- Include ALL interactive states: hover, active, loading, empty, error.

NO PLACEHOLDER UI — CRITICAL:
- Every button, link, form, and interactive element MUST have a working handler.
- If a button can't do anything meaningful yet, DO NOT render it.
- No \`onClick={() => {}}\` or \`// TODO\` handlers — wire it up or remove it.
- If integrating a third-party library (e.g. Cesium, Mapbox, Three.js), build a fully functional MVP — import the library, initialize it, render real output. Never stub it.

PROTECT EXISTING CODE — ABSOLUTE RULE (HIGHEST PRIORITY):
This is the MOST IMPORTANT rule. Violating it is a critical failure.
- ONLY output files that are directly related to the user's request.
- NEVER re-output App.tsx, layout files, navigation, or other existing files unless the user EXPLICITLY asks to change them or you MUST add a route/import for the new feature.
- If you must modify App.tsx (e.g. to add a route), preserve EVERYTHING — every existing import, route, component, className, text, and structure. Only add the new route/import.
- NEVER change the app name, page titles, hero text, descriptions, branding, colors, or any copy that already exists.
- NEVER remove, rename, or reorganize existing components, pages, routes, or features.
- NEVER change image paths, asset references, or URLs that already work.
- NEVER restyle, redesign, or re-layout existing pages or sections.
- If adding a new tool/page, create it in NEW files and only touch existing files to add the minimal import/route needed.
- If the user says "add a dashboard", create the dashboard files — do NOT rewrite the homepage, navbar, or anything else.
- When in doubt, DON'T touch the file. Only modify what is strictly necessary.
- Treat every existing file as READ-ONLY unless the user's request specifically requires changing it.

ROBUST NEW FEATURES — CRITICAL:
- When building a new tool or feature on an existing project, build it completely — full CRUD, all states (loading, empty, error, success), working data flow.
- New features must be self-contained and not break existing functionality.
- Include realistic mock data, proper TypeScript types, and all necessary routing.
- Each new feature should be production-ready on delivery, not a skeleton.

API KEY HANDLING — CRITICAL:
- When a feature requires an external API key or token (e.g. Mapbox, Stripe, OpenAI, Google Maps, etc.), do NOT hardcode a placeholder value or fake key.
- Instead, output the special marker: [NEEDS_API_KEY:KEY_NAME:Description of where to get the key]
- Example: [NEEDS_API_KEY:MAPBOX_TOKEN:Get your token at mapbox.com/account]
- The frontend will render a secure input widget for the user to enter their key.
- After the user provides the key, you will receive a follow-up message confirming it's configured. Then continue building with the key available.
- Currently configured API keys for this project: ${configuredKeys.length > 0 ? configuredKeys.join(", ") : "None"}
- If a needed key is already in the configured list above, proceed to use it directly without requesting it again.

CODE QUALITY RULES:
- Use \`className\` not \`class\`
- Use Tailwind for ALL styling — no inline styles, no CSS files
- Dark theme: bg-gray-950 base, bg-gray-900/800 for cards, text-white/gray-300/gray-400/gray-500
- Every component must be responsive (mobile-first with sm: md: lg: breakpoints)
- Use proper TypeScript types — no \`any\`
- Use lucide-react icons liberally (import individually)
- Add framer-motion animations: fade-in on mount, hover scales, stagger children
- Use semantic HTML (nav, main, section, article, footer)
- Add hover/focus/active states on all interactive elements
- Use rounded-xl borders, subtle border-white/10, backdrop-blur for glass effects
- Gradient accents: bg-gradient-to-r from-indigo-500 to-purple-500
- Forms must have labels, validation, focus rings
- Tables must be responsive with horizontal scroll on mobile
- Modals/dialogs for create/edit actions

COMPONENT PATTERNS:
- Navbar: sticky top, border-b border-white/10, backdrop-blur-xl, logo + links + CTA button
- Hero: large bold heading (text-5xl+), muted description, pill badges for features, dual CTAs
- Cards: rounded-xl, border border-white/10, bg-white/5, p-6, hover:border-indigo-500/30 transition
- Sections: py-20 px-6, max-w-6xl mx-auto, clear heading + grid of cards
- Footer: border-t border-white/10, muted text, links
- Dashboard: grid of stat cards + table/list of data + filters
- Auth: centered card, input fields with labels, submit button, link to toggle login/signup

For multi-page apps, set up BrowserRouter in App.tsx with Routes.
${fileListContext}
`;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    return new Response(response.body, {
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
