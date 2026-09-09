// webResearch.js
// Uses Claude, with real web search as a tool, to gather sourced
// evidence about a company - hiring and funding signals. This is
// the "collect evidence" step, deliberately separate from the
// "interpret evidence" step (that's aiService.js) - research stays
// honest: we gather facts here, we don't judge them.
const { validateSignal } = require('./validation');
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function findSignal(companyName, signalType) {
  const queries = {
    hiring: `${companyName} hiring jobs careers new roles`,
    funding: `${companyName} funding round investment raised`,
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    messages: [
      {
        role: "user",
        content: `Search for recent, real news about: ${queries[signalType]}

Respond with ONLY a JSON object, no other text, in exactly this shape:
{
  "found": true or false,
  "claim": "one sentence describing what was found, or null if nothing found",
  "source_url": "the URL of the source, or null",
  "date": "approximate date if known, or null"
}

If you cannot find a real, recent, verifiable result, set "found" to false
and everything else to null. Do NOT invent a plausible-sounding result -
false and empty is a correct, honest answer when nothing real is found.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock) {
    return {
      type: signalType,
      found: false,
      claim: null,
      source_url: null,
      date: null,
      source: "claude_search",
      error: "No text response from Claude",
    };
  }

  try {
    const cleaned = textBlock.text.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const result = {
      type: signalType,
      ...parsed,
      source: "claude_search",
    };

    const validation = validateSignal(result);
    if (!validation.valid) {
      return {
        type: signalType,
        found: false,
        claim: null,
        source_url: null,
        date: null,
        source: "claude_search",
        validation_failed: true,
        error: `Validation failed: ${validation.reason}`,
      };
    }

    return result;
  } catch (err) {
    return {
      type: signalType,
      found: false,
      claim: null,
      source_url: null,
      date: null,
      source: "claude_search",
      error: `Could not parse response: ${err.message}`,
      raw: textBlock.text,
    };
  }
}

async function gatherEvidence(companyName) {
  const hiring = await findSignal(companyName, "hiring");
  const funding = await findSignal(companyName, "funding");

  return { signals: [hiring, funding] };
}

module.exports = { gatherEvidence, findSignal };
