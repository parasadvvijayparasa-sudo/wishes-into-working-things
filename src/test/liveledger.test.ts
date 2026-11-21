import { describe, expect, it } from "vitest";
import { LiveLedgerSDK, parseSms, type StorageLike } from "@/sdk/liveledger-sdk";

const now = () => new Date(2026, 10, 20, 11, 5);
const sdk = (storage: StorageLike | null = null) => new LiveLedgerSDK({ now, storage });

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("LiveLedgerSDK balances", () => {
  it("starts at Rs. 12,100 verified and Rs. 11,450 projected with 2 pending", () => {
    const s = sdk().getState();
    expect(s.verifiedBalance).toBe(12100);
    expect(s.projectedBalance).toBe(11450);
    expect(s.pendingCount).toBe(2);
    expect(s.pendingTotal).toBe(650);
    expect(s.spentToday).toBe(950);
    expect(s.lowBalanceLimit).toBe(11000);
    expect(s.isLowBalance).toBe(false);
  });
  it("adds a valid SMS as PENDING from SMS at the top without changing verified", () => {
    const l = sdk();
    expect(l.ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26").status).toBe("ADDED");
    const s = l.getState();
    expect(s.transactions[0]).toMatchObject({ name: "Zomato (UPI)", amount: 500, status: "PENDING", source: "SMS" });
    expect(s.verifiedBalance).toBe(12100);
    expect(s.projectedBalance).toBe(10950);
    expect(s.isLowBalance).toBe(true);
  });
  it("a pending credit raises projected balance but not spent today", () => {
    const l = sdk();
    l.ingestSMS("Rs.1500 credited to A/c XX1234 from VPA ravi@okaxis");
    expect(l.getState().projectedBalance).toBe(12950);
    expect(l.getState().spentToday).toBe(950);
  });
  it("blocks a duplicate UPI Ref", () => {
    expect(sdk().ingestSMS("Rs.300.00 debited from A/c XX1234 to VPA cafe@upi (UPI Ref 641200000001)").status).toBe("DUPLICATE");
  });
  it("ignores OTP and promo texts", () => {
    const l = sdk();
    expect(l.ingestSMS("123456 is your OTP for a transaction of Rs. 2,000. Do not share.").status).toBe("IGNORED_OTP");
    expect(l.ingestSMS("Get Rs. 500 cashback! Apply now at www.example.com").status).toBe("IGNORED_PROMO");
    expect(l.getState().transactions).toHaveLength(3);
  });
  it("syncStatement verifies every pending entry via the bank", () => {
    const l = sdk();
    l.syncStatement();
    const s = l.getState();
    expect(s.verifiedBalance).toBe(11450);
    expect(s.projectedBalance).toBe(11450);
    expect(s.pendingCount).toBe(0);
    expect(s.transactions.every((t) => t.status === "VERIFIED_SMS")).toBe(true);
  });
  it("simulateMismatch flags the top transaction at ten times the alert", () => {
    const l = sdk();
    l.ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26");
    l.simulateMismatch();
    const s = l.getState();
    expect(s.mismatch).toEqual({ txId: s.transactions[0]?.id, alertAmount: 500, bankAmount: 5000 });
  });
  it("setLowBalanceLimit changes when the low-balance alert fires", () => {
    const l = sdk();
    l.setLowBalanceLimit(12000);
    expect(l.getState().isLowBalance).toBe(true);
  });
});

describe("LiveLedgerSDK pending vs verified", () => {
  it("every seed entry has a status and an SMS source", () => {
    expect(sdk().getState().transactions.map((t) => [t.status, t.source])).toEqual([
      ["PENDING", "SMS"],
      ["PENDING", "SMS"],
      ["VERIFIED_SMS", "SMS"],
    ]);
  });
  it("confirming a pending entry marks it VERIFIED_MANUAL and moves it into the verified balance", () => {
    const l = sdk();
    expect(l.confirmTransaction("seed-2").status).toBe("OK");
    const s = l.getState();
    expect(s.transactions.find((t) => t.id === "seed-2")?.status).toBe("VERIFIED_MANUAL");
    expect(s.verifiedBalance).toBe(11650);
    expect(s.projectedBalance).toBe(11450);
    expect(s.pendingCount).toBe(1);
    expect(s.pendingTotal).toBe(200);
  });
  it("cannot confirm an already verified or unknown entry", () => {
    const l = sdk();
    expect(l.confirmTransaction("seed-1").status).toBe("ALREADY_VERIFIED");
    expect(l.confirmTransaction("nope").status).toBe("NOT_FOUND");
    expect(l.getState().verifiedBalance).toBe(12100);
    expect(l.getState().eventLog[0]).toMatchObject({ method: "confirmTransaction", status: "NOT_FOUND" });
  });
  it("syncStatement leaves manually confirmed entries as VERIFIED_MANUAL", () => {
    const l = sdk();
    l.confirmTransaction("seed-3");
    l.syncStatement();
    expect(l.getState().transactions.map((t) => t.status)).toEqual(["VERIFIED_MANUAL", "VERIFIED_SMS", "VERIFIED_SMS"]);
  });
  it("upgrades entries saved by the older version", () => {
    const storage = memoryStorage();
    storage.setItem("liveledger-sdk:v1", JSON.stringify({
      openingBalance: 12400, lowBalanceLimit: 11000, mismatch: null, eventLog: [],
      transactions: [{ id: "old", name: "Cafe (UPI)", time: "10:40 AM", amount: 300, direction: "debit", status: "POSTED", ref: null }],
    }));
    expect(sdk(storage).getState().transactions[0]).toMatchObject({ status: "VERIFIED_SMS", source: "SMS" });
    expect(sdk(storage).getState().verifiedBalance).toBe(12100);
  });
});

describe("LiveLedgerSDK persistence and log", () => {
  it("persists state across instances and reset clears storage", () => {
    const storage = memoryStorage();
    sdk(storage).ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26");
    const again = sdk(storage);
    expect(again.getState().transactions).toHaveLength(4);
    again.reset();
    expect(storage.data.size).toBe(0);
    expect(again.getState().projectedBalance).toBe(11450);
    expect(again.getState().mismatch).toBeNull();
  });
  it("logs method calls with statuses and keeps only the last 10", () => {
    const l = sdk();
    l.ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26");
    l.ingestSMS("Your OTP is 1234");
    l.syncStatement();
    expect(l.getState().eventLog.map((e) => `${e.method}() -> ${e.status}`)).toEqual([
      "syncStatement() -> OK",
      "ingestSMS() -> IGNORED_OTP",
      "ingestSMS() -> ADDED",
    ]);
    for (let i = 0; i < 12; i++) l.syncStatement();
    expect(l.getState().eventLog).toHaveLength(10);
  });
});

describe("parseSms formats", () => {
  it("reads a VPA debit with UPI ref", () => {
    expect(parseSms("Rs.300.00 debited from A/c XX1234 to VPA cafe@upi (UPI Ref 641200000001)")).toMatchObject({
      ok: true, amount: 300, direction: "debit", merchant: "Cafe", ref: "641200000001",
    });
  });
  it("reads an HDFC Sent message", () => {
    expect(parseSms("Sent Rs.200 from HDFC Bank To CAFE On 19/11/26 Ref 641200000003")).toMatchObject({
      ok: true, amount: 200, direction: "debit", merchant: "Cafe", ref: "641200000003",
    });
  });
  it("reads a credit from a VPA", () => {
    expect(parseSms("Rs.1500 credited to A/c XX1234 from VPA ravi@okaxis")).toMatchObject({
      ok: true, amount: 1500, direction: "credit", merchant: "Ravi",
    });
  });
});
