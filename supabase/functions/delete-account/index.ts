import { corsHeaders, json } from "../_shared/cors.ts";
import { createSupabaseClients, errorResponse, requireUser } from "../_shared/utils.ts";

const STORAGE_BUCKETS = ["resumes", "certificates", "avatars"] as const;

// Deletes every object under `<bucket>/<userId>/...` for the given bucket.
// Storage RLS keeps other users' files out of reach even if this ever runs
// with a non-admin client, but we use the admin client here anyway since
// bucket listing needs to see the user's full folder regardless of policy
// nuances, and we're about to remove the account that owns these files.
async function purgeUserStorage(adminClient: ReturnType<typeof createSupabaseClients>["adminClient"], userId: string) {
  for (const bucket of STORAGE_BUCKETS) {
    const { data: files, error: listError } = await adminClient.storage.from(bucket).list(userId, { limit: 1000 });
    if (listError || !files || files.length === 0) continue;
    const paths = files.map((f) => `${userId}/${f.name}`);
    await adminClient.storage.from(bucket).remove(paths);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, adminClient } = await requireUser(request.headers.get("Authorization"));

    await purgeUserStorage(adminClient, user.id);

    // The Admin API is the correct way to remove a user — it deletes the
    // auth.users row (which cascades through every FK in the public schema,
    // all `on delete cascade`/`set null` — audited before this function was
    // written) and cleans up GoTrue-internal state (sessions, identities,
    // MFA factors, etc.) that a raw SQL DELETE wouldn't know to touch.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
