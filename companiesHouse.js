// companiesHouse.js
// Talks to the real UK Companies House API: search for a company,
// then fetch its full profile.

const BASE_URL = 'https://api.company-information.service.gov.uk';

// Reads our key from the .env file (Node loads this automatically
// when we run with --env-file=.env)
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

// Companies House uses HTTP Basic Auth: our API key as the "username",
// blank password. This encodes it the way the standard requires.
function authHeader() {
  const encoded = Buffer.from(`${API_KEY}:`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
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
    return { found: false, reason: 'No matching company found on Companies House' };
  }

  // NEW: filter to only active companies. Dissolved companies are
  // almost never the one we meant to find.
  const activeMatches = matches.filter(m => m.company_status === 'active');

  if (activeMatches.length === 0) {
    // Every match was dissolved/inactive - worth knowing, not a silent failure
    return {
      found: false,
      reason: 'No active company found matching this name (only dissolved/inactive matches)',
    };
  }

  if (activeMatches.length > 1) {
    // NEW: genuine ambiguity - don't guess, flag it for human review
    return {
      found: true,
      ambiguous: true,
      confidence: 'ambiguous',
      candidates: activeMatches.map(m => ({
        company_name: m.title,
        company_number: m.company_number,
        address: m.address_snippet,
      })),
      reason: `${activeMatches.length} active companies match "${companyName}" - needs manual selection`,
    };
  }

  // Exactly one active match - safe to auto-select
  const best = activeMatches[0];
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
    source: 'companies_house',
    confidence: 'verified',
  };
}
// NEW: given an exact company_number (e.g. from a candidate the user
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
    source: 'companies_house',
    confidence: 'verified',
  };
}

// NEW: searches for companies by SIC code and other criteria directly -
// no company name involved at all, so no ambiguity problem. This is
// PROSPECTING (find new leads), separate from lookupCompany's job of
// VERIFICATION (check a specific lead I already have).
async function searchByIndustry({ sicCodes, incorporatedFrom, size = 20 }) {
  const params = new URLSearchParams({
    sic_codes: sicCodes.join(','),      // e.g. "62012,62020"
    company_status: 'active',           // only active companies
    size: size.toString(),
  });

  if (incorporatedFrom) {
    params.append('incorporated_from', incorporatedFrom); // e.g. "2018-01-01"
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
  return data.items.map(item => ({
    found: true,
    ambiguous: false,
    company_name: item.company_name,
    company_number: item.company_number,
    status: item.company_status,
    incorporated_on: item.date_of_creation,
    sic_codes: item.sic_codes || [],
    registered_address: item.registered_office_address,
    source: 'companies_house',
    confidence: 'verified',
  }));
}

module.exports = { lookupCompany, searchByIndustry, lookupByNumber };