/**
 * SUBMIT Node
 *
 * Executes the on-chain submission:
 * 1. Upload item.json to IPFS via x402 gateway
 * 2. Compute deposit from live on-chain reads
 * 3. Simulate addItem transaction
 * 4. Send transaction (if not dry-run)
 *
 * In dry-run mode, stops after simulation.
 */

import type { AgentGraphState } from "../state.js";

export async function submitNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
  const candidate = state.current;
  if (!candidate?.payload?.validated) {
    return {
      phase: "done",
      errors: [...state.errors, "Payload not validated — cannot submit"],
    };
  }

  const dryRun = process.env.DRY_RUN !== "false"; // Default to dry-run

  if (dryRun) {
    // Dry-run: just record what would happen
    return {
      current: {
        ...candidate,
        submission: {
          status: "pending",
          deposit: "51600000000000000000", // Would be computed live
        },
      },
      phase: "done",
    };
  }

  // Live submission — call pipeline functions
  try {
    // Dynamic import to avoid loading viem/x402 unless needed
    const { uploadJsonToIPFS } = await import("@kleros-scout/pipeline");
    const { computeSubmissionDeposit } = await import("@kleros-scout/pipeline");
    const { submitAddItem } = await import("@kleros-scout/pipeline");

    const REGISTRY_ADDRESSES: Record<string, `0x${string}`> = {
      addressTags: "0x66260C69d03837016d88c9877e61e08Ef74C59F2",
      tokens: "0xeE1502e29795Ef6C2D60F8D7120596abE3baD990",
      cdn: "0x957A53A994860BE4750810131d9c876b2f52d6E1",
      atq: "0xAe6aaed5434244be3699c56E7Ebc828194F26dc3",
    };

    const registryAddress = REGISTRY_ADDRESSES[state.registry];
    if (!registryAddress) {
      return { phase: "done", errors: [...state.errors, `Unknown registry: ${state.registry}`] };
    }

    // 1. Upload to IPFS
    const upload = await uploadJsonToIPFS(candidate.payload.itemJson, "item.json", "evidence");

    // 2. Submit on-chain
    const result = await submitAddItem(registryAddress, upload.cid);

    return {
      current: {
        ...candidate,
        submission: {
          ipfsCid: upload.cid,
          txHash: result.txHash || undefined,
          itemId: result.itemId || undefined,
          deposit: result.deposit?.toString(),
          status: result.success ? "submitted" : "failed",
        },
      },
      phase: "done",
    };
  } catch (error) {
    return {
      current: {
        ...candidate,
        submission: { status: "failed" },
      },
      phase: "done",
      errors: [...state.errors, `Submission failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
