// Only the Worker bindings the app reads directly; Supabase secrets go through astro:env/server.
declare module "cloudflare:workers" {
    export const env: {
        PUBLIC_SENTRY_DSN?: string;
        CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
    };
}

interface ImportMetaEnv {
    readonly PUBLIC_SENTRY_DSN?: string;
}

declare namespace App {
    interface Locals {
        user: import("@supabase/supabase-js").User | null;
        supabase: import("@supabase/supabase-js").SupabaseClient | null;
    }
}
