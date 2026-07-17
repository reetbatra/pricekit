"use client";
import { useEffect, useState } from "react";

/** Live credit balance, read from Dodo via a thin server route — no local
 *  mirror, Dodo is the single source of truth. 2s poll so the worker's
 *  deduction lands on screen the moment it happens. */
export function CreditBalance({ customerId }: { customerId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/credits?c=${encodeURIComponent(customerId)}`);
        if (on && r.ok) setBalance((await r.json()).balance);
      } catch {
        /* transient — next tick retries */
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [customerId]);
  return (
    <div className="font-mono text-sm" title="prepaid credits (Dodo)">
      {balance === null ? "…" : `${balance} credits`}
    </div>
  );
}
