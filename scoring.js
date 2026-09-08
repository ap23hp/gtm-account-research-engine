// Takes the object returned by lookupCompany() and scores how good
// a fit the company is against a defined target profile (ICP).

const TARGET_SIC_PREFIXES = ["62", "63", "58"];

// Bar widths are scaled against this shared maximum (the largest
// single factor, age = 30) so a factor worth fewer points visually
// shows a shorter bar even when it "passed" - lets you compare the
// relative weight of each criterion, not just pass/fail.
const MAX_FACTOR_POINTS = 30;

function scoreCompany(company) {
  if (!company.found || company.ambiguous) {
    return {
      score: null,
      priority: "Needs Review",
      reasoning: company.reason || "Company data incomplete - cannot score",
      factors: [],
    };
  }

  let score = 0;
  const reasons = [];
  const factors = [];

  if (company.status !== "active") {
    return {
      score: 0,
      priority: "Reject",
      reasoning: `Company status is "${company.status}", not active`,
      factors: [
        {
          label: "Active status (required)",
          passed: false,
          points: "Fail",
          width: 0,
        },
      ],
    };
  }
  reasons.push("Active company (+required)");
  factors.push({
    label: "Active status (required)",
    passed: true,
    points: "Pass",
    width: 100,
  });

  const incorporationYear = new Date(company.incorporated_on).getFullYear();
  const currentYear = new Date().getFullYear();
  const ageInYears = currentYear - incorporationYear;
  const agePass = ageInYears >= 1 && ageInYears <= 8;
  const agePoints = agePass ? 30 : 0;

  if (agePass) {
    score += 30;
    reasons.push(
      `Incorporated ${ageInYears} years ago, inside the 1–8 year band the ICP targets (+30).`,
    );
  } else {
    reasons.push(
      `Incorporated ${ageInYears} years ago, outside the target age range (+0).`,
    );
  }
  factors.push({
    label: "Company age, 1-8 year band",
    passed: agePass,
    points: agePass ? "+30" : "+0",
    width: Math.round((agePoints / MAX_FACTOR_POINTS) * 100),
  });

  const hasTargetSIC = (company.sic_codes || []).some((code) =>
    TARGET_SIC_PREFIXES.some((prefix) => code.startsWith(prefix)),
  );
  const sicPoints = hasTargetSIC ? 25 : 0;

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
  factors.push({
    label: "SIC industry match",
    passed: hasTargetSIC,
    points: hasTargetSIC ? "+25" : "+0",
    width: Math.round((sicPoints / MAX_FACTOR_POINTS) * 100),
  });

  const isPrivateLimited = company.company_type === "ltd";
  const typePoints = isPrivateLimited ? 10 : 0;

  if (isPrivateLimited) {
    score += 10;
    reasons.push(
      "Registered as a private limited company, the structure most B2B software buyers operate under (+10).",
    );
  } else {
    reasons.push(
      `Registered as "${company.company_type || "an unspecified type"}", outside the typical target structure (+0).`,
    );
  }
  factors.push({
    label: "Company legal structure",
    passed: isPrivateLimited,
    points: isPrivateLimited ? "+10" : "+0",
    width: Math.round((typePoints / MAX_FACTOR_POINTS) * 100),
  });

  reasons.push(
    "All companies in this dataset are UK-registered by definition of the Companies House source, so this isn't scored separately.",
  );

  let priority;
  if (score >= 50) priority = "Priority A";
  else if (score >= 30) priority = "Priority B";
  else if (score >= 10) priority = "Nurture";
  else priority = "Reject";

  return {
    score,
    priority,
    reasoning: reasons.join(" "),
    factors,
  };
}

module.exports = { scoreCompany };