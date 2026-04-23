"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { postMagicLink } from "@/lib/api-client";

type Status = "idle" | "submitting" | "error";

export type MagicLinkFormProps = {
  /** Pre-fill the address (e.g. when bouncing back from /login/sent). */
  defaultEmail?: string;
};

/**
 * Magic-link request form. Posts to FastAPI, then pushes to `/login/sent`
 * with the email preserved in the URL so that page can echo it back and
 * poll `/api/me` under the same address.
 *
 * Validation is intentionally minimal — FastAPI is the source of truth for
 * "is this a deliverable address". We only guard against empty submits so
 * the 422 round-trip is skipped for the obvious case.
 */
export function MagicLinkForm({ defaultEmail = "" }: MagicLinkFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Enter the email you'd like to sign in with.");
      return;
    }
    setStatus("submitting");
    setError(null);
    const result = await postMagicLink(trimmed);
    if (result === "ok") {
      startTransition(() => {
        router.push(`/login/sent?email=${encodeURIComponent(trimmed)}`);
      });
      return;
    }
    setStatus("error");
    setError(
      result === "rate-limited"
        ? "Too many requests. Wait a minute and try again."
        : "That email doesn't look right. Double-check and resend.",
    );
  }

  const busy = status === "submitting" || isPending;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="auth-email"
          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-subtle"
        >
          Email address
        </Label>
        <Input
          id="auth-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          invalid={status === "error"}
          onChange={(e) => setEmail(e.currentTarget.value)}
          aria-describedby={error ? "auth-email-error" : undefined}
          className="h-11"
        />
        {error ? (
          <p
            id="auth-email-error"
            role="alert"
            className="text-[12px] leading-[1.45] text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" fullWidth loading={busy} iconAfter={<span aria-hidden>→</span>}>
        Send magic link
      </Button>

      <Divider label="OR" />

      <Button
        as="a"
        href="/api/auth/google"
        variant="secondary"
        size="lg"
        fullWidth
        icon={<GoogleIcon />}
      >
        Continue with Google
      </Button>

      <p className="mt-3 border-t border-border pt-3.5 text-[11.5px] leading-[1.55] text-text-subtle">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="text-text-muted hover:text-text">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-text-muted hover:text-text">
          privacy policy
        </Link>
        . Having trouble?{" "}
        <Link href="/contact" className="text-text-link hover:underline">
          Email support.
        </Link>
      </p>
    </form>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-1 flex items-center gap-3" role="separator" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z"
        fill="#4285F4"
      />
      <path
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7a7 7 0 0 1-10.5-3.6H1.6v2.8A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path d="M5.3 14a7 7 0 0 1 0-4.3V6.8H1.6a11 11 0 0 0 0 9.9l3.7-2.8z" fill="#FBBC04" />
      <path
        d="M12 5.6a6 6 0 0 1 4.2 1.6l3.1-3A11 11 0 0 0 1.6 6.8L5.3 9.6A7 7 0 0 1 12 5.6z"
        fill="#EA4335"
      />
    </svg>
  );
}
