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
  it("starts at Rs. 12,100 confirmed and Rs. 11,450 live with 2 pending", () => {
    const s = sdk().getState();
    expect(s.confirmedBalance).toBe(12100);
    expect(s.liveBalance).toBe(11450);
    expect(s.pendingCount).toBe(2);
    expect(s.pendingTotal).toBe(650);
    expect(s.spentToday).toBe(950);
    expect(s.lowBalanceLimit).toBe(11000);
    expect(s.isLowBalance).toBe(false);
  });
  it("adds a valid SMS as PENDING at the top without changing confirmed", () => {
    const l = sdk();
    expect(l.ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26").status).toBe("ADDED");
    const s = l.getState();
    expect(s.transactions[0]).toMatchObject({ name: "Zomato (UPI)", amount: 500, status: "PENDING" });
    expect(s.confirmedBalance).toBe(12100);
    expect(s.liveBalance).toBe(10950);
    expect(s.isLowBalance).toBe(true);
  });
  it("a pending credit raises live balance but not spent today", () => {
    const l = sdk();
    l.ingestSMS("Rs.1500 credited to A/c XX1234 from VPA ravi@okaxis");
    expect(l.getState().liveBalance).toBe(12950);
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
  it("syncStatement posts everything so confirmed equals live", () => {
    const l = sdk();
    l.syncStatement();
    const s = l.getState();
    expect(s.confirmedBalance).toBe(11450);
    expect(s.liveBalance).toBe(11450);
    expect(s.pendingCount).toBe(0);
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

describe("LiveLedgerSDK persistence and log", () => {
  it("persists state across instances and reset clears storage", () => {
    const storage = memoryStorage();
    sdk(storage).ingestSMS("Rs. 500.00 debited via UPI to Zomato on 20-11-26");
    const again = sdk(storage);
    expect(again.getState().transactions).toHaveLength(4);
    again.reset();
    expect(storage.data.size).toBe(0);
    expect(again.getState().liveBalance).toBe(11450);
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
