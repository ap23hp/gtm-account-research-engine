// hubspot.js
// Pushes a scored company into HubSpot as a real Company record.
// This is the "last mile" of the pipeline: search -> score -> land
// in the actual system a sales team works in every day.

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_API = "https://api.hubapi.com/crm/v3/objects/companies";

// HubSpot uses Bearer token auth (different from Companies House's
// Basic Auth) - the token goes directly in the Authorization header,
// no base64 encoding needed.
function authHeaders() {
  return {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Pushes a scored company to HubSpot. Creates a new Company record
// with the score/priority as custom-readable properties.
async function syncCompanyToHubspot(company, scored) {
  const payload = {
    properties: {
      name: company.company_name,
      description: `GTM Account Research: ${scored.priority} (score ${scored.score}). ${scored.reasoning}`,
    },
  };

  const response = await fetch(HUBSPOT_API, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HubSpot sync failed: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    synced: true,
    hubspot_id: data.id,
    hubspot_url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/record/0-2/${data.id}`,
  };
}

module.exports = { syncCompanyToHubspot };
