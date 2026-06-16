import type { BalanceCell } from "@/lib/types/balance";

export type BalanceReconciliationStatus =
  | "in-sync"
  | "authoritative-overwrite"
  | "stale-optimistic-balance";

export type BalanceReconciliationResult = {
  balance: BalanceCell;
  status: BalanceReconciliationStatus;
  changedFields: Array<keyof BalanceCell>;
};

const comparableFields = [
  "available",
  "pending",
  "used",
  "annualAllowance",
  "version",
  "anniversaryBonusAppliedAt",
] as const satisfies ReadonlyArray<keyof BalanceCell>;

export function reconcileBalance(
  optimistic: BalanceCell,
  authoritative: BalanceCell,
): BalanceReconciliationResult {
  const changedFields = comparableFields.filter(
    (field) => optimistic[field] !== authoritative[field],
  );

  if (changedFields.length === 0) {
    return {
      balance: authoritative,
      status: "in-sync",
      changedFields: [],
    };
  }

  return {
    balance: authoritative,
    status:
      optimistic.version > authoritative.version
        ? "stale-optimistic-balance"
        : "authoritative-overwrite",
    changedFields,
  };
}
