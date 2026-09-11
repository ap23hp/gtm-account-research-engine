// hubspot.js
// Pushes a scored company into HubSpot as a real Company record.
// This is the "last mile" of the pipeline: search -> score -> research
// -> land in the actual system a sales team works in every day.

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

// Builds the description text sent to HubSpot. Always includes the
// ICP score. If a brief was generated (Research was run before
// syncing), it's appended too - if not, we say so explicitly rather
// than silently sending a thinner record with no indication why.
function buildDescription(scored, brief) {
  let description = `GTM Account Research: ${scored.priority} (score ${scored.score}). ${scored.reasoning}`;

  if (brief) {
    description += `\n\n--- AI Sales Brief ---`;
    description += `\nWhy now: ${brief.why_now}`;
    description += `\nLikely contact: ${brief.likely_contact_role}`;
    description += `\nOutreach angle: ${brief.outreach_angle}`;
    description += `\nConfidence: ${brief.confidence}`;
  } else {
    description += `\n\n(No AI research brief yet - run Research before syncing to include one.)`;
  }

  return description;
}

// Looks up an existing HubSpot company by exact name, using HubSpot's
// search endpoint. Returns the existing record's id if found, or null
// if this company hasn't been synced before. This is what lets us
// update instead of blindly creating a duplicate every time the same
// company gets synced twice (e.g. once before Research, once after).
async function findExistingCompany(companyName) {
  const searchUrl = `${HUBSPOT_API}/search`;

  const response = await fetch(searchUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "name",
              operator: "EQ",
              value: companyName,
            },
          ],
        },
      ],
      limit: 1,
    }),
  });

  if (!response.ok) {
    // Don't block the sync over a failed lookup - fall back to
    // "not found" and let it create a new record rather than crash.
    return null;
  }

  const data = await response.json();
  return data.results && data.results.length > 0 ? data.results[0].id : null;
}

// Pushes a scored (and optionally researched) company to HubSpot.
// If a company with this exact name already has a HubSpot record,
// that record is updated in place. Otherwise, a new Company record
// is created. `brief` is optional - pass it when Research has been
// run, omit it (or pass null) for a score-only sync.
async function syncCompanyToHubspot(company, scored, brief = null) {
  const payload = {
    properties: {
      name: company.company_name,
      description: buildDescription(scored, brief),
    },
  };

  const existingId = await findExistingCompany(company.company_name);

  const url = existingId ? `${HUBSPOT_API}/${existingId}` : HUBSPOT_API;
  const method = existingId ? "PATCH" : "POST";

  const response = await fetch(url, {
    method,
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
    updated: Boolean(existingId),
    hubspot_id: data.id,
    hubspot_url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/record/0-2/${data.id}`,
  };
}

module.exports = { syncCompanyToHubspot };
