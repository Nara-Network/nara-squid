import { expect } from "chai";
import {
  accrueFeesBetween,
  computeExchangeRate,
  computeLocalBorrowedBase,
  computeNetAssets,
  getCommitmentFeeRateBps,
} from "../services/eer";

// Characterization suite: pins the CURRENT live EER math exactly as
// implemented. If a product decision changes a formula (e.g. tier boundary
// semantics), change the corresponding fixture in the same commit.

const BPS = 10_000n;
const YEAR = 31_536_000n; // Act/365, matches SECONDS_PER_YEAR in eer.ts

describe("EER math (characterization)", () => {
  describe("getCommitmentFeeRateBps — tier boundaries use strict > (Excel spec 1.2(b))", () => {
    it("0% utilization → 600 bps", () => {
      expect(getCommitmentFeeRateBps(0n)).to.equal(600n);
    });
    it("exactly 10.00% (1000 bps) stays in the 600 bps tier", () => {
      expect(getCommitmentFeeRateBps(1000n)).to.equal(600n);
    });
    it("10.01% (1001 bps) → 500 bps", () => {
      expect(getCommitmentFeeRateBps(1001n)).to.equal(500n);
    });
    it("exactly 50.00% (5000 bps) stays in the 500 bps tier", () => {
      expect(getCommitmentFeeRateBps(5000n)).to.equal(500n);
    });
    it("50.01% (5001 bps) → 350 bps", () => {
      expect(getCommitmentFeeRateBps(5001n)).to.equal(350n);
    });
    it("exactly 90.00% (9000 bps) stays in the 350 bps tier", () => {
      expect(getCommitmentFeeRateBps(9000n)).to.equal(350n);
    });
    it("90.01% (9001 bps) → 250 bps", () => {
      expect(getCommitmentFeeRateBps(9001n)).to.equal(250n);
    });
    it("100% (10000 bps) → 250 bps", () => {
      expect(getCommitmentFeeRateBps(10_000n)).to.equal(250n);
    });
  });

  describe("accrueFeesBetween — Act/365 simple accrual with exact remainder carry", () => {
    const rates = { commitFeeRateBps: 600n, borrowRateBps: 7500n };

    it("one full year of 600 bps on 1,000,000 unutilized = exactly 60,000, zero remainder", () => {
      const r = accrueFeesBetween(
        "0xvault", 0, Number(YEAR), 1_000_000n, 0n, 0n, rates, 0n, 0n,
      );
      expect(r.commitFee).to.equal(60_000n);
      expect(r.commitFeeRemainder).to.equal(0n);
      expect(r.dtSec).to.equal(Number(YEAR));
    });

    it("commitment fee base is idle + diverted value", () => {
      const split = accrueFeesBetween(
        "0xvault", 0, Number(YEAR), 600_000n, 400_000n, 0n, rates, 0n, 0n,
      );
      const merged = accrueFeesBetween(
        "0xvault", 0, Number(YEAR), 1_000_000n, 0n, 0n, rates, 0n, 0n,
      );
      expect(split.commitFee).to.equal(merged.commitFee);
    });

    it("borrow interest accrues on the FULL borrowed base (interest-on-interest, Excel behavior)", () => {
      // base = principal 1,000,000 + already-accrued interest/fees 10,000
      const r = accrueFeesBetween(
        "0xvault", 0, Number(YEAR), 0n, 0n, 1_010_000n, rates, 0n, 0n,
      );
      expect(r.borrowInterest).to.equal((1_010_000n * 7500n) / BPS); // 757,500
    });

    it("remainder carry makes split segments equal one whole segment exactly", () => {
      const t1 = 1_234_567;
      const t2 = 9_876_543;
      const whole = accrueFeesBetween(
        "0xvault", 0, t2, 123_456_789n, 55_555n, 777_777n, rates, 0n, 0n,
      );
      const a = accrueFeesBetween(
        "0xvault", 0, t1, 123_456_789n, 55_555n, 777_777n, rates, 0n, 0n,
      );
      const b = accrueFeesBetween(
        "0xvault", t1, t2, 123_456_789n, 55_555n, 777_777n, rates,
        a.commitFeeRemainder, a.borrowInterestRemainder,
      );
      expect(a.commitFee + b.commitFee).to.equal(whole.commitFee);
      expect(b.commitFeeRemainder).to.equal(whole.commitFeeRemainder);
      expect(a.borrowInterest + b.borrowInterest).to.equal(whole.borrowInterest);
      expect(b.borrowInterestRemainder).to.equal(whole.borrowInterestRemainder);
    });

    it("sub-denominator windows truncate to zero fee but preserve the fraction in the remainder", () => {
      const r = accrueFeesBetween(
        "0xvault", 0, 1, 1_000_000n, 0n, 0n, rates, 0n, 0n,
      );
      expect(r.commitFee).to.equal(0n);
      expect(r.commitFeeRemainder).to.equal(1_000_000n * 600n); // numerator carried whole
    });

    it("zero/negative window is a no-op that preserves incoming remainders", () => {
      const r = accrueFeesBetween(
        "0xvault", 100, 100, 1n, 1n, 1n, rates, 42n, 43n,
      );
      expect(r.commitFee).to.equal(0n);
      expect(r.borrowInterest).to.equal(0n);
      expect(r.commitFeeRemainder).to.equal(42n);
      expect(r.borrowInterestRemainder).to.equal(43n);
    });
  });

  describe("computeExchangeRate", () => {
    const SHARE_DEC = 10n ** 6n; // 6-decimal share factor (USDC-style vault)

    it("zero shares → exactly 1.0", () => {
      expect(computeExchangeRate(123n, 0n, SHARE_DEC)).to.equal(SHARE_DEC);
    });
    it("non-positive net assets → 0", () => {
      expect(computeExchangeRate(0n, 5n, SHARE_DEC)).to.equal(0n);
      expect(computeExchangeRate(-1n, 5n, SHARE_DEC)).to.equal(0n);
    });
    it("floors toward zero", () => {
      expect(computeExchangeRate(10n, 3n, SHARE_DEC)).to.equal(3_333_333n);
    });
  });

  describe("net asset composition", () => {
    it("borrowedBase = principal + interest + commitment fee (receivables ADD to NAV)", () => {
      expect(computeLocalBorrowedBase(100n, 10n, 5n)).to.equal(115n);
    });
    it("netAssets = idle + divertedValue + borrowedBase", () => {
      expect(computeNetAssets(1000n, 200n, 100n, 10n, 5n)).to.equal(1315n);
    });
  });
});
