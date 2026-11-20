import { useState } from "react";
import { Code2, LayoutDashboard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { HostAppDemo } from "./HostAppDemo";
import { SdkInspector } from "./SdkInspector";
import { useLiveLedger } from "./use-ledger";

type Tab = "host" | "inspector";

export function Dashboard() {
  const { ledger, state } = useLiveLedger();
  const [tab, setTab] = useState<Tab>("host");

  return (
    <div className="min-h-screen">
      <header className="bg-header text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-primary">
                <Zap className="size-5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">LiveLedger SDK</h1>
                <p className="text-sm text-primary-foreground/70">
                  Drop-in real-time balance &amp; SMS reconciliation engine for Indian banking apps
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium text-primary-foreground/80">
              <span className="size-1.5 rounded-full bg-teal animate-pulse-dot" />
              Prototype: Simulated Host App + Live SDK
            </span>
          </div>

          <div role="tablist" aria-label="View" className="mt-5 flex gap-1">
            <TabButton active={tab === "host"} onClick={() => setTab("host")} icon={<LayoutDashboard className="size-4" />}>
              Host App Demo
            </TabButton>
            <TabButton active={tab === "inspector"} onClick={() => setTab("inspector")} icon={<Code2 className="size-4" />}>
              SDK Inspector
            </TabButton>
          </div>
        </div>
      </header>

      {tab === "host" ? <HostAppDemo ledger={ledger} state={state} /> : <SdkInspector state={state} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition-colors",
        active ? "bg-background text-foreground" : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
