import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Clock,
  Landmark,
  MessageSquareText,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_SMS, formatRs, type LedgerState, type LiveLedgerSDK, type Transaction } from "@/sdk/liveledger-sdk";

type Feedback = { tone: "success" | "info" | "error"; text: string } | null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SAMPLES = [
  { label: "HDFC Debit", text: "Sent Rs.250 from HDFC Bank To SWIGGY On 20/11/26 Ref 641200000004" },
  { label: "UPI Credit", text: "Rs.1500 credited to A/c XX1234 from VPA ravi@okaxis" },
  { label: "OTP Spam", text: "482913 is your OTP for HDFC Bank NetBanking login. Do not share it with anyone." },
];

export function HostAppDemo({ ledger, state }: { ledger: LiveLedgerSDK; state: LedgerState }) {
  const [smsText, setSmsText] = useState(DEFAULT_SMS);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleParse = () => {
    const result = ledger.ingestSMS(smsText);
    if (result.status === "ADDED") {
      const tx = result.transaction;
      setFeedback({
        tone: "success",
        text: `Added ${tx.name}: ${tx.direction === "debit" ? "-" : "+"} ${formatRs(tx.amount)} (pending)`,
      });
    } else if (result.status === "DUPLICATE") {
      setFeedback({ tone: "error", text: "Already recorded" });
    } else {
      setFeedback({ tone: "info", text: "Not a transaction alert" });
    }
  };

  const handleSync = () => {
    ledger.syncStatement();
    setFeedback({ tone: "success", text: "Bank statement synced. All payments are now posted." });
  };

  const handleMismatch = () => {
    ledger.simulateMismatch();
    setFeedback(null);
  };

  const handleReset = () => {
    ledger.reset();
    setSmsText(DEFAULT_SMS);
    setFeedback(null);
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-8">
      <section className="space-y-5" aria-label="Dashboard">
        {state.isLowBalance && (
          <Banner tone="danger" icon={<BellRing />}>
            Low Balance Alert: Live balance is below your set limit!
          </Banner>
        )}
        {state.mismatch && (
          <Banner tone="danger" icon={<ShieldAlert />}>
            Alert said {formatRs(state.mismatch.alertAmount)}, bank statement shows {formatRs(state.mismatch.bankAmount)}.
          </Banner>
        )}
        {state.pendingCount > 0 && (
          <Banner tone="warning" icon={<Clock />}>
            Bank not updated yet: {plural(state.pendingCount, "payment")} pending ({formatRs(state.pendingTotal)})
          </Banner>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Landmark className="size-4" />
              Confirmed Bank Balance
            </div>
            <p className="mt-3 font-display text-3xl font-bold tabular sm:text-4xl" data-testid="confirmed">
              {formatRs(state.confirmedBalance)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Last bank statement sync</p>
          </div>

          <div className="relative rounded-2xl border-2 border-teal bg-card p-5 shadow-live">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-strong">
                <Zap className="size-4" />
                Live Balance
              </div>
              <Badge variant="estimated">ESTIMATED</Badge>
            </div>
            <p className="mt-3 font-display text-3xl font-bold tabular sm:text-4xl" data-testid="live">
              {formatRs(state.liveBalance)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Includes {plural(state.pendingCount, "pending payment")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label htmlFor="low-limit" className="text-sm font-semibold">
              Low Balance Alert
            </label>
            <p className="text-sm text-muted-foreground">Warn me when my live balance drops below</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Rs.</span>
            <Input
              id="low-limit"
              type="number"
              inputMode="numeric"
              min={0}
              className="h-11 w-36 rounded-xl text-base font-semibold tabular"
              value={state.lowBalanceLimit}
              onChange={(e) => ledger.setLowBalanceLimit(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-display text-base font-semibold">Transactions</h2>
            <span className="text-xs text-muted-foreground">{plural(state.transactions.length, "item")}</span>
          </div>
          <ul className="divide-y">
            {state.transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} mismatch={state.mismatch?.txId === tx.id} />
            ))}
            {state.transactions.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">No transactions yet</li>
            )}
          </ul>
          <div className="flex flex-col gap-3 border-t bg-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Spent today </span>
              <span className="font-display text-lg font-bold tabular" data-testid="spent">
                {formatRs(state.spentToday)}
              </span>
            </div>
            <Badge variant="muted" className="gap-1.5 rounded-full px-3 py-1 font-medium">
              <ShieldCheck className="size-3.5 text-teal-strong" />
              On-device SDK • No bank passwords stored
            </Badge>
          </div>
        </div>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Live SMS and Bank Simulator">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <MessageSquareText className="size-5 text-teal" />
            Live SMS &amp; Bank Simulator
          </h2>
          <p className="mt-1 text-sm text-primary-foreground/65">Paste a bank or UPI alert to see your live balance react.</p>

          <div className="mt-5 space-y-3">
            <label htmlFor="sms" className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">
              1. Incoming SMS
            </label>
            <Textarea
              id="sms"
              rows={4}
              className="rounded-xl border-transparent bg-card text-sm text-card-foreground"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2" aria-label="Sample messages">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setSmsText(s.text);
                    setFeedback(null);
                  }}
                  className="rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium text-primary-foreground/85 transition-colors hover:border-teal hover:text-teal"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Button variant="teal" size="xl" className="w-full" onClick={handleParse}>
              <MessageSquareText />
              Parse &amp; Add SMS
            </Button>
            {feedback && (
              <p
                role="status"
                className={cn(
                  "animate-slide-in rounded-lg px-3 py-2 text-sm font-medium",
                  feedback.tone === "success" && "bg-teal/15 text-teal",
                  feedback.tone === "info" && "bg-warning/15 text-warning",
                  feedback.tone === "error" && "bg-destructive/20 text-primary-foreground",
                )}
              >
                {feedback.text}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-2 border-t border-primary-foreground/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">Bank actions</p>
            <Button variant="panel" size="xl" className="w-full justify-start" onClick={handleSync}>
              <RefreshCcw className="text-teal" />
              2. Sync Official Bank Statement
            </Button>
            <Button variant="panelDanger" size="xl" className="w-full justify-start" onClick={handleMismatch}>
              <AlertTriangle />
              3. Simulate Mismatch
            </Button>
            <Button variant="panel" size="xl" className="w-full justify-start" onClick={handleReset}>
              <RotateCcw />
              4. Reset Demo
            </Button>
          </div>
        </div>
      </aside>
    </main>
  );
}

function Banner({ tone, icon, children }: { tone: "warning" | "danger"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex animate-slide-in items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "warning" && "border-warning/40 bg-warning-soft text-warning-strong",
        tone === "danger" && "border-destructive/30 bg-danger-soft text-destructive",
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function TxRow({ tx, mismatch }: { tx: Transaction; mismatch: boolean }) {
  const isDebit = tx.direction === "debit";
  return (
    <li className={cn("flex items-center gap-3 px-5 py-4", mismatch && "bg-danger-soft")}>
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          isDebit ? "bg-secondary text-primary" : "bg-teal-soft text-teal-strong",
        )}
      >
        {isDebit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{tx.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{tx.time}</span>
          {mismatch && <Badge variant="mismatch">MISMATCH DETECTED</Badge>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn("font-display font-bold tabular", isDebit ? "text-foreground" : "text-teal-strong")}>
          {isDebit ? "-" : "+"} {formatRs(tx.amount)}
        </span>
        <Badge variant={tx.status === "PENDING" ? "pending" : "posted"}>{tx.status}</Badge>
      </div>
    </li>
  );
}
