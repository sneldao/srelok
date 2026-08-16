/**
 * Pure challenge-window / close-out assessment.
 *
 * Given live `getItemInfo` + `getRequestInfo` + `challengePeriodDuration`,
 * decide whether a submission is still pending, accepted, challenged, rejected,
 * or ready for `executeRequest`.
 */

import { ItemStatus, type ItemInfo, type RequestInfo } from "../utils/registry.js";

export type TrackedVerdict =
  | "absent"
  | "registered"
  | "pending"
  | "challenged"
  | "executable"
  | "rejected"
  | "clearing";

export interface ItemAssessment {
  status: ItemStatus;
  statusLabel: string;
  verdict: TrackedVerdict;
  /** True when the challenge window has elapsed and executeRequest can finalize. */
  canExecute: boolean;
  disputed: boolean;
  resolved: boolean;
  submissionTime?: number;
  windowEndsAt?: number;
  secondsRemaining?: number;
  ruling?: number;
  reason: string;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  [ItemStatus.Absent]: "Absent",
  [ItemStatus.Registered]: "Registered",
  [ItemStatus.RegistrationRequested]: "RegistrationRequested",
  [ItemStatus.ClearingRequested]: "ClearingRequested",
};

/**
 * Map on-chain item + latest request onto a submission verdict.
 *
 * LGTCR close-out: after `challengePeriodDuration` with no dispute, anyone
 * may call `executeRequest(itemID)` to move RegistrationRequested → Registered
 * (or ClearingRequested → Absent).
 */
export function assessItemState(
  item: ItemInfo,
  request: RequestInfo | null,
  challengePeriodDuration: bigint,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): ItemAssessment {
  const statusLabel = STATUS_LABEL[item.status] ?? String(item.status);
  const disputed = request?.disputed ?? false;
  const resolved = request?.resolved ?? false;
  const submissionTime = request ? Number(request.submissionTime) : undefined;
  const windowEndsAt =
    submissionTime !== undefined
      ? submissionTime + Number(challengePeriodDuration)
      : undefined;
  const secondsRemaining =
    windowEndsAt !== undefined ? Math.max(0, windowEndsAt - nowSeconds) : undefined;
  const windowExpired =
    windowEndsAt !== undefined ? nowSeconds >= windowEndsAt : false;

  const pendingRequest =
    item.status === ItemStatus.RegistrationRequested ||
    item.status === ItemStatus.ClearingRequested;
  const canExecute = pendingRequest && !disputed && !resolved && windowExpired;

  if (item.status === ItemStatus.Registered) {
    return {
      status: item.status,
      statusLabel,
      verdict: "registered",
      canExecute: false,
      disputed,
      resolved,
      submissionTime,
      windowEndsAt,
      secondsRemaining: 0,
      ruling: request?.ruling,
      reason: "Item is registered (accepted)",
    };
  }

  if (item.status === ItemStatus.Absent) {
    const rejectedAfterRequest =
      request !== null && resolved && (request.ruling === 2 || disputed);
    return {
      status: item.status,
      statusLabel,
      verdict: rejectedAfterRequest ? "rejected" : "absent",
      canExecute: false,
      disputed,
      resolved,
      submissionTime,
      windowEndsAt,
      secondsRemaining: 0,
      ruling: request?.ruling,
      reason: rejectedAfterRequest
        ? "Request resolved against the submitter"
        : "Item is absent from the registry",
    };
  }

  if (disputed && !resolved) {
    return {
      status: item.status,
      statusLabel,
      verdict: "challenged",
      canExecute: false,
      disputed,
      resolved,
      submissionTime,
      windowEndsAt,
      secondsRemaining,
      ruling: request?.ruling,
      reason: "Active dispute — waiting on Kleros Court",
    };
  }

  if (canExecute) {
    return {
      status: item.status,
      statusLabel,
      verdict: "executable",
      canExecute: true,
      disputed,
      resolved,
      submissionTime,
      windowEndsAt,
      secondsRemaining: 0,
      ruling: request?.ruling,
      reason:
        item.status === ItemStatus.ClearingRequested
          ? "Clearing window elapsed with no dispute — executeRequest will finalize removal"
          : "Challenge window elapsed with no dispute — executeRequest will finalize registration",
    };
  }

  if (item.status === ItemStatus.ClearingRequested) {
    return {
      status: item.status,
      statusLabel,
      verdict: "clearing",
      canExecute: false,
      disputed,
      resolved,
      submissionTime,
      windowEndsAt,
      secondsRemaining,
      ruling: request?.ruling,
      reason: "Removal requested; challenge window still open",
    };
  }

  return {
    status: item.status,
    statusLabel,
    verdict: "pending",
    canExecute: false,
    disputed,
    resolved,
    submissionTime,
    windowEndsAt,
    secondsRemaining,
    ruling: request?.ruling,
    reason:
      secondsRemaining !== undefined
        ? `In challenge window (${secondsRemaining}s remaining)`
        : "Registration requested",
  };
}

/** Map a tracked verdict onto the submission-record status field. */
export function verdictToRecordStatus(
  verdict: TrackedVerdict
): "submitted" | "accepted" | "challenged" | "rejected" {
  switch (verdict) {
    case "registered":
      return "accepted";
    case "challenged":
      return "challenged";
    case "rejected":
    case "absent":
      return "rejected";
    default:
      return "submitted";
  }
}
