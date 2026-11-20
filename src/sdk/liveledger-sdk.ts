/**
 * LiveLedger SDK — drop-in real-time balance & SMS reconciliation engine.
 * Framework-free: a host app only calls the public methods and renders getState().
 */

export type TxStatus = "PENDING" | "POSTED";
export type Direction = "debit" | "credit";
export type Channel = "UPI" | "Card" | "Bank";

export interface Transaction {
  id: string;
  name: string;
  time: string;
  amount: number;
  direction: Direction;
  status: TxStatus;
  ref: string | null;
}

export interface Mismatch {
  txId: string;
  alertAmount: number;
  bankAmount: number;
}

export type IngestStatus = "ADDED" | "DUPLICATE" | "IGNORED_OTP" | "IGNORED_PROMO" | "IGNORED_NOT_TRANSACTION";
export type SdkMethod = "ingestSMS" | "syncStatement" | "simulateMismatch" | "setLowBalanceLimit" | "reset";

export interface SdkEvent {
  method: SdkMethod;
  status: string;
  at: string;
}

export interface LedgerState {
  openingBalance: number;
  confirmedBalance: number;
  liveBalance: number;
  pendingCount: number;
  pendingTotal: number;
  spentToday: number;
  lowBalanceLimit: number;
  isLowBalance: boolean;
  mismatch: Mismatch | null;
  transactions: Transaction[];
  eventLog: SdkEvent[];
}

export type IngestResult =
  | { status: "ADDED"; transaction: Transaction }
  | { status: Exclude<IngestStatus, "ADDED">; transaction?: undefined };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LiveLedgerOptions {
  storage?: StorageLike | null;
  storageKey?: string;
  now?: () => Date;
}

interface StoredState {
  openingBalance: number;
  transactions: Transaction[];
  lowBalanceLimit: number;
  mismatch: Mismatch | null;
  eventLog: SdkEvent[];
}

export const DEFAULT_SMS = "Rs. 500.00 debited via UPI to Zomato on 20-11-26";
export const DEFAULT_STORAGE_KEY = "liveledger-sdk:v1";
const MAX_EVENTS = 10;

function seedState(): StoredState {
  return {
    openingBalance: 12400,
    transactions: [
      { id: "seed-3", name: "Cafe (UPI)", time: "10:44 AM", amount: 200, direction: "debit", status: "PENDING", ref: "641200000003" },
      { id: "seed-2", name: "Cafe (UPI)", time: "10:42 AM", amount: 450, direction: "debit", status: "PENDING", ref: "641200000002" },
      { id: "seed-1", name: "Cafe (UPI)", time: "10:40 AM", amount: 300, direction: "debit", status: "POSTED", ref: "641200000001" },
    ],
    lowBalanceLimit: 11000,
    mismatch: null,
    eventLog: [],
  };
}

/* ---------------- SMS parsing (regex) ---------------- */

export type ParsedSms =
  | { ok: true; amount: number; direction: Direction; merchant: string; channel: Channel; ref: string | null }
  | { ok: false; reason: "otp" | "promo" | "not_transaction" };

const OTP_RE = /\b(otp|one[\s-]?time\s+password|verification\s+code|passcode)\b/i;
const PROMO_RE =
  /\b(offer|offers|cashback|win|won|apply\s+now|pre-?approved|loan|discount|voucher|coupon|reward\s+points?|limited\s+period|click|hurry)\b|https?:\/\/|www\./i;
