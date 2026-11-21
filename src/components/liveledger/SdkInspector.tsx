import { useState } from "react";
import { Activity, Braces, Check, Copy, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LedgerState } from "@/sdk/liveledger-sdk";

const SNIPPET = `import { LiveLedgerSDK } from "@/sdk/liveledger-sdk";

// 1. Initialize once when your banking app starts
const ledger = new LiveLedgerSDK({
  storage: window.localStorage, // on-device persistence
});

// 2. Feed every incoming bank / UPI SMS to the SDK
const result = ledger.ingestSMS(
  "Rs. 500.00 debited via UPI to Zomato on 20-11-26"
);
// result.status -> "ADDED" | "DUPLICATE" | "IGNORED_OTP" | ...

// 3. Render balances straight from the SDK
const { verifiedBalance, projectedBalance, pendingCount } = ledger.getState();

// 4. Log a payment by hand when no SMS arrives
ledger.addManualTransaction({
  name: "Auto rickshaw", amount: 120, direction: "debit",
  status: "PENDING", // or "VERIFIED_MANUAL"
});

// 5. Let the user confirm a pending entry with one tap
ledger.confirmTransaction(txId); // PENDING -> VERIFIED_MANUAL

// 6. When the official statement arrives, reconcile the rest
ledger.syncStatement(); // PENDING -> VERIFIED_SMS

// Optional: re-render on every change
ledger.subscribe(() => render(ledger.getState()));`;

export function SdkInspector({ state }: { state: LedgerState }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:py-8">
      <section className="min-w-0 overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-card" aria-label="Integration snippet">
        <div className="flex items-center justify-between gap-3 border-b border-primary-foreground/10 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <FileCode2 className="size-5 text-teal" />
            Integration code
          </h2>
          <Button variant="panel" size="sm" onClick={copy} aria-label="Copy integration code">
            {copied ? <Check className="text-teal" /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-primary-foreground/90 sm:text-sm">
          <code>{SNIPPET}</code>
        </pre>
      </section>

      <div className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-card" aria-label="SDK state">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <Braces className="size-5 text-teal-strong" />
              ledger.getState()
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-teal animate-pulse-dot" />
              Live
            </span>
          </div>
          <pre className="max-h-[420px] overflow-auto bg-muted/60 p-5 font-mono text-xs leading-relaxed" data-testid="sdk-state">
            <code>{JSON.stringify(state, null, 2)}</code>
          </pre>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-card" aria-label="SDK Event Log">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <Activity className="size-5 text-teal-strong" />
              SDK Event Log
            </h2>
            <span className="text-xs text-muted-foreground">Last 10 calls</span>
          </div>
          <ul className="divide-y font-mono text-xs sm:text-sm">
            {state.eventLog.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0 truncate">
                  {e.method}() <span className="text-muted-foreground">-&gt;</span>{" "}
                  <span className={cn("font-semibold", statusTone(e.status))}>{e.status}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{new Date(e.at).toLocaleTimeString("en-IN")}</span>
              </li>
            ))}
            {state.eventLog.length === 0 && (
              <li className="px-5 py-6 text-center font-sans text-sm text-muted-foreground">
                No SDK calls yet. Use the Host App Demo tab to trigger some.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function statusTone(status: string) {
  if (status === "OK" || status === "ADDED") return "text-success";
  if (status.startsWith("IGNORED")) return "text-warning-strong";
  return "text-destructive";
}
