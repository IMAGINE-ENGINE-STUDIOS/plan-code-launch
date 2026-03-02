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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { remoteUrl, remoteAnonKey, remoteServiceKey, projectId } = await req.json();

    if (!remoteUrl || !projectId) {
      return new Response(
        JSON.stringify({ error: "remoteUrl and projectId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test the connection by querying the remote instance
    const keyToUse = remoteServiceKey || remoteAnonKey;
    if (!keyToUse) {
      return new Response(
        JSON.stringify({ error: "At least one key (anon or service role) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const remoteClient = createClient(remoteUrl, keyToUse);
      // Try a simple query to verify connection
      const { error: testErr } = await remoteClient
        .from("projects")
        .select("id")
        .limit(1);

      // Even if the table doesn't exist, we got a connection
      // Only fail on network/auth errors
      if (testErr && testErr.message.includes("Failed to fetch")) {
        throw new Error("Could not reach the remote instance. Check the URL.");
      }
    } catch (connErr: any) {
      return new Response(
        JSON.stringify({
          error: `Connection test failed: ${connErr.message}`,
          connected: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ connected: true, message: "Connection successful" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
