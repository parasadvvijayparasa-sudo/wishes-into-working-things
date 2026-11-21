import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCheck, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MAX_MANUAL_NAME, type Direction, type ManualEntry, type ManualResult } from "@/sdk/liveledger-sdk";

type EntryStatus = NonNullable<ManualEntry["status"]>;

export function ManualEntryDialog({ onAdd }: { onAdd: (entry: ManualEntry) => ManualResult }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<Direction>("debit");
  const [status, setStatus] = useState<EntryStatus>("PENDING");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setAmount("");
    setDirection("debit");
    setStatus("PENDING");
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = onAdd({ name, amount: amount === "" ? Number.NaN : Number(amount), direction, status });
    if (result.status === "ADDED") {
      setOpen(false);
      resetForm();
    } else {
      setError(result.reason === "name" ? "Enter a merchant name." : "Enter an amount above Rs. 0.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="teal" size="sm" className="h-8 gap-1 rounded-lg px-3 text-xs">
          <Plus className="size-3.5" />
          Log Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Log a payment manually</DialogTitle>
          <DialogDescription>For payments where no bank SMS arrived.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="manual-name">Merchant name</Label>
            <Input
              id="manual-name"
              className="h-11 rounded-xl"
              placeholder="e.g. Auto rickshaw"
              maxLength={MAX_MANUAL_NAME}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">Amount (Rs.)</Label>
            <Input
              id="manual-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="h-11 rounded-xl font-semibold tabular"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
          </div>
          <Segmented
            label="Type"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "debit", label: "Debit", icon: <ArrowUpRight /> },
              { value: "credit", label: "Credit", icon: <ArrowDownLeft /> },
            ]}
          />
          <Segmented
            label="Add as"
            value={status}
            onChange={setStatus}
            options={[
              { value: "PENDING", label: "Pending", icon: <Clock /> },
              { value: "VERIFIED_MANUAL", label: "Verified · Manual", icon: <CheckCheck /> },
            ]}
          />
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" variant="teal" size="xl" className="w-full">
              <Plus />
              Add payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors [&_svg]:size-4",
              value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
