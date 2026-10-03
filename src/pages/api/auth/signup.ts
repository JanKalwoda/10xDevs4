import type { APIRoute } from "astro";

import { POST as requestEmailLink } from "./signin";

export const prerender = false;
export const POST: APIRoute = requestEmailLink;
