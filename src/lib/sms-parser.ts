export type ParsedSms =
  | {
      ok: true;
      amount: number;
      direction: "debit" | "credit";
      merchant: string;
      channel: "UPI" | "Card" | "Bank";
      ref: string | null;
    }
  | { ok: false; reason: "not_transaction" };

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
const TO_RE = new RegExp(String.raw`\bto\s+(?!a\/c\b|ac\b|acct\b|your\b|account\b)${NAME}${STOP}`, "i");
const AT_RE = new RegExp(String.raw`\bat\s+${NAME}${STOP}`, "i");
const FROM_RE = new RegExp(
  String.raw`\bfrom\s+(?!a\/c\b|ac\b|acct\b|your\b|account\b)${NAME}${STOP}`,
  "i",
);

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
  if (!sms || OTP_RE.test(sms)) return { ok: false, reason: "not_transaction" };
  if (PROMO_RE.test(sms) && !ACCOUNT_RE.test(sms)) return { ok: false, reason: "not_transaction" };

  const amountMatch = sms.match(AMOUNT_RE);
  if (!amountMatch) return { ok: false, reason: "not_transaction" };
  const amount = Number((amountMatch[1] ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "not_transaction" };

  const debitIdx = sms.search(DEBIT_RE);
  const creditIdx = sms.search(CREDIT_RE);
  if (debitIdx === -1 && creditIdx === -1) return { ok: false, reason: "not_transaction" };
  const direction: "debit" | "credit" =
    creditIdx === -1 ? "debit" : debitIdx === -1 ? "credit" : debitIdx < creditIdx ? "debit" : "credit";

  const vpa = sms.match(VPA_RE);
  let merchant: string | null = vpa?.[1] ?? null;
  if (!merchant) {
    const patterns = direction === "debit" ? [TO_RE, AT_RE] : [FROM_RE];
    for (const re of patterns) {
      const m = sms.match(re);
      const name = m?.[1];
      if (name && !/\b(bank|a\/c)\b/i.test(name)) {
        merchant = name;
        break;
      }
    }
  }

  const refMatch = sms.match(REF_RE);
  const ref: string | null = refMatch?.[1] ?? null;
  const channel: "UPI" | "Card" | "Bank" =
    /\bupi\b|\bvpa\b|@/i.test(sms) || (ref !== null && ref.length === 12)
      ? "UPI"
      : /\bcard\b/i.test(sms)
        ? "Card"
        : "Bank";

  return { ok: true, amount, direction, merchant: tidyName(merchant ?? "Unknown"), channel, ref };
}
