import { describe, expect, it } from "vitest";
import { calculatePayoutCents } from "./payout";

describe("payout helpers", () => {
  it("calculates payout in cents using integer floor rounding", () => {
    expect(calculatePayoutCents("1001", 12345)).toBe(1235n);
  });
});
