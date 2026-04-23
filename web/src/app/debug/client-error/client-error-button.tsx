"use client";

import { Button } from "@/components/ui/button";

export function ClientErrorButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        throw new Error("wtg-web deliberate test error (client)");
      }}
    >
      Throw a client-side error
    </Button>
  );
}
