import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".css", ".html", ".json", ".jsx", ".js", ".svg"];
const ALLOWED_DIRS = ["src/", "public/", "index.html", "package.json", "tailwind.config", "postcss.config", "tsconfig", "vite.config"];
const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_FILES = 80;

function parseRepoUrl(url: string): { owner: string; repo: string; branch?: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\/|$|\?|#)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, ""), branch: match[3] };
  const match2 = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (match2) return { owner: match2[1], repo: match2[2] };
  return null;
}

function shouldInclude(path: string): boolean {
  if (path.includes("node_modules/") || path.includes(".git/") || path.includes("dist/") || path.includes(".next/")) return false;
  const ext = "." + path.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  return ALLOWED_DIRS.some(d => path.startsWith(d) || path.includes("/" + d) || path === d);
}

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

    const { repoUrl, scanOnly } = await req.json();
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid GitHub URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { owner, repo } = parsed;
    let branch = parsed.branch;

    // Get default branch if not specified
    if (!branch) {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { "User-Agent": "Lovable-Import" },
      });
      if (!repoRes.ok) {
        const t = await repoRes.text();
        return new Response(JSON.stringify({ error: `Repository not found or not accessible: ${owner}/${repo}` }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const repoData = await repoRes.json();
      branch = repoData.default_branch || "main";
    }

    // Fetch file tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers: { "User-Agent": "Lovable-Import" },
    });
    if (!treeRes.ok) {
      const t = await treeRes.text();
      return new Response(JSON.stringify({ error: "Failed to fetch repository tree" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const treeData = await treeRes.json();
    
    const eligibleFiles = (treeData.tree || [])
      .filter((f: any) => f.type === "blob" && shouldInclude(f.path) && (f.size || 0) < MAX_FILE_SIZE)
      .slice(0, MAX_FILES);

    // If scan only, return file list without contents
    if (scanOnly) {
      return new Response(JSON.stringify({
        owner, repo, branch,
        files: eligibleFiles.map((f: any) => ({ path: f.path, size: f.size })),
        totalFiles: eligibleFiles.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all file contents in parallel
    const fileMap: Record<string, string> = {};
    const fetchPromises = eligibleFiles.map(async (f: any) => {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`, {
          headers: { "User-Agent": "Lovable-Import" },
        });
        if (res.ok) {
          const content = await res.text();
          fileMap[f.path] = content;
        }
      } catch {
        // Skip failed files
      }
    });

    await Promise.all(fetchPromises);

    return new Response(JSON.stringify({
      owner, repo, branch,
      files: fileMap,
      totalFiles: Object.keys(fileMap).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
