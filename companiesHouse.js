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
  const url = `${BASE_URL}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;
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

  const best = matches[0];
  const profile = await getCompanyProfile(best.company_number);

  return {
    found: true,
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

module.exports = { lookupCompany };