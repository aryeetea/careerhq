import { z } from "npm:zod";
import { corsHeaders, json } from "../_shared/cors.ts";
import { AppError, createSupabaseClients, errorResponse } from "../_shared/utils.ts";

const createAccountSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Choose a stronger password — at least 8 characters."),
  displayName: z.string().trim().min(2, "Tell us what to call you."),
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      throw new AppError("Method not allowed.", 405, "validation_error");
    }

    const payload = createAccountSchema.parse(await request.json());
    const { adminClient } = createSupabaseClients(request.headers.get("Authorization"));

    const { error: createError } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { display_name: payload.displayName },
    });
    if (createError) throw createError;

    return json({ created: true }, 201);
  } catch (error) {
    const handled = errorResponse(error);
    return json(handled.body, handled.status);
  }
});
