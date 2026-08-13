/**
 * EVALUATE Node
 *
 * Checks policy compliance and generates the submission tag.
 *
 * Determines:
 * - Is this contract eligible for the target registry?
 * - What should the Public Name Tag be?
 * - What's the Public Note?
 * - Should we auto-approve, queue for human review, or reject?
 */

import OpenAI from "openai";
import type { AgentGraphState } from "../state.js";

const EVALUATE_PROMPT = `You are Srelok, evaluating whether a contract submission will be accepted by the Kleros Scout Address Tags Registry.

Registry policy rules:
- The Public Name Tag must clearly identify the contract (e.g., "Uniswap V3 Router", "Aave V3 Pool")
- The tag must be the commonly-used name, not a generic description
- Project Name should be the project the contract belongs to
- UI/Website Link should be the main interface URL for the project
- Public Note adds context that doesn't fit in the tag
- ERC-20, ERC-721, and EIP-1167 proxy contracts are EXCLUDED from incentives (but still valid)

Research results for this contract:
Address: {address}
Chain: {chain}
Project: {projectName}
Type: {contractType}
Description: {description}
Website: {website}
Research confidence: {confidence}

Generate the submission fields and your confidence in acceptance.
If research confidence is too low or the contract type is excluded, recommend rejection.

Respond in JSON:
{
  "suggestedTag": "Public Name Tag string",
  "suggestedNote": "Public Note string",
  "projectName": "Project Name string",
  "website": "URL string",
  "policyCompliant": true/false,
  "isExcludedType": true/false,
  "reasoning": "brief explanation of your decision",
  "confidence": 0.0 to 1.0,
  "decision": "approve" | "queue" | "reject"
}

Decision criteria:
- "approve": confidence >= 0.85 AND policyCompliant AND !isExcludedType
- "queue": confidence >= 0.5 but < 0.85, needs human review
- "reject": confidence < 0.5 OR !policyCompliant OR isExcludedType`;

export async function evaluateNode(state: AgentGraphState): Promise<Partial<AgentGraphState>> {
  const candidate = state.current;
  if (!candidate || !candidate.research) {
    return {
      decision: "reject",
      phase: "done",
      errors: [...state.errors, "No research data to evaluate"],
    };
  }

  const research = candidate.research;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Heuristic evaluation without LLM
    const confidence = research.confidence || 0;
    let decision: "approve" | "queue" | "reject" = "queue";

    if (confidence < 0.3) decision = "reject";
    else if (confidence >= 0.85 && research.projectName) decision = "approve";

    return {
      current: {
        ...candidate,
        evaluation: {
          policyCompliant: confidence > 0.5,
          explorerTagged: false,
          suggestedTag: research.contractType || "Unknown Contract",
          suggestedNote: research.description || "",
          reasoning: "Heuristic evaluation (no LLM available)",
          confidence,
        },
      },
      decision,
      phase: decision === "reject" ? "done" : "build",
      errors: [...state.errors, "OPENAI_API_KEY not set — using heuristic evaluation"],
    };
  }

  const llm = new OpenAI();

  try {
    const prompt = EVALUATE_PROMPT
      .replace("{address}", candidate.address)
      .replace("{chain}", candidate.chain)
      .replace("{projectName}", research.projectName || "unknown")
      .replace("{contractType}", research.contractType || "unknown")
      .replace("{description}", research.description || "no description")
      .replace("{website}", research.website || "none")
      .replace("{confidence}", String(research.confidence || 0));

    const response = await llm.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        decision: "queue",
        phase: "build",
        errors: [...state.errors, "Evaluation LLM returned non-JSON"],
      };
    }

    const evaluation = JSON.parse(jsonMatch[0]);
    const decision = evaluation.decision as "approve" | "queue" | "reject";

    return {
      current: {
        ...candidate,
        evaluation: {
          policyCompliant: evaluation.policyCompliant,
          explorerTagged: false,
          suggestedTag: evaluation.suggestedTag,
          suggestedNote: evaluation.suggestedNote,
          reasoning: evaluation.reasoning,
          confidence: evaluation.confidence,
        },
      },
      decision,
      phase: decision === "reject" ? "done" : "build",
      tokensUsed: state.tokensUsed + tokensUsed,
    };
  } catch (error) {
    return {
      decision: "queue",
      phase: "build",
      errors: [...state.errors, `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
