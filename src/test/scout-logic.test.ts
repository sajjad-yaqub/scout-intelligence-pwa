import { describe, expect, it } from "vitest";
import { recentReports, verdictClass, candidateSchema, type SavedReport } from "@/lib/scout-schema";

describe("Scout research logic", () => {
  it("keeps the newest five reports", () => {
    const reports = Array.from({ length: 7 }, (_, index) => ({ company: `Company ${index}`, timestamp: index } as SavedReport));
    const first = reports[0];
    if (!first) throw new Error("Missing report");
    expect(recentReports(reports.slice(1), first).map(item => item.company)).toEqual(["Company 0", "Company 1", "Company 2", "Company 3", "Company 4"]);
  });
  it("replaces same-company history without case sensitivity", () => {
    const old = { company: "Stripe", timestamp: 1 } as SavedReport;
    const newest = { company: "STRIPE", timestamp: 2 } as SavedReport;
    expect(recentReports([old], newest)).toEqual([newest]);
  });
  it("preserves Back, Watch and Pass verdict meanings", () => {
    expect(verdictClass("Back")).toBe("positive");
    expect(verdictClass("Watch")).toBe("warning");
    expect(verdictClass("Pass")).toBe("negative");
  });
  it("rejects non-web source URLs", () => {
    expect(candidateSchema.safeParse({ title: "Bad source", url: "javascript:alert(1)", content: "x" }).success).toBe(false);
  });
});
