import { describe, expect, it } from "vitest";
import { addSms, computeTotals, initialState, simulateMismatch, syncStatement } from "@/lib/liveledger";

const now = new Date(2026, 10, 20, 11, 5);

describe("LiveLedger rules", () => {
  it("starts at Rs. 12,100 confirmed and Rs. 11,450 live", () => {
    const t = computeTotals(initialState());
    expect(t.confirmed).toBe(12100);
    expect(t.live).toBe(11450);
    expect(t.pendingCount).toBe(2);
    expect(t.pendingTotal).toBe(650);
    expect(t.spentToday).toBe(950);
    expect(t.isLow).toBe(false);
  });
  it("adds a parsed SMS as pending without changing confirmed balance", () => {
    const r = addSms(initialState(), "Rs. 500.00 debited via UPI to Zomato on 20-11-26", now, "x");
    expect(r.kind).toBe("added");
    const t = computeTotals(r.state);
    expect(r.state.transactions[0]?.status).toBe("PENDING");
    expect(t.confirmed).toBe(12100);
    expect(t.live).toBe(10950);
    expect(t.isLow).toBe(true);
  });
  it("a pending credit raises the live balance", () => {
    const r = addSms(initialState(), "Rs.1500 credited to A/c XX1234 from VPA ravi@okaxis", now, "c");
    expect(computeTotals(r.state).live).toBe(12950);
  });
  it("does not record the same UPI reference twice", () => {
    const r = addSms(initialState(), "Rs.300.00 debited from A/c XX1234 to VPA cafe@upi (UPI Ref 641200000001)", now, "d");
    expect(r.kind).toBe("duplicate");
  });
  it("syncing the statement makes confirmed equal live with nothing pending", () => {
    const s = syncStatement(initialState());
    const t = computeTotals(s);
    expect(t.confirmed).toBe(11450);
    expect(t.live).toBe(11450);
    expect(t.pendingCount).toBe(0);
  });
  it("mismatch flags the top transaction at ten times the alert", () => {
    const r = addSms(initialState(), "Rs. 500.00 debited via UPI to Zomato on 20-11-26", now, "z");
    const s = simulateMismatch(r.state);
    expect(s.mismatch).toEqual({ txId: "z", alertAmount: 500, bankAmount: 5000 });
  });
});
