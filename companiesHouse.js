// companiesHouse.js
// Talks to the real UK Companies House API: search for a company,
// then fetch its full profile.

const BASE_URL = "https://api.company-information.service.gov.uk";

// Reads our key from the .env file (Node loads this automatically
// when we run with --env-file=.env)
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

// Companies House uses HTTP Basic Auth: our API key as the "username",
// blank password. This encodes it the way the standard requires.
function authHeader() {
  const encoded = Buffer.from(`${API_KEY}:`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

// Normalizes a company name for comparison: lowercases it, strips
// common suffixes (Limited/Ltd/PLC/LLP) and punctuation, so
// "Deliveroo Limited" and "DELIVEROO LTD." compare as equal.
//
// This exists because Companies House's free-text search is fuzzy -
// it returns any company whose name loosely relates to the query,
// not just exact matches. Without this normalization step, the
// ambiguity check below would treat every loosely-related active
// company in the search results as a "candidate", which made almost
// every search look ambiguous even when only one real match existed.
//
// Trade-off, worth being explicit about: stripping the suffix means
// "Acme LLP" and "Acme PLC" would normalize to the same string, even
// though they are legally distinct registered entities. That's an
// acceptable simplification for this name-matching convenience layer,
// but it means normalized equality is NOT a legal identity check.
// The company_number remains the actual stable identifier throughout
// this app - lookupByNumber() (used by the automated/webhook path)
// never goes through this normalization at all, which is why
// automation is fully unambiguous while name-based search only
// narrows the field before flagging for human review.
function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|llp)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// STEP 1: search by name -> get a short list of possible matches
async function searchCompany(companyName) {
  const url = `${BASE_URL}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=20`;
  const response = await fetch(url, { headers: authHeader() });

  if (!response.ok) {
    throw new Error(`Companies House search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.items;
}

// STEP 2: fetch full profile using the exact company_number from step 1
async function getCompanyProfile(companyNumber) {
  const url = `${BASE_URL}/company/${companyNumber}`;
  const response = await fetch(url, { headers: authHeader() });

  if (!response.ok) {
    throw new Error(`Companies House profile fetch failed: ${response.status}`);
  }

  return response.json();
}

// Combines both steps into one easy function
async function lookupCompany(companyName) {
  const matches = await searchCompany(companyName);

  if (!matches || matches.length === 0) {
    return {
      found: false,
      reason: "No matching company found on Companies House",
    };
  }

  // Filter to only active companies. Dissolved companies are
  // almost never the one we meant to find.
  const activeMatches = matches.filter((m) => m.company_status === "active");

  if (activeMatches.length === 0) {
    return {
      found: false,
      reason:
        "No active company found matching this name (only dissolved/inactive matches)",
    };
  }

  // Companies House's search is fuzzy, so activeMatches can include
  // companies that only loosely relate to what was typed. Before
  // deciding whether this is a genuine ambiguity, narrow down to
  // companies whose (normalized) name actually equals the query -
  // this is the real "same name, different company" case (e.g.
  // multiple real "Deliveroo" entities), not search noise.
  const searchNormalized = normalizeCompanyName(companyName);
  const exactMatches = activeMatches.filter(
    (m) => normalizeCompanyName(m.title) === searchNormalized,
  );

  if (exactMatches.length > 1) {
    // Genuine ambiguity - multiple real, active companies share this
    // exact name. Don't guess, flag it for human review.
    return {
      found: true,
      ambiguous: true,
      confidence: "ambiguous",
      candidates: exactMatches.map((m) => ({
        company_name: m.title,
        company_number: m.company_number,
        address: m.address_snippet,
      })),
      reason: `${exactMatches.length} active companies share the exact name "${companyName}" - needs manual selection`,
    };
  }

  if (exactMatches.length === 1) {
    // Exactly one exact-name match - safe to auto-select.
    const best = exactMatches[0];
    const profile = await getCompanyProfile(best.company_number);

    return {
      found: true,
      ambiguous: false,
      company_name: profile.company_name,
      company_number: profile.company_number,
      status: profile.company_status,
      incorporated_on: profile.date_of_creation,
      sic_codes: profile.sic_codes || [],
      registered_address: profile.registered_office_address,
      source: "companies_house",
      confidence: "verified",
      company_type: profile.type,
    };
  }

  // No exact-name match, but the fuzzy search still returned other
  // active companies (e.g. a trading name that differs from the
  // registered name - see the Dogma Group case). We genuinely don't
  // know which, if any, is the right one, so we surface the closest
  // candidates for human review rather than guessing - but flag this
  // as a distinct case from "same exact name, multiple entities",
  // since the underlying reason for ambiguity is different.
  return {
    found: true,
    ambiguous: true,
    confidence: "low",
    candidates: activeMatches.map((m) => ({
      company_name: m.title,
      company_number: m.company_number,
      address: m.address_snippet,
    })),
    reason: `No company found with the exact name "${companyName}" - showing the closest active matches for manual selection`,
  };
}

// Given an exact company_number (e.g. from a candidate the user
// picked out of an ambiguous list), fetch and format its full profile -
// the same shape lookupCompany() returns for a clean match.
async function lookupByNumber(companyNumber) {
  const profile = await getCompanyProfile(companyNumber);

  return {
    found: true,
    ambiguous: false,
    company_name: profile.company_name,
    company_number: profile.company_number,
    status: profile.company_status,
    incorporated_on: profile.date_of_creation,
    sic_codes: profile.sic_codes || [],
    registered_address: profile.registered_office_address,
    source: "companies_house",
    confidence: "verified",
    company_type: profile.type,
  };
}

// Searches for companies by SIC code and other criteria directly -
// no company name involved at all, so no ambiguity problem. This is
// PROSPECTING (find new leads), separate from lookupCompany's job of
// VERIFICATION (check a specific lead I already have).
async function searchByIndustry({ sicCodes, incorporatedFrom, size = 20 }) {
  const params = new URLSearchParams({
    sic_codes: sicCodes.join(","), // e.g. "62012,62020"
    company_status: "active", // only active companies
    size: size.toString(),
  });

  if (incorporatedFrom) {
    params.append("incorporated_from", incorporatedFrom); // e.g. "2018-01-01"
  }

  const url = `${BASE_URL}/advanced-search/companies?${params.toString()}`;
  const response = await fetch(url, { headers: authHeader() });

  if (!response.ok) {
    throw new Error(`Advanced search failed: ${response.status}`);
  }

  const data = await response.json();

  // Reshape into the same clean format lookupCompany() uses, for
  // consistency - anything downstream (like scoreCompany) works
  // the same way regardless of which path found the company.
  return data.items.map((item) => ({
    found: true,
    ambiguous: false,
    company_name: item.company_name,
    company_number: item.company_number,
    status: item.company_status,
    incorporated_on: item.date_of_creation,
    sic_codes: item.sic_codes || [],
    registered_address: item.registered_office_address,
    source: "companies_house",
    confidence: "verified",
    company_type: item.company_type,
  }));
}

module.exports = { lookupCompany, searchByIndustry, lookupByNumber };
