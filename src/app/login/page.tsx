"use client";

import { useActionState, useEffect, useRef } from "react";
import { BrandNameImage } from "@/components/ui/BrandNameImage";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand.generated";
import { APP_NAME } from "@/lib/constants";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null, email: "" };

const inputClass =
  "h-11 w-full rounded-md border border-line-strong bg-field px-3 text-sm text-fg " +
  "placeholder:text-muted-2 transition-[border-color,box-shadow] duration-200 " +
  "hover:border-muted-2/60 focus:border-brand focus:shadow-[0_0_0_3px_var(--c-brand-wash)] focus:outline-none";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const shakeRef = useRef<HTMLDivElement>(null);

  // Every failed attempt gives a fresh state object, so the card shakes each time
  // (even when the message is the same as before).
  useEffect(() => {
    const el = shakeRef.current;
    if (!state.error || !el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth; // let the browser notice the class was removed, so it can start again
    el.classList.add("animate-shake");
  }, [state]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div ref={shakeRef} className="w-full max-w-sm">
      <form
        action={formAction}
        className="animate-rise w-full rounded-xl border border-line bg-panel p-8 shadow-card"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logo} alt="" className="h-16 w-16 rounded-xl object-contain" />
          {BRAND.name ? (
            <>
              <BrandNameImage alt="" className="h-9 w-auto" />
              <h1 className="sr-only">{APP_NAME}</h1>
            </>
          ) : (
            <h1 className="font-mono text-xl font-semibold tracking-tight">{APP_NAME}</h1>
          )}
          <p className="text-sm text-muted">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={state.email}
              placeholder="you@example.com"
              required
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-muted">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className={inputClass}
            />
          </div>
        </div>

        <p
          role="alert"
          aria-live="polite"
          className="mt-4 min-h-5 text-sm text-bad-fg"
        >
          {state.error ? <span className="animate-row-in inline-block">{state.error}</span> : null}
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={pending}
          className="mt-2"
        >
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      </div>
    </main>
  );
}
