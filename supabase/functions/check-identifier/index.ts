import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

type ContactType = "email" | "phone";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { identifier, type } = (await req.json()) as {
      identifier?: string;
      type?: ContactType;
    };

    if (!identifier || (type !== "email" && type !== "phone")) {
      return json({ error: "Expected identifier and type." }, 400);
    }

    // Important security note:
    // This endpoint can be abused for account enumeration. Before production release,
    // add rate limiting per IP, for example 5-10 requests per IP per minute using
    // Upstash Redis, Supabase rate limit middleware, or an Edge Function KV table.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server is missing Supabase configuration." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await admin.rpc("check_identifier_auth_flow", {
      identifier,
      identifier_type: type,
    });

    if (error) throw error;
    return json(data);
  } catch (error) {
    console.error("check-identifier failed", error);
    return json({ error: "Could not check identifier." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
