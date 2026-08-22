/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Public half of the VAPID keypair (see src/lib/push.ts) — safe to ship
  // in the client bundle, same as any other public key; it's what proves
  // to the browser's push service which server is allowed to send this
  // subscription messages, not a secret. Optional: push subscribing is
  // skipped entirely when unset, same fail-open shape as the server-side
  // VAPID_PRIVATE_KEY/VAPID_SUBJECT secrets in supabase/functions/_shared/utils.ts.
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
