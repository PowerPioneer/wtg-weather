import { ClientErrorButton } from "./client-error-button";

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Dev-only trigger for GlitchTip verification. The page itself is SSR; the
 * button is a Client Component that throws out of the handler. Useful as
 * a smoke test to confirm the browser SDK is live.
 */
export default function DebugClientError() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "prod") return null;
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-8">
      <ClientErrorButton />
    </main>
  );
}
