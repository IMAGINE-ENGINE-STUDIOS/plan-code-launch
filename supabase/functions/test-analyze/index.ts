import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toGeminiModelName(model: string): string {
  return model.startsWith("google/") ? model.replace("google/", "") : model;
}

function geminiSSEToOpenAIStream(geminiStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = geminiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
              const chunk = processLine(line);
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
          const chunk = processLine(line);
          if (chunk) { controller.enqueue(encoder.encode(chunk)); return; }
        }
      }
    },
  });

  function processLine(line: string): string | null {
    if (!line.startsWith("data: ")) return null;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === "[DONE]") return null;
    try {
      const parsed = JSON.parse(jsonStr);
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return `data: ${JSON.stringify({ choices: [{ delta: { content: text }, index: 0 }] })}\n\n`;
      if (parsed.candidates?.[0]?.finishReason) {
        return `data: ${JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: "stop" }] })}\n\n`;
      }
    } catch {}
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { screenshot, projectFiles, userRequest, projectId } = await req.json();

    // Check for project-level Gemini key
    let geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") || "";
    if (projectId) {
      try {
        const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: secrets } = await serviceClient.from("project_secrets").select("key, value").eq("project_id", projectId);
        const projectKey = (secrets || []).find((s: any) => s.key === "GOOGLE_GEMINI_API_KEY");
        if (projectKey) geminiApiKey = projectKey.value;
      } catch {}
    }

    const fileContext = projectFiles
      ? Object.entries(projectFiles as Record<string, string>)
          .map(([path, content]) => `--- ${path} ---\n${(content as string).slice(0, 2000)}`)
          .join("\n\n")
      : "No project files provided.";

    const systemPrompt = `You are an expert UI/UX reviewer and frontend developer. You are given a screenshot of a web application preview and its source files.

Your job:
1. Analyze the screenshot for visual bugs, layout issues, broken styling, missing elements, accessibility problems.
2. Compare what you see against what the user requested (if provided).
3. Propose concrete code fixes.

Output format:
- Brief analysis (2-3 sentences).
- List each issue with a short description.
- For each fix, output corrected file using fenced code blocks with file path like:
\`\`\`tsx:src/App.tsx
// corrected code here
\`\`\`

Only output files that need changes.`;

    let textPrompt = "Analyze this screenshot of my app and identify any visual or functional issues.";
    if (userRequest) textPrompt += `\n\nUser's request/context: ${userRequest}`;
    textPrompt += `\n\nCurrent project files:\n${fileContext}`;

    if (geminiApiKey) {
      // ─── Direct Gemini API ───
      const geminiModel = toGeminiModelName("google/gemini-2.5-pro");
      const parts: any[] = [];

      if (screenshot) {
        const base64 = screenshot.startsWith("data:") ? screenshot.replace(/^data:[^;]+;base64,/, "") : screenshot;
        parts.push({ inlineData: { mimeType: "image/png", data: base64 } });
      }
      parts.push({ text: textPrompt });

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Gemini API error:", response.status, t);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openAIStream = geminiSSEToOpenAIStream(response.body!);
      return new Response(openAIStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else {
      // ─── Lovable Gateway (fallback) ───
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("No AI provider configured");

      const userContent: any[] = [];
      if (screenshot) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: screenshot.startsWith("data:") ? screenshot : `data:image/png;base64,${screenshot}`,
          },
        });
      }
      userContent.push({ type: "text", text: textPrompt });

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
  } catch (e) {
    console.error("test-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
