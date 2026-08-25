// Takes the object returned by lookupCompany() and scores how good
// a fit the company is against a defined target profile (ICP).

const TARGET_SIC_PREFIXES = ["62", "63", "58"];
// 62xxx = computer programming/consultancy, 63xxx = information
// service activities, 58xxx = publishing (includes software publishing)

function scoreCompany(company) {
  // Guard clause: if the company wasn't found or was ambiguous,
  // there's nothing to score - return early.
  if (!company.found || company.ambiguous) {
    return {
      score: null,
      priority: "Needs Review",
      reasoning: company.reason || "Company data incomplete - cannot score",
    };
  }

  let score = 0;
  const reasons = [];

  // RULE 1: must be active - hard requirement
  if (company.status !== "active") {
    return {
      score: 0,
      priority: "Reject",
      reasoning: `Company status is "${company.status}", not active`,
    };
  }
  reasons.push("Active company (+required)");

  // RULE 2: company age
  const incorporationYear = new Date(company.incorporated_on).getFullYear();
  const currentYear = new Date().getFullYear();
  const ageInYears = currentYear - incorporationYear;

  if (ageInYears >= 1 && ageInYears <= 8) {
    score += 30;
    reasons.push(
      `Incorporated ${ageInYears} years ago, inside the 1–8 year band the ICP targets (+30).`,
    );
  } else {
    reasons.push(
      `Incorporated ${ageInYears} years ago, outside the target age range (+0).`,
    );
  }

  // RULE 3: SIC code
  const hasTargetSIC = (company.sic_codes || []).some((code) =>
    TARGET_SIC_PREFIXES.some((prefix) => code.startsWith(prefix)),
  );

  if (hasTargetSIC) {
    score += 25;
    reasons.push(
      `SIC code ${company.sic_codes?.join(", ")} places it in a priority industry for this ICP (+25).`,
    );
  } else {
    reasons.push(
      `SIC code ${company.sic_codes?.join(", ") || "none listed"} falls outside the target industries (+0).`,
    );
  }

  // RULE 4: UK-registered
  score += 15;
  reasons.push(
    "Registered with UK Companies House, confirming it operates in the target territory (+15).",
  );

  // Priority bands
  let priority;
  if (score >= 60) priority = "Priority A";
  else if (score >= 40) priority = "Priority B";
  else if (score >= 20) priority = "Nurture";
  else priority = "Reject";

  return {
    score,
    priority,
    reasoning: reasons.join(" "),
  };
}

module.exports = { scoreCompany };
