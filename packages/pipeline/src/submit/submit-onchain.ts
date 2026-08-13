/**
 * On-chain Submission
 *
 * Calls addItem on a LightGeneralizedTCR registry contract on Gnosis Chain.
 *
 * Flow:
 * 1. Create wallet client from private key
 * 2. Encode addItem calldata with /ipfs/<CID>
 * 3. Simulate the transaction (catch reverts before spending gas)
 * 4. Send the transaction with msg.value = total deposit
 * 5. Wait for confirmation
 *
 * Source: kleros-curate/references/light-curate.md
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { gnosis } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { lightCurateAbi } from "../utils/abi.js";
import { computeSubmissionDeposit } from "../utils/registry.js";
import { log } from "../utils/logger.js";

// --- Types ---

export interface SubmissionResult {
  success: boolean;
  txHash?: Hex;
  receipt?: TransactionReceipt;
  itemId?: Hex;
  deposit?: bigint;
  error?: string;
}

export interface SimulationResult {
  success: boolean;
  gasEstimate?: bigint;
  deposit: bigint;
  error?: string;
}

// --- Core ---

/**
 * Simulate an addItem transaction without sending it.
 * Use this for dry-runs and pre-submission validation.
 */
export async function simulateAddItem(
  registryAddress: Address,
  ipfsCid: string
): Promise<SimulationResult> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    return {
      success: false,
      deposit: 0n,
      error: "PRIVATE_KEY not set — cannot simulate",
    };
  }

  const rpcUrl = process.env.RPC_GNOSIS || "https://rpc.gnosischain.com";
  const account = privateKeyToAccount(privateKey as Hex);

  const client = createPublicClient({
    chain: gnosis,
    transport: http(rpcUrl),
  });

  log.info(`Simulating addItem on ${registryAddress}...`);
  log.info(`Item data: ${ipfsCid}`);

  // Compute deposit
  const { totalDeposit } = await computeSubmissionDeposit(registryAddress);

  try {
    // Simulate the call
    const { request } = await client.simulateContract({
      address: registryAddress,
      abi: parseAbi(["function addItem(string _item) external payable"]),
      functionName: "addItem",
      args: [ipfsCid],
      value: totalDeposit,
      account,
    });

    // Estimate gas
    const gasEstimate = await client.estimateContractGas({
      address: registryAddress,
      abi: parseAbi(["function addItem(string _item) external payable"]),
      functionName: "addItem",
      args: [ipfsCid],
      value: totalDeposit,
      account,
    });

    log.info(`Simulation passed. Gas estimate: ${gasEstimate}`);
    log.info(`Deposit: ${totalDeposit} wei (${Number(totalDeposit) / 1e18} xDAI)`);

    return {
      success: true,
      gasEstimate,
      deposit: totalDeposit,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error(`Simulation FAILED: ${msg}`);
    return {
      success: false,
      deposit: totalDeposit,
      error: msg,
    };
  }
}

/**
 * Submit an item to a registry on-chain.
 *
 * IMPORTANT: Always simulate first. Never call this without prior validation.
 */
export async function submitAddItem(
  registryAddress: Address,
  ipfsCid: string
): Promise<SubmissionResult> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    return { success: false, error: "PRIVATE_KEY not set" };
  }

  const rpcUrl = process.env.RPC_GNOSIS || "https://rpc.gnosischain.com";
  const account = privateKeyToAccount(privateKey as Hex);

  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: gnosis,
    transport: http(rpcUrl),
    account,
  });

  log.info(`=== SUBMITTING ON-CHAIN ===`);
  log.info(`Registry: ${registryAddress}`);
  log.info(`Item: ${ipfsCid}`);
  log.info(`Account: ${account.address}`);

  // Compute deposit (fresh read — never use cached values)
  const { totalDeposit } = await computeSubmissionDeposit(registryAddress);
  log.info(`Deposit: ${totalDeposit} wei (${Number(totalDeposit) / 1e18} xDAI)`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < totalDeposit) {
    return {
      success: false,
      deposit: totalDeposit,
      error: `Insufficient balance. Need ${Number(totalDeposit) / 1e18} xDAI, have ${Number(balance) / 1e18} xDAI`,
    };
  }

  // Simulate first
  log.info("Running pre-submission simulation...");
  const sim = await simulateAddItem(registryAddress, ipfsCid);
  if (!sim.success) {
    return {
      success: false,
      deposit: totalDeposit,
      error: `Simulation failed: ${sim.error}`,
    };
  }

  // Send transaction
  log.info("Sending transaction...");
  try {
    const txHash = await walletClient.writeContract({
      address: registryAddress,
      abi: parseAbi(["function addItem(string _item) external payable"]),
      functionName: "addItem",
      args: [ipfsCid],
      value: totalDeposit,
    });

    log.info(`Transaction sent: ${txHash}`);
    log.info("Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      // Extract itemId from NewItem event in receipt logs
      const newItemTopic =
        "0x26b762946e498e0eab7bdfa5f1c17bae0f3299e2a8b377741c21a7c0b7e2b667"; // keccak256("NewItem(bytes32,string,bool)")
      const newItemLog = receipt.logs.find(
        (l) => l.topics[0]?.toLowerCase() === newItemTopic.toLowerCase()
      );
      const itemId = newItemLog?.topics[1] as Hex | undefined;

      log.info(`=== SUBMISSION SUCCESSFUL ===`);
      log.info(`TX: ${txHash}`);
      log.info(`Block: ${receipt.blockNumber}`);
      if (itemId) log.info(`Item ID: ${itemId}`);

      return {
        success: true,
        txHash,
        receipt,
        itemId,
        deposit: totalDeposit,
      };
    } else {
      log.error("Transaction reverted on-chain");
      return {
        success: false,
        txHash,
        receipt,
        deposit: totalDeposit,
        error: "Transaction reverted",
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error(`Submission failed: ${msg}`);
    return {
      success: false,
      deposit: totalDeposit,
      error: msg,
    };
  }
}
