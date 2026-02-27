import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a project intake analyzer. Given a user's project description, extract what you can determine and identify what's missing.

Return a JSON object with this exact structure:
{
  "extracted": {
    "buildType": "<one of: SaaS / Dashboard, Marketplace, CRM / Internal Tool, Booking Platform, AI App, E-Commerce, Landing Page, Other>" or null if unclear,
    "codeSource": "<one of: Starting from scratch, GitHub repo, Existing project, ZIP / Files, Not sure>" or null if not mentioned,
    "priorities": ["<from: Lowest cost, Fast launch, Beautiful UI, Scalability, Security, Advanced features>"] or [] if not mentioned,
    "dayOneFeatures": ["<from: Auth, Database, Admin panel, Payments, File uploads, AI features, Custom domain, Team collaboration>"] or [] if not mentioned,
    "projectName": "<a short descriptive name for the project>" or null,
    "description": "<a one-sentence summary of what they want to build>" or null
  },
  "missingQuestions": ["buildType", "codeSource", "priorities", "dayOneFeatures"] // only include keys where the value is null or empty
}

Rules:
- Only extract values you are confident about from the prompt
- If the user mentions needing login/signup, extract "Auth" as a dayOneFeature
- If they mention database/storing data, extract "Database"
- If they mention payments/subscriptions, extract "Payments"
- If they mention AI/chatbot/LLM, extract "AI features" and consider "AI App" for buildType
- If they say "from scratch" or don't mention existing code, set codeSource to "Starting from scratch"
- Always generate a projectName and description
- Return ONLY the JSON, no markdown fences`;

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
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle potential markdown fences)
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      // Fallback: everything is missing
      parsed = {
        extracted: {
          buildType: null,
          codeSource: null,
          priorities: [],
          dayOneFeatures: [],
          projectName: null,
          description: null,
        },
        missingQuestions: ["buildType", "codeSource", "priorities", "dayOneFeatures"],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
