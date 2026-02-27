import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { screenshot, projectFiles, userRequest } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build file context summary
    const fileContext = projectFiles
      ? Object.entries(projectFiles as Record<string, string>)
          .map(([path, content]) => `--- ${path} ---\n${(content as string).slice(0, 2000)}`)
          .join("\n\n")
      : "No project files provided.";

    const systemPrompt = `You are an expert UI/UX reviewer and frontend developer. You are given a screenshot of a web application preview and its source files.

Your job:
1. Analyze the screenshot for visual bugs, layout issues, broken styling, missing elements, accessibility problems, or anything that looks wrong.
2. Compare what you see in the screenshot against what the user requested (if provided).
3. Propose concrete code fixes.

Output format:
- Start with a brief analysis of what you see (2-3 sentences).
- List each issue you found with a short description.
- For each fix, output the corrected file using fenced code blocks with the file path like:
\`\`\`tsx:src/App.tsx
// corrected code here
\`\`\`

Only output files that need changes. Keep existing functionality intact.`;

    const userContent: any[] = [];

    if (screenshot) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: screenshot.startsWith("data:")
            ? screenshot
            : `data:image/png;base64,${screenshot}`,
        },
      });
    }

    let textPrompt = "Analyze this screenshot of my app and identify any visual or functional issues.";
    if (userRequest) {
      textPrompt += `\n\nUser's request/context: ${userRequest}`;
    }
    textPrompt += `\n\nCurrent project files:\n${fileContext}`;

    userContent.push({ type: "text", text: textPrompt });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("test-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
