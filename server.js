// server.js
const {
  initDb,
  saveLead,
  getLeadsByPriority,
  getAllLeads,
  getLatestLeadByCompanyNumber,
} = require("./db");
const express = require("express");
const { syncCompanyToHubspot } = require("./hubspot");
const cors = require("cors");
const { gatherEvidence } = require("./webResearch");
const { generateSalesBrief } = require("./aiService");

const {
  lookupCompany,
  searchByIndustry,
  lookupByNumber,
} = require("./companiesHouse");
const { scoreCompany } = require("./scoring");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// How many days a saved brief is considered "fresh enough" to reuse
// instead of re-spending on Anthropic (web search + brief generation).
// Signals like hiring/funding news don't meaningfully change day to
// day, so re-running the same company daily was pure waste.
const RESEARCH_CACHE_DAYS = 7;

function isRecent(dateValue, days) {
  if (!dateValue) return false;
  const ageMs = Date.now() - new Date(dateValue).getTime();
  return ageMs < days * 24 * 60 * 60 * 1000;
}

app.get("/api/lookup", async (req, res) => {
  const companyName = req.query.name;
  if (!companyName) {
    return res.status(400).json({ error: 'Missing "name" query parameter' });
  }
  try {
    const company = await lookupCompany(companyName);
    const scored = scoreCompany(company);

    if (company.found && !company.ambiguous) {
      await saveLead(company, scored);
    }

    res.json({ company, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/search-industry", async (req, res) => {
  const sicCodesParam = req.query.sicCodes;
  if (!sicCodesParam) {
    return res
      .status(400)
      .json({ error: 'Missing "sicCodes" query parameter' });
  }
  try {
    const companies = await searchByIndustry({
      sicCodes: sicCodesParam.split(","),
      incorporatedFrom: req.query.incorporatedFrom,
      size: parseInt(req.query.size) || 20,
    });

    const results = companies.map((company) => ({
      company,
      scored: scoreCompany(company),
    }));

    results.sort((a, b) => (b.scored.score || 0) - (a.scored.score || 0));
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/lookup-by-number", async (req, res) => {
  const companyNumber = req.query.number;
  const skipSave = req.query.skipSave === "true";
  if (!companyNumber) {
    return res.status(400).json({ error: 'Missing "number" query parameter' });
  }
  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    if (company.found && !company.ambiguous && !skipSave) {
      await saveLead(company, scored);
    }

    res.json({ company, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View search history - real SQL query behind this
app.get("/api/leads", async (req, res) => {
  try {
    const leads = req.query.priority
      ? await getLeadsByPriority(req.query.priority)
      : await getAllLeads();
    res.json({ leads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push a scored company into HubSpot as a real Company record
app.post("/api/sync-to-crm", async (req, res) => {
  const { companyNumber } = req.body;
  if (!companyNumber) {
    return res.status(400).json({ error: "Missing companyNumber" });
  }
  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    // Pull the most recent saved lead for this company, if one
    // exists, so we can include its AI brief (if Research has been
    // run) in the HubSpot sync instead of always sending a score-only
    // record.
    const savedLead = await getLatestLeadByCompanyNumber(companyNumber);
    const brief = savedLead?.brief || null;

    const result = await syncCompanyToHubspot(company, scored, brief);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full AI research pipeline - Companies House -> evidence -> sales brief
// Triggered manually by the user clicking "Research" in the UI
app.post("/api/research", async (req, res) => {
  const { companyNumber } = req.body;
  if (!companyNumber) {
    return res.status(400).json({ error: "Missing companyNumber" });
  }

  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    if (!company.found || company.ambiguous) {
      return res
        .status(400)
        .json({ error: "Company must be a clean, resolved match to research" });
    }

    // Reuse a recent brief instead of paying for Anthropic again if
    // this company was already researched within RESEARCH_CACHE_DAYS.
    const existing = await getLatestLeadByCompanyNumber(companyNumber);
    if (
      existing &&
      existing.brief &&
      isRecent(existing.searched_at, RESEARCH_CACHE_DAYS)
    ) {
      return res.json({
        company,
        scored,
        evidence: existing.evidence,
        brief: existing.brief,
        cached: true,
        searched_at: existing.searched_at,
      });
    }

    const evidence = await gatherEvidence(company.company_name);
    const brief = await generateSalesBrief(company, scored, evidence);

    await saveLead(company, scored, evidence, brief);

    res.json({ company, scored, evidence, brief });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook receiver - lets an external tool (like n8n) trigger a full
// research run automatically, without a human clicking anything
app.post("/api/webhook/new-lead", async (req, res) => {
  const { companyNumber } = req.body;
  if (!companyNumber) {
    return res.status(400).json({ error: "Missing companyNumber" });
  }

  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    if (!company.found || company.ambiguous) {
      return res
        .status(400)
        .json({ error: "Company must be a clean, resolved match" });
    }

    // Same cache check as /api/research - this is the route the daily
    // n8n schedule actually calls, so this is what stops it re-paying
    // for the same 5 companies every run.
    const existing = await getLatestLeadByCompanyNumber(companyNumber);
    if (
      existing &&
      existing.brief &&
      isRecent(existing.searched_at, RESEARCH_CACHE_DAYS)
    ) {
      return res.json({
        received: true,
        company,
        scored,
        evidence: existing.evidence,
        brief: existing.brief,
        cached: true,
        searched_at: existing.searched_at,
      });
    }

    const evidence = await gatherEvidence(company.company_name);
    const brief = await generateSalesBrief(company, scored, evidence);
    await saveLead(company, scored, evidence, brief, "webhook");

    res.json({ received: true, company, scored, evidence, brief });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
});
