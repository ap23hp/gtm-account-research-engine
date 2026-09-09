// validation.js
// Code-level validation for Claude's structured output - a second
// layer on top of the prompt-level guardrails already in webResearch.js
// and aiService.js. The prompt asks the model to behave; this checks
// that it actually did, before the app trusts the result.
//
// Deliberately NOT attempting: verifying whether a claim is factually
// true, or whether the English text is semantically consistent with
// the evidence. That's a much bigger NLP/evaluation problem, out of
// scope here. This only checks structure and internal consistency -
// the shape of the answer, not the truth of it.

// Checks a URL is at least well-formed and http(s) - not that it's
// reachable. A network request here would add latency and a new
// failure point for a portfolio-scale project; format-checking is
// the honest, proportionate level of validation.
function isValidUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Validates one signal object from webResearch.js. Returns
// { valid: true } or { valid: false, reason: '...' }.
function validateSignal(signal) {
  const requiredFields = ['type', 'found', 'claim', 'source_url', 'date'];
  for (const field of requiredFields) {
    if (!(field in signal)) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  if (typeof signal.found !== 'boolean') {
    return { valid: false, reason: '"found" must be a boolean' };
  }

  // Evidence consistency rule: found=true requires real supporting
  // data; found=false requires no fabricated supporting data.
  if (signal.found === true) {
    if (!signal.claim || typeof signal.claim !== 'string') {
      return { valid: false, reason: 'found=true but claim is missing or empty' };
    }
    if (!isValidUrl(signal.source_url)) {
      return { valid: false, reason: 'found=true but source_url is missing or malformed' };
    }
  } else {
    if (signal.claim !== null || signal.source_url !== null) {
      return { valid: false, reason: 'found=false but claim/source_url are not null - inconsistent' };
    }
  }

  return { valid: true };
}

// Validates the structured sales brief from aiService.js.
function validateBrief(brief) {
  const requiredFields = ['why_now', 'likely_contact_role', 'outreach_angle', 'confidence'];
  for (const field of requiredFields) {
    if (!(field in brief) || typeof brief[field] !== 'string' || brief[field].trim() === '') {
      return { valid: false, reason: `Missing or empty required field: ${field}` };
    }
  }

  const validConfidence = ['high', 'medium', 'low'];
  if (!validConfidence.includes(brief.confidence)) {
    return { valid: false, reason: `confidence must be one of ${validConfidence.join(', ')}, got "${brief.confidence}"` };
  }

  return { valid: true };
}

module.exports = { validateSignal, validateBrief, isValidUrl };