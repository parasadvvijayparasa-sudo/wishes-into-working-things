import { parseSms } from "./sms-parser";

export type TxStatus = "PENDING" | "POSTED";

export interface Transaction {
  id: string;
  name: string;
  time: string;
  amount: number;
  direction: "debit" | "credit";
  status: TxStatus;
  ref: string | null;
}

export interface Mismatch {
  txId: string;
  alertAmount: number;
  bankAmount: number;
}

export interface LedgerState {
  /** Balance before any listed transaction; every total is derived from this plus the list. */
  openingBalance: number;
  transactions: Transaction[];
  lowBalanceLimit: number;
  smsText: string;
  mismatch: Mismatch | null;
}

export const DEFAULT_SMS = "Rs. 500.00 debited via UPI to Zomato on 20-11-26";

export function initialState(): LedgerState {
  return {
    openingBalance: 12400,
    transactions: [
      { id: "seed-3", name: "Cafe (UPI)", time: "10:44 AM", amount: 200, direction: "debit", status: "PENDING", ref: "641200000003" },
      { id: "seed-2", name: "Cafe (UPI)", time: "10:42 AM", amount: 450, direction: "debit", status: "PENDING", ref: "641200000002" },
      { id: "seed-1", name: "Cafe (UPI)", time: "10:40 AM", amount: 300, direction: "debit", status: "POSTED", ref: "641200000001" },
    ],
    lowBalanceLimit: 11000,
    smsText: DEFAULT_SMS,
    mismatch: null,
  };
}

const signed = (t: Transaction) => (t.direction === "credit" ? t.amount : -t.amount);

export function computeTotals(state: LedgerState) {
  const posted = state.transactions.filter((t) => t.status === "POSTED");
  const pending = state.transactions.filter((t) => t.status === "PENDING");
  const confirmed = state.openingBalance + posted.reduce((s, t) => s + signed(t), 0);
  const pendingDebits = pending.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount, 0);
  const pendingCredits = pending.filter((t) => t.direction === "credit").reduce((s, t) => s + t.amount, 0);
  const live = confirmed - pendingDebits + pendingCredits;
  return {
    confirmed,
    live,
    pendingCount: pending.length,
    pendingTotal: pendingDebits + pendingCredits,
    spentToday: state.transactions.filter((t) => t.direction === "debit").reduce((s, t) => s + t.amount, 0),
    isLow: live < state.lowBalanceLimit,
  };
}

export type AddSmsResult =
  | { kind: "added"; state: LedgerState; tx: Transaction }
  | { kind: "duplicate"; state: LedgerState }
  | { kind: "not_transaction"; state: LedgerState };

export function addSms(state: LedgerState, text: string, now: Date, id: string): AddSmsResult {
  const parsed = parseSms(text);
  if (!parsed.ok) return { kind: "not_transaction", state };
  if (parsed.ref && state.transactions.some((t) => t.ref === parsed.ref)) {
    return { kind: "duplicate", state };
  }
  const tx: Transaction = {
    id,
    name: `${parsed.merchant} (${parsed.channel})`,
    time: formatTime(now),
    amount: parsed.amount,
    direction: parsed.direction,
    status: "PENDING",
    ref: parsed.ref,
  };
  return { kind: "added", tx, state: { ...state, transactions: [tx, ...state.transactions] } };
}

export function syncStatement(state: LedgerState): LedgerState {
  return {
    ...state,
    transactions: state.transactions.map((t) => (t.status === "PENDING" ? { ...t, status: "POSTED" } : t)),
  };
}

export function simulateMismatch(state: LedgerState): LedgerState {
  const top = state.transactions[0];
  if (!top) return state;
  return { ...state, mismatch: { txId: top.id, alertAmount: top.amount, bankAmount: top.amount * 10 } };
}

export function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatRs(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
