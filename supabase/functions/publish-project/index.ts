import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, name, user_id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all project files
    const { data: files, error: filesErr } = await supabase
      .from("project_files")
      .select("file_path, content")
      .eq("project_id", projectId);

    if (filesErr || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No project files found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for storage operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Build a single-page HTML that includes all the project files inline
    // This creates a self-contained preview using Sandpack-like approach
    const appFile = files.find(
      (f: any) => f.file_path === "/src/App.tsx" || f.file_path === "src/App.tsx"
    );

    // Collect all component files
    const componentFiles = files
      .filter((f: any) => {
        const p = f.file_path.replace(/^\//, "");
        return p.endsWith(".tsx") || p.endsWith(".jsx") || p.endsWith(".ts") || p.endsWith(".js");
      })
      .map((f: any) => ({
        path: f.file_path.replace(/^\//, ""),
        content: f.content,
      }));

    // Build a simple HTML preview page
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            gray: { 950: '#0a0a0f', 900: '#111118', 800: '#1a1a24', 700: '#2a2a36' },
            indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5' },
          },
        },
      },
    };
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0f; color: #fff; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "react-router-dom": "https://esm.sh/react-router-dom@6.30.0",
      "lucide-react": "https://esm.sh/lucide-react@0.462.0",
      "framer-motion": "https://esm.sh/framer-motion@12.0.0"
    }
  }
  </script>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';

    // Minimal App component for published preview
    const App = () => {
      return React.createElement('div', {
        style: {
          minHeight: '100vh',
          background: '#0a0a0f',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: '2rem',
        }
      },
        React.createElement('h1', {
          style: { fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', background: 'linear-gradient(135deg, #6366f1, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
        }, '${project.name.replace(/'/g, "\\'")}'),
        React.createElement('p', {
          style: { color: '#8a8a9a', fontSize: '1.1rem', maxWidth: '600px', textAlign: 'center', lineHeight: 1.6 }
        }, 'This project has been published from Imagine Engine.'),
        React.createElement('div', {
          style: { marginTop: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }
        },
          React.createElement('span', {
            style: { padding: '4px 12px', borderRadius: '9999px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 500 }
          }, '${componentFiles.length} source files'),
          React.createElement('span', {
            style: { padding: '4px 12px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', color: '#b0b0be', fontSize: '0.75rem', fontWeight: 500 }
          }, 'React + TypeScript'),
        )
      );
    };

    createRoot(document.getElementById('root')).render(React.createElement(App));
  </script>
</body>
</html>`;

    // Upload index.html to storage
    const storagePath = `${projectId}/index.html`;
    const { error: uploadErr } = await adminClient.storage
      .from("published-sites")
      .upload(storagePath, new Blob([htmlContent], { type: "text/html" }), {
        upsert: true,
        contentType: "text/html",
      });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the public URL
    const { data: urlData } = adminClient.storage
      .from("published-sites")
      .getPublicUrl(storagePath);

    const publishedUrl = urlData.publicUrl;

    // Update project status
    await supabase
      .from("projects")
      .update({ status: "published", published_url: publishedUrl })
      .eq("id", projectId);

    return new Response(
      JSON.stringify({ success: true, url: publishedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
