import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PostRequest = {
  body?: unknown;
  communityId?: unknown;
  commitment?: unknown;
  transactionId?: unknown;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function textToField(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  let value = 0n;
  for (const byte of digest.slice(0, 16)) value = value * 256n + BigInt(byte);
  return `${value}field`;
}

function findPublishTransition(value: unknown, programId: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPublishTransition(item, programId);
      if (found) return found;
    }
    return null;
  }
  const object = value as Record<string, unknown>;
  if (
    object.program === programId &&
    (object.function === "publish_post" || object.function_name === "publish_post")
  ) return object;
  for (const nested of Object.values(object)) {
    const found = findPublishTransition(nested, programId);
    if (found) return found;
  }
  return null;
}

function publicInputValues(transition: Record<string, unknown>): string[] {
  if (!Array.isArray(transition.inputs)) return [];
  return transition.inputs.flatMap((input) => {
    if (typeof input === "string") return [input];
    if (!input || typeof input !== "object") return [];
    const value = (input as Record<string, unknown>).value;
    return typeof value === "string" ? [value] : [];
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const payload = await request.json() as PostRequest;
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const communityId = typeof payload.communityId === "string" ? payload.communityId : "";
    const commitment = typeof payload.commitment === "string" ? payload.commitment : "";
    const transactionId = typeof payload.transactionId === "string" ? payload.transactionId : "";
    const programId = Deno.env.get("ALEO_PROGRAM_ID") ?? "";
    const expectedCommunityId = Deno.env.get("ALEO_COMMUNITY_ID") ?? "";
    const apiUrl = (Deno.env.get("ALEO_API_URL") ?? "https://api.explorer.provable.com/v1").replace(/\/$/, "");

    if (!programId || !expectedCommunityId) return json({ error: "Function is not configured" }, 500);
    if (!body || body.length > 280 || !transactionId || communityId !== expectedCommunityId) {
      return json({ error: "Invalid post payload" }, 400);
    }
    if (await textToField(body) !== commitment) return json({ error: "Commitment mismatch" }, 400);

    const transactionResponse = await fetch(
      `${apiUrl}/testnet/transaction/${encodeURIComponent(transactionId)}`,
    );
    if (!transactionResponse.ok) return json({ error: "Transaction is not finalized" }, 409);
    const transaction = await transactionResponse.json();
    const serialized = JSON.stringify(transaction).toLowerCase();
    if (!serialized.includes("accepted")) return json({ error: "Transaction was not accepted" }, 409);

    const transition = findPublishTransition(transaction, programId);
    if (!transition) return json({ error: "publish_post transition not found" }, 400);
    const inputs = publicInputValues(transition);
    if (!inputs.includes(communityId) || !inputs.includes(commitment)) {
      return json({ error: "Transaction inputs do not match the post" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("posts").insert({
      body,
      community_id: communityId,
      commitment,
      transaction_id: transactionId,
    });
    if (error && error.code !== "23505") throw error;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Verification failed" }, 500);
  }
});