const ACCOUNT_RE = /\b(a\/c|acct|account|vpa)\b|\bxx\d{2,}/i;
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT_RE = /\b(debited|debit|sent|paid|spent|withdrawn|deducted|transferred\s+to|dr)\b/i;
const CREDIT_RE = /\b(credited|received|deposited|refunded|cr)\b/i;
const REF_RE = /(?:upi\s*ref(?:\s*no)?|ref(?:erence)?(?:\s*no)?|rrn|txn\s*id|utr)[\s.:#-]*(\d{6,})/i;
const VPA_RE = /\b(?:to|from)\s+(?:vpa\s+)?([a-z0-9._-]+)@[a-z0-9.]+/i;
const STOP = String.raw`(?=\s+(?:on|ref|upi|via|at|dated|avl|avbl|bal|using|for|txn|info)\b|\s*[.,;:()]|\s+\d|$)`;
const NAME = String.raw`([a-z][a-z0-9&'\- ]*?)`;
const NOT_ACCOUNT = String.raw`(?!a\/c\b|ac\b|acct\b|your\b|account\b)`;
const TO_RE = new RegExp(String.raw`\bto\s+${NOT_ACCOUNT}${NAME}${STOP}`, "i");
const AT_RE = new RegExp(String.raw`\bat\s+${NAME}${STOP}`, "i");
const FROM_RE = new RegExp(String.raw`\bfrom\s+${NOT_ACCOUNT}${NAME}${STOP}`, "i");

function tidyName(raw: string): string {
  const cleaned = raw.replace(/[._-]+/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown";
  const isMixed = cleaned !== cleaned.toUpperCase() && cleaned !== cleaned.toLowerCase();
  if (isMixed) return cleaned;
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function parseSms(text: string): ParsedSms {
  const sms = text.replace(/\s+/g, " ").trim();
  if (!sms) return { ok: false, reason: "not_transaction" };
  if (OTP_RE.test(sms)) return { ok: false, reason: "otp" };
  if (PROMO_RE.test(sms) && !ACCOUNT_RE.test(sms)) return { ok: false, reason: "promo" };

  const amountMatch = sms.match(AMOUNT_RE);
  const amount = Number((amountMatch?.[1] ?? "").replace(/,/g, ""));
  if (!amountMatch || !Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "not_transaction" };

  const debitIdx = sms.search(DEBIT_RE);
  const creditIdx = sms.search(CREDIT_RE);
  if (debitIdx === -1 && creditIdx === -1) return { ok: false, reason: "not_transaction" };
  const direction: Direction =
    creditIdx === -1 ? "debit" : debitIdx === -1 ? "credit" : debitIdx < creditIdx ? "debit" : "credit";

  let merchant: string | null = sms.match(VPA_RE)?.[1] ?? null;
  if (!merchant) {
    for (const re of direction === "debit" ? [TO_RE, AT_RE] : [FROM_RE]) {
      const name = sms.match(re)?.[1];
      if (name && !/\b(bank|a\/c)\b/i.test(name)) {
        merchant = name;
        break;
      }
    }
  }

  const ref: string | null = sms.match(REF_RE)?.[1] ?? null;
  const channel: Channel =
    /\bupi\b|\bvpa\b|@/i.test(sms) || (ref !== null && ref.length === 12) ? "UPI" : /\bcard\b/i.test(sms) ? "Card" : "Bank";

  return { ok: true, amount, direction, merchant: tidyName(merchant ?? "Unknown"), channel, ref };
}

/* ---------------- Helpers ---------------- */

export function formatRs(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

const signed = (t: Transaction) => (t.direction === "credit" ? t.amount : -t.amount);

function derive(s: StoredState): LedgerState {
  const posted = s.transactions.filter((t) => t.status === "POSTED");
  const pending = s.transactions.filter((t) => t.status === "PENDING");
  const confirmedBalance = s.openingBalance + posted.reduce((sum, t) => sum + signed(t), 0);
  const pendingDebits = pending.filter((t) => t.direction === "debit").reduce((sum, t) => sum + t.amount, 0);
  const pendingCredits = pending.filter((t) => t.direction === "credit").reduce((sum, t) => sum + t.amount, 0);
  const liveBalance = confirmedBalance - pendingDebits + pendingCredits;
  return {
    openingBalance: s.openingBalance,
    confirmedBalance,
    liveBalance,
    pendingCount: pending.length,
    pendingTotal: pendingDebits + pendingCredits,
    spentToday: s.transactions.filter((t) => t.direction === "debit").reduce((sum, t) => sum + t.amount, 0),
    lowBalanceLimit: s.lowBalanceLimit,
    isLowBalance: liveBalance < s.lowBalanceLimit,
    mismatch: s.mismatch,
    transactions: s.transactions.map((t) => ({ ...t })),
    eventLog: s.eventLog.map((e) => ({ ...e })),
  };
}

/* ---------------- SDK ---------------- */

export class LiveLedgerSDK {
  private data: StoredState;
  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();
  private counter = 0;

  constructor(options: LiveLedgerOptions = {}) {
    this.storage = options.storage ?? null;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.now = options.now ?? (() => new Date());
    this.data = this.load();
  }

  ingestSMS(rawText: string): IngestResult {
    const parsed = parseSms(rawText);
    if (!parsed.ok) {
      const status = parsed.reason === "otp" ? "IGNORED_OTP" : parsed.reason === "promo" ? "IGNORED_PROMO" : "IGNORED_NOT_TRANSACTION";
      this.commit("ingestSMS", status);
      return { status };
    }
    if (parsed.ref && this.data.transactions.some((t) => t.ref === parsed.ref)) {
      this.commit("ingestSMS", "DUPLICATE");
      return { status: "DUPLICATE" };
    }
    const now = this.now();
    const transaction: Transaction = {
      id: `tx-${now.getTime()}-${++this.counter}`,
      name: `${parsed.merchant} (${parsed.channel})`,
      time: formatTime(now),
      amount: parsed.amount,
      direction: parsed.direction,
      status: "PENDING",
      ref: parsed.ref,
    };
    this.data = { ...this.data, transactions: [transaction, ...this.data.transactions] };
    this.commit("ingestSMS", "ADDED");
    return { status: "ADDED", transaction: { ...transaction } };
  }

  syncStatement(): { status: "OK"; posted: number } {
    const posted = this.data.transactions.filter((t) => t.status === "PENDING").length;
    this.data = {
      ...this.data,
      transactions: this.data.transactions.map((t) => (t.status === "PENDING" ? { ...t, status: "POSTED" } : t)),
    };
    this.commit("syncStatement", "OK");
    return { status: "OK", posted };
  }

  simulateMismatch(): { status: "OK"; mismatch: Mismatch } | { status: "NO_TRANSACTIONS" } {
    const top = this.data.transactions[0];
    if (!top) {
      this.commit("simulateMismatch", "NO_TRANSACTIONS");
      return { status: "NO_TRANSACTIONS" };
    }
    const mismatch: Mismatch = { txId: top.id, alertAmount: top.amount, bankAmount: top.amount * 10 };
    this.data = { ...this.data, mismatch };
    this.commit("simulateMismatch", "OK");
    return { status: "OK", mismatch: { ...mismatch } };
  }

  setLowBalanceLimit(amount: number): { status: "OK" | "INVALID" } {
    if (!Number.isFinite(amount) || amount < 0) {
      this.commit("setLowBalanceLimit", "INVALID");
      return { status: "INVALID" };
    }
    this.data = { ...this.data, lowBalanceLimit: amount };
    this.commit("setLowBalanceLimit", "OK");
    return { status: "OK" };
  }

  getState(): LedgerState {
    return derive(this.data);
  }

  reset(): { status: "OK" } {
    this.storage?.removeItem(this.storageKey);
    this.data = { ...seedState(), eventLog: [this.event("reset", "OK")] };
    this.emit();
    return { status: "OK" };
  }

  /** Optional: get notified after every state change (used by UI bindings). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private event(method: SdkMethod, status: string): SdkEvent {
    return { method, status, at: this.now().toISOString() };
  }

  private commit(method: SdkMethod, status: string) {
    const [last, ...rest] = this.data.eventLog;
    // Typing a limit fires many calls; keep one log line for a run of identical calls.
    const log =
      last && method === "setLowBalanceLimit" && last.method === method && last.status === status
        ? [this.event(method, status), ...rest]
        : [this.event(method, status), ...this.data.eventLog];
    this.data = { ...this.data, eventLog: log.slice(0, MAX_EVENTS) };
    this.storage?.setItem(this.storageKey, JSON.stringify(this.data));
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private load(): StoredState {
    const seed = seedState();
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return seed;
      const saved = JSON.parse(raw) as Partial<StoredState>;
      return {
        openingBalance: typeof saved.openingBalance === "number" ? saved.openingBalance : seed.openingBalance,
        transactions: Array.isArray(saved.transactions) ? saved.transactions : seed.transactions,
        lowBalanceLimit: typeof saved.lowBalanceLimit === "number" ? saved.lowBalanceLimit : seed.lowBalanceLimit,
        mismatch: saved.mismatch ?? null,
        eventLog: Array.isArray(saved.eventLog) ? saved.eventLog.slice(0, MAX_EVENTS) : [],
      };
    } catch {
      return seed;
    }
  }
}
