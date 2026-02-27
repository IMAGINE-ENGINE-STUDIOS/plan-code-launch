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
      .select("name, description, stack, day_one_features, status")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert full-stack engineer that BUILDS and MODIFIES the project "${project.name}".
Description: ${project.description || "No description"}
Stack: React 18, TypeScript, Vite, Tailwind CSS (via CDN), lucide-react, framer-motion, react-router-dom
Features: ${(project.day_one_features || []).join(", ") || "Not specified"}
Status: ${project.status}

CRITICAL RULES:
1. When the user asks you to build or change something, you MUST output actual file changes — never just explain.
2. Format file changes using fenced code blocks with the file path after the language:
   \`\`\`tsx:src/App.tsx
   // full file content here
   \`\`\`
3. Always output COMPLETE file contents, not partial snippets or diffs.
4. You can create multiple files in one response.
5. Write PRODUCTION-QUALITY code with:
   - Tailwind CSS classes for all styling (the project uses Tailwind via CDN — no imports needed)
   - lucide-react icons (already installed)
   - framer-motion for animations (already installed)
   - react-router-dom for navigation (already installed)
   - TypeScript with proper types
   - Responsive design (mobile-first)
   - Dark theme (bg-gray-950/900/800, text-white/gray-*)
   - Polished UI: rounded corners, borders, hover states, transitions
6. Keep explanations brief (1-2 sentences max). Focus on writing code.
7. For multi-page apps, use react-router-dom with BrowserRouter in App.tsx.
8. NEVER use import aliases like @/ — use relative paths like ./components/Hero.

Example:
\`\`\`tsx:src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
\`\`\`

\`\`\`tsx:src/pages/Home.tsx
import { ArrowRight } from 'lucide-react';
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-4xl font-bold">Welcome</h1>
    </div>
  );
}
\`\`\`
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
