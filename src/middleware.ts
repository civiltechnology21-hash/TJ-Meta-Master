import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Every route except static assets goes through the auth check.
// Logged-out users are redirected to /login; logged-in users skip /login.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm|js|css|map)$).*)",
  ],
};
