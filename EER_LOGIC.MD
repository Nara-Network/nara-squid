# Expected Exchange Rate (EER) — Technical Specification

## 1. Overview

The Expected Exchange Rate (EER) represents the expected value of one vault share in terms of the vault's base asset (e.g., USDC). It is a forward-looking, model-based metric — not derived from on-chain oracle prices — and is designed to evolve smoothly over time as fees accrue to the vault.

**Core formula:**

```
EER = expectedNetAssets / totalShares
```

When there are no shares outstanding, EER defaults to 1.0 (in base asset decimals).

---

## 2. Net Asset Value (NAV) Decomposition

The vault's expected net assets are decomposed into three buckets:

```
netAssets = idle + divertedValue + borrowedBase
```

| Component | Description |
|---|---|
| **idle** | Base assets sitting in the vault, not lent or deployed to any strategy. |
| **divertedValue** | Current value of assets deployed to yield strategies (e.g., Aave, Compound). Equals invested principal + accumulated strategy returns. |
| **borrowedBase** | Total liability owed by the borrower back to the vault. Includes principal, accrued borrow interest, and accrued commitment fees. |

All amounts are normalized to the vault's base token decimals for uniform arithmetic.

### 2.1 Borrowed Base Breakdown

```
borrowedBase = borrowedPrincipal + accruedBorrowInterest + accruedCommitmentFee
```

- **borrowedPrincipal**: The sum of all drawdowns minus all repayments (topups) to date.
- **accruedBorrowInterest**: Cumulative interest accrued on the borrowed position.
- **accruedCommitmentFee**: Cumulative commitment fee accrued on unutilized capital.

Both interest and commitment fee are **receivables** — they represent amounts owed by the borrower to the vault, so they increase NAV (not decrease it).

---

## 3. Events That Mutate State

The EER model reacts to six types of on-chain events:

| Event | Shares Impact | Idle Impact | Borrowed Impact | Invested Impact |
|---|---|---|---|---|
| **Enter** (deposit) | +minted | +deposited | — | — |
| **Exit** (withdrawal) | -burned | -withdrawn | — | — |
| **Drawdown** (borrower takes funds) | — | -amount | +amount (principal) | — |
| **Topup** (borrower repays) | — | +applied | -applied (principal) | — |
| **Funds Diverted** (strategy deposit) | — | -amount | — | +amount |
| **Funds Reverted** (strategy withdrawal) | — | +full amount | — | -principal returned |

Key details:

- **Topup** repayments are clamped to outstanding principal. Any excess is ignored to preserve NAV consistency.
- **Funds Reverted** may return more than the original principal (due to strategy yield). The full returned amount goes to idle, while only the principal portion is deducted from invested. This implicitly captures strategy yield into NAV.
- **Drawdown/Topup do NOT change shares** — they only shift assets between idle and borrowed buckets.

---

## 4. Fee Accrual Mechanics

Two types of fees accrue continuously over time:

### 4.1 Commitment Fee (on Unutilized Capital)

Charged on capital that is **not lent to the borrower** — i.e., idle funds plus diverted (strategy-deployed) funds.

```
commitmentFee = unutilizedBase * commitFeeRateBps * elapsedSeconds / (10,000 * secondsPerYear)
```

Where:
```
unutilizedBase = idle + divertedValue
```

The commitment fee rate is **tiered** based on utilization (see Section 5).

### 4.2 Borrow Interest (on Borrowed Position)

Charged on the full borrowed base (principal + previously accrued interest + previously accrued commitment fee). This creates **interest-on-interest compounding** at event boundaries.

```
borrowInterest = borrowedBase * borrowRateBps * elapsedSeconds / (10,000 * secondsPerYear)
```

The borrow rate is a fixed annual rate in basis points, configured per vault.

### 4.3 Compounding Behavior

- **Between events within a window**: Simple interest (linear accrual).
- **At event boundaries**: Accrued fees are folded into the base for subsequent segments, creating discrete compounding. Borrow interest for the next segment accrues on the updated `borrowedBase` (which now includes the interest/fees from the previous segment).
- **Between update windows with no events**: Simple interest is recomputed from the last event's base over the growing time delta. This prevents runaway compounding in quiet periods and matches the reference Excel model.

---

## 5. Commitment Fee Tiers

The commitment fee rate depends on **utilization**, which measures how much of the vault's capital is actively lent to the borrower.

### 5.1 Utilization for Tier Selection

```
utilization = borrowedForTier / (idle + divertedValue + borrowedForTier)
```

Where:
```
borrowedForTier = borrowedPrincipal + accruedBorrowInterest
```

**Critically**, `borrowedForTier` excludes the accrued commitment fee to avoid a circular dependency: the commitment fee rate depends on utilization, and utilization should not depend on the commitment fee.

### 5.2 Tier Table

| Utilization Range | Commitment Fee Rate |
|---|---|
| [0%, 10%) | 6.00% (600 bps) |
| [10%, 50%) | 5.00% (500 bps) |
| [50%, 90%) | 3.50% (350 bps) |
| [90%, 100%] | 2.50% (250 bps) |

Higher utilization means more capital is working (lent), so the penalty on idle capital is lower.

### 5.3 Dynamic Tier Recomputation

The tier is **not frozen** at the start of a window. Instead, it is recomputed before each accrual segment. When an event changes the utilization mid-window (e.g., a drawdown increases utilization), the tier may change for subsequent segments within the same window.

---

## 6. Update Timing and Piecewise Accrual

### 6.1 Time Windows

