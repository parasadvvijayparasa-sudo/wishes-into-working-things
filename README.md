# LiveLedger: Your real balance, right now
Team Phoenix, Sanskaram University | Innovate India Hackathon 2026

Bank balances can lag an hour or more behind real spending. LiveLedger parses instant UPI alerts,
shows a live balance (confirmed balance minus pending payments), and reconciles it with the bank statement,
flagging mismatches.

Live demo: <paste your Lovable link>
Prototype uses simulated data. No real bank connection.

How it works: Alert -> Pending -> Live balance -> Bank statement -> Reconcile
Live balance = Confirmed balance - Pending debits + Pending credits

Features: SMS parser (debit/credit, several formats, ignores OTP, duplicate detection),
live vs confirmed balance, low-balance alert, statement sync, mismatch detection.

Limitations: the live balance is an estimate until the bank confirms it. A real app would read SMS or
notifications on the device with the user's permission.
Future work: Android notification listener, more banks, Account Aggregator consent.
