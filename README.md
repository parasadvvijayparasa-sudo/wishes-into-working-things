# LiveLedger: Your real balance, right now

**Team Phoenix, Sanskaram University | Innovate India Hackathon 2026**

Bank balances can lag an hour or more behind real UPI spending. LiveLedger is an on-device, drop-in TypeScript SDK (`LiveLedgerSDK`) that parses instant UPI/bank SMS alerts, shows a **Projected Balance** alongside your **Verified Balance**, supports manual fallback logging when no SMS arrives, and reconciles everything against bank statements while flagging mismatches.

**Live Demo:** [Open LiveLedger Prototype](YOUR_LOVABLE_URL_HERE) *(Uses simulated data; no real bank connection or passwords required.)*

## How It Works
`SMS Alert (or Manual Entry) → Pending → Projected Balance updates → One-tap Confirm or Bank Statement Sync → Verified Balance & Mismatch Check`

**Formula:** `Projected Balance = Verified Balance - Pending Debits + Pending Credits`

## Key Features
- **On-device SMS Parser:** Extracts amount, debit/credit direction, merchant, channel, and reference ID while ignoring OTPs, promotional spam, and duplicate alerts.
- **Verified vs. Projected Balance:** Clearly separates bank/user-verified funds from pending spends so users see their true spendable balance immediately.
- **No-SMS / Cash Fallback (`+ Log Manual`):** Lets users log cash spends or missed-SMS payments as either `Pending` or `Verified · Manual`.
- **One-tap Reconciliation (`Confirm` & Statement Sync):** Confirm individual pending rows manually or reconcile all pending transactions in bulk via simulated bank statement sync.
- **Real-Time Low-Balance Alert:** Warns users the moment pending spends push their Projected Balance below their custom threshold.
- **Mismatch Detection:** Flags discrepancies when an SMS alert amount does not match the official bank statement.
- **Drop-in SDK Architecture:** Includes both a **Host App Demo** and an interactive **SDK Inspector** showing live state and SDK method calls.

## Limitations & Future Scope
- **Current Limitation:** Projected balance is an on-device estimate until verified by the user or reconciled with the bank statement.
- **Roadmap:** Android Notification Listener integration (with explicit user consent), broader Indian bank/UPI SMS templates, and RBI Account Aggregator (AA) integration for direct bank verification.
-
