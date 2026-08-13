/**
 * Explorer Tag Checker
 *
 * Quick utility to check if an address is tagged on a chain's explorer.
 *
 * Usage: npm run check-explorer -- --address 0x... --chain base
 */

import { isTaggedOnExplorer } from "../src/utils/explorer.js";
import { getChain } from "../src/utils/config.js";

async function main() {
  const args = process.argv.slice(2);
  const addrIdx = args.indexOf("--address");
  const chainIdx = args.indexOf("--chain");

  const address = addrIdx >= 0 ? args[addrIdx + 1] : undefined;
  const chainKey = chainIdx >= 0 ? args[chainIdx + 1] : undefined;

  if (!address || !chainKey) {
    console.log("Usage: npm run check-explorer -- --address 0x... --chain <chain>");
    process.exit(1);
  }

  const chain = getChain(chainKey);
  console.log(`Checking ${address} on ${chain.name} (${chain.explorer})...\n`);

  const result = await isTaggedOnExplorer(address, chainKey);

  if (result.error) {
    console.log(`Warning: ${result.error}`);
  }

  if (result.tagged) {
    console.log(`TAGGED: "${result.label}"`);
    console.log(`This address is NOT eligible for Scout rewards on ${chainKey}.`);
  } else {
    console.log(`NOT TAGGED`);
    console.log(`This address IS eligible for Scout rewards on ${chainKey}.`);
  }
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
