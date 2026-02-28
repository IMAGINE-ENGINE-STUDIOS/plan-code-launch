import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, description, stack")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all project files
    const { data: files, error: filesError } = await supabase
      .from("project_files")
      .select("file_path, content")
      .eq("project_id", projectId);

    if (filesError) throw filesError;

    const zip = new JSZip();
    const projectName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Add all project files
    for (const file of (files || [])) {
      zip.addFile(file.file_path, file.content);
    }

    // Add package.json if not present
    const hasPackageJson = (files || []).some((f: any) => f.file_path === "package.json");
    if (!hasPackageJson) {
      const packageJson = {
        name: projectName,
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "react-router-dom": "^6.30.0",
          "lucide-react": "^0.462.0",
          "framer-motion": "^12.0.0",
          "react-hook-form": "^7.61.0",
          zod: "^3.25.0",
          "@hookform/resolvers": "^3.10.0",
          "@tanstack/react-query": "^5.83.0",
          "date-fns": "^3.6.0",
          clsx: "^2.1.1",
          "tailwind-merge": "^2.6.0",
          recharts: "^2.15.0",
          sonner: "^1.7.0",
          "class-variance-authority": "^0.7.1",
          "react-markdown": "^10.1.0",
        },
        devDependencies: {
          "@types/react": "^18.3.0",
          "@types/react-dom": "^18.3.0",
          "@vitejs/plugin-react": "^4.3.0",
          typescript: "^5.6.0",
          vite: "^6.0.0",
          tailwindcss: "^3.4.0",
          postcss: "^8.4.0",
          autoprefixer: "^10.4.0",
        },
      };
      zip.addFile("package.json", JSON.stringify(packageJson, null, 2));
    }

    // Add vite.config.ts if not present
    const hasViteConfig = (files || []).some((f: any) => f.file_path === "vite.config.ts");
    if (!hasViteConfig) {
      zip.addFile("vite.config.ts", `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
});
`);
    }

    // Add tsconfig.json if not present
    const hasTsConfig = (files || []).some((f: any) => f.file_path === "tsconfig.json");
    if (!hasTsConfig) {
      zip.addFile("tsconfig.json", JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          noFallthroughCasesInSwitch: true,
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
        include: ["src"],
      }, null, 2));
    }

    // Add README
    zip.addFile("README.md", `# ${project.name}

${project.description || ""}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Tech Stack
${(project.stack || []).map((s: string) => `- ${s}`).join("\n") || "- React + TypeScript + Tailwind CSS"}

## Build

\`\`\`bash
npm run build
\`\`\`

The built files will be in the \`dist\` directory, ready to deploy to any static hosting service.
`);

    const zipBlob = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectName}.zip"`,
      },
    });
  } catch (e) {
    console.error("export-project error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
