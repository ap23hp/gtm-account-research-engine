// aiService.js
// Takes verified company data + gathered evidence, and asks Claude
// to produce a structured sales brief. This is the "interpret
// evidence" step - deliberately separate from webResearch.js
// (which only "collects evidence"). Claude is NOT allowed to
// invent facts here - it can only reason over what we give it.
const { validateBrief } = require('./validation');
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateSalesBrief(company, scored, evidence) {
  // We build a clean, explicit input object - this is exactly what
  // Claude is allowed to reason about. Nothing outside this object
  // exists as far as Claude's answer is concerned.
  const input = {
    company: {
      name: company.company_name,
      status: company.status,
      incorporated_on: company.incorporated_on,
      sic_codes: company.sic_codes,
    },
    icp_score: {
      score: scored.score,
      priority: scored.priority,
      reasoning: scored.reasoning,
    },
    evidence: evidence.signals, // the real, sourced findings from webResearch.js
  };

  const prompt = `You are writing a short sales research brief for an account executive.

Here is the verified data you have access to - use ONLY this, nothing else:
${JSON.stringify(input, null, 2)}

Respond with ONLY a JSON object, no other text, in exactly this shape:
{
  "why_now": "one sentence on why this account might be worth reaching out to now, based ONLY on the evidence above - if no evidence supports urgency, say so plainly",
  "likely_contact_role": "the most likely job title to reach out to, based on company size/industry - a reasonable inference is fine here, this is not a factual claim",
  "outreach_angle": "one sentence suggesting what angle to use in an opening message",
  "confidence": "high" or "medium" or "low", based on how much real evidence was available
}

Rules:
- Every claim in "why_now" must be traceable to something in the evidence array above. If the evidence array has no findings (found: false for everything), say plainly that no strong signal was found, and set confidence to "low".
- Do not invent funding, hiring, or news that isn't in the evidence provided.
- "likely_contact_role" and "outreach_angle" are reasonable professional suggestions, not factual claims - they don't need a source.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock) {
    return { error: "No response from Claude" };
  }

try {
  const cleaned = textBlock.text.replace(/```json\n?|```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const validation = validateBrief(parsed);
  if (!validation.valid) {
    return { error: `Validation failed: ${validation.reason}`, validation_failed: true };
  }

  return parsed;
} catch (err) {
    return {
      error: `Could not parse brief: ${err.message}`,
      raw: textBlock.text,
    };
  }
}

module.exports = { generateSalesBrief };
