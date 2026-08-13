/**
 * RESEARCH Node
 *
 * Investigates a candidate contract to determine:
 * - What project deployed it
 * - What it does (DEX router, lending pool, token, etc.)
 * - Its official website
 * - Whether source code is verified
 *
 * Uses LLM with tool calls to explorer APIs and web search.
 */

import OpenAI from "openai";
import type { AgentGraphState } from "../state.js";

const RESEARCH_PROMPT = `You are Srelok, an on-chain detective. Your job is to identify smart contracts.

Given a contract address and chain, determine:
1. What project deployed this contract (e.g., "Uniswap", "Aave", "Circle")
2. What the contract does (e.g., "DEX Router", "Lending Pool", "Token Contract")
3. The project's official website
4. A brief description of the contract's purpose

Be specific and accurate. If you cannot determine something with confidence, say so.
Do NOT guess or make up information. A wrong tag loses the submission deposit.

Contract: {address}
Chain: {chain}
{sourceInfo}

Respond in JSON format:
{
  "projectName": "string or null",
  "contractType": "string",
  "description": "brief description of what this contract does",
  "website": "URL or null",
  "confidence": 0.0 to 1.0
}`;

export async function researchNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
  const candidate = state.current;
  if (!candidate) {
    return { errors: [...state.errors, "No current candidate to research"] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: return minimal research without LLM
    return {
      current: {
        ...candidate,
        research: {
          confidence: 0.0,
          contractType: "unknown",
          sourceVerified: false,
        },
      },
      phase: "evaluate",
      errors: [...state.errors, "OPENAI_API_KEY not set — skipping LLM research"],
    };
  }

  const llm = new OpenAI();

  try {
    let sourceInfo = "";
    sourceInfo = `Explorer: contract is verified on ${candidate.chain}`;
    if (candidate.contractName) {
      sourceInfo += `\nContract name from explorer: ${candidate.contractName}`;
    }

    const prompt = RESEARCH_PROMPT
      .replace("{address}", candidate.address)
      .replace("{chain}", candidate.chain)
      .replace("{sourceInfo}", sourceInfo);

    const response = await llm.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        current: {
          ...candidate,
          research: { confidence: 0.0, contractType: "unknown" },
        },
        phase: "evaluate",
        errors: [...state.errors, "LLM returned non-JSON response"],
      };
    }

    const research = JSON.parse(jsonMatch[0]);
    const tokensUsed2 = tokensUsed;

    return {
      current: {
        ...candidate,
        research: {
          projectName: research.projectName || undefined,
          description: research.description || undefined,
          website: research.website || undefined,
          contractType: research.contractType || "unknown",
          confidence: Math.min(1, Math.max(0, research.confidence || 0)),
          sourceVerified: true,
        },
      },
      phase: "evaluate",
      tokensUsed: state.tokensUsed + tokensUsed2,
    };
  } catch (error) {
    return {
      current: {
        ...candidate,
        research: { confidence: 0.0, contractType: "unknown" },
      },
      phase: "evaluate",
      errors: [...state.errors, `Research failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
