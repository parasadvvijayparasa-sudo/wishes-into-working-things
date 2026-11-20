import { describe, expect, it } from "vitest";
import { parseSms } from "@/lib/sms-parser";

describe("parseSms", () => {
  it("reads the default Zomato debit", () => {
    expect(parseSms("Rs. 500.00 debited via UPI to Zomato on 20-11-26")).toMatchObject({
      ok: true, amount: 500, direction: "debit", merchant: "Zomato", channel: "UPI",
    });
  });
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
  it("rejects OTP messages", () => {
    expect(parseSms("123456 is your OTP for a transaction of Rs. 2,000. Do not share.").ok).toBe(false);
  });
  it("rejects promotional messages", () => {
    expect(parseSms("Get Rs. 500 cashback on your first order! Apply now at www.example.com").ok).toBe(false);
  });
});