EER updates are gated by a configurable time window (currently 60 minutes). The system computes a **deterministic cutoff timestamp** by flooring the current block time to the window boundary:

```
cutoffTs = floor(blockTimestamp / windowSeconds) * windowSeconds
```

A vault is only updated once per window. This ensures idempotent and restart-safe processing.

### 6.2 Piecewise Accrual Within a Window

Within each update window, accrual is **piecewise** — broken into segments at each event boundary:

1. **For each event** (sorted in on-chain order):
   a. Compute the commitment fee tier using current state.
   b. Accrue fees from the last accrual timestamp to the event's timestamp.
   c. Apply the event (mutate shares, idle, borrowed, invested).
2. **Final segment**: Accrue fees from the last event to the window end.

This ensures that tier changes caused by mid-window events are correctly reflected in the fee calculation for subsequent segments.

### 6.3 Event Ordering

Events within a window are sorted deterministically using four-level ordering:

1. Timestamp (seconds)
2. Block height
3. Log index within the block
4. Transaction hash (tie-breaker)

This guarantees the exact on-chain execution order is reproduced.

---

## 7. Strategy Value Tracking

When vault funds are deployed to yield strategies (e.g., Aave, Compound), the EER model tracks both the **invested principal** and the **effective strategy value** (principal + accumulated returns).

### 7.1 Effective Strategy Value

```
effectiveStrategyValue = investedPrincipal + strategyYield
```

- **investedPrincipal**: Sum of all diverted amounts minus all reverted principal.
- **strategyYield**: Computed from external strategy position snapshots. When a new snapshot reports a value higher than the invested principal, the difference is captured as yield.

### 7.2 Yield Persistence

Strategy yield is persisted separately to prevent yield loss between updates. Without this, a new fund diversion could temporarily make `invested > snapshot`, losing the yield component until the next snapshot refresh.

Yield is only recomputed when a **fresh snapshot** arrives (i.e., the snapshot timestamp has advanced). Between snapshots, the previously computed yield is preserved.

### 7.3 Impact on NAV and Fees

- **NAV**: Uses `effectiveStrategyValue` (not just principal) for the diverted component.
- **Commitment fee**: Accrues on `idle + effectiveStrategyValue` (since diverted funds are considered unutilized from the borrower's perspective).
- **Utilization**: Uses `effectiveStrategyValue` in the denominator for tier selection.

---

## 8. Month-to-Date Tracking and Projections

### 8.1 MTD Accumulators

The system maintains month-to-date (MTD) accumulators for both commitment fees and borrow interest. These reset to zero at each UTC month boundary.

### 8.2 Month-End Projections

At each update, the system projects the expected month-end fee totals by extrapolating the current state (utilization, rates, balances) over the remaining seconds in the month:

```
projectedMonthEnd = mtdAccrued + (currentBase * currentRate * remainingSeconds / (10,000 * secondsPerYear))
```

These projections assume current conditions remain constant for the rest of the month.

---

## 9. Remainder Accumulation (Precision)

Because all arithmetic uses integer (fixed-point) math, each accrual step truncates the fractional part. Over many small time segments, this truncation can accumulate into meaningful drift.

To mitigate this, the system carries forward **remainder numerators** from each accrual computation:

```
fee = (base * rate * dt + previousRemainder) / denominator
newRemainder = (base * rate * dt + previousRemainder) % denominator
```

Remainders are persisted only from event-driven segments (not the final display segment), ensuring the base for subsequent windows is consistent.

---

## 10. Simple Interest Persistence Model

A key design decision is the separation between **base values** (persisted) and **display values** (computed each window):

- **Base values**: Accrued totals are persisted only at event boundaries. If no events occur in a window, the base does not change.
- **Display values**: The final EER and NAV shown in snapshots include the accrual from the last event to the window end. However, this final-segment accrual is **not persisted** to the base.

This means that in a quiet period (no events for multiple windows), each window recomputes simple interest from the same base over an ever-growing time delta. This prevents inter-window compounding and matches the reference Excel model's behavior for periods without activity.

---

## 11. Invariants and Safety Clamps

- **Idle cannot go negative**: All deductions from idle (exits, drawdowns, diversions) are clamped to the available balance.
- **Shares cannot go negative**: Exit events are clamped to available shares.
- **Topups clamped to principal**: Repayments cannot reduce borrowed principal below zero; any excess is ignored.
- **Fees are non-negative**: Accrued fee deltas are clamped to >= 0.
- **NAV is clamped to >= 0**: The persisted net assets value cannot be negative.

---

## 12. Summary of the EER Lifecycle (per update window)

1. **Gate check**: Skip if the vault was already updated in this time window.
2. **Load state**: Restore tracked values (shares, idle, invested, principal, accrued fees, remainders) from the persisted entity.
3. **Load strategy snapshots**: Fetch the latest strategy position value to compute effective diverted value.
4. **Drain event inbox**: Collect all events with timestamps in `(lastAccrualTs, cutoffTs]`, sort deterministically.
5. **Piecewise accrual + event application**: For each event, recompute the tier, accrue fees to the event timestamp, then apply the event.
6. **Final accrual**: Accrue fees from the last event (or last accrual) to the window end.
7. **Save base state**: Persist the base accrual values (from event boundaries only, not the final segment).
8. **Compute display values**: Calculate NAV and EER using the full accrual (including the final segment).
9. **Compute projections**: Extrapolate MTD fees to month end.
10. **Emit snapshot**: Record all values for audit, debugging, and downstream consumption.
