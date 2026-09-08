// server.js
const { initDb, saveLead, getLeadsByPriority, getAllLeads } = require("./db");
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
  if (!companyNumber) {
    return res.status(400).json({ error: 'Missing "number" query parameter' });
  }
  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    if (company.found && !company.ambiguous) {
      await saveLead(company, scored);
    }

    res.json({ company, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW: view search history - real SQL query behind this
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

// NEW: push a scored company into HubSpot as a real Company record
app.post("/api/sync-to-crm", async (req, res) => {
  const { companyNumber } = req.body;
  if (!companyNumber) {
    return res.status(400).json({ error: "Missing companyNumber" });
  }
  try {
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);
    const result = await syncCompanyToHubspot(company, scored);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// NEW: full AI research pipeline - Companies House -> evidence -> sales brief
app.post("/api/research", async (req, res) => {
  const { companyNumber } = req.body;
  if (!companyNumber) {
    return res.status(400).json({ error: "Missing companyNumber" });
  }

  try {
    // Step 1: verified company data (existing, working code)
    const company = await lookupByNumber(companyNumber);
    const scored = scoreCompany(company);

    if (!company.found || company.ambiguous) {
      return res
        .status(400)
        .json({ error: "Company must be a clean, resolved match to research" });
    }

    // Step 2: real, sourced evidence (new)
    const evidence = await gatherEvidence(company.company_name);

    // Step 3: structured sales brief, grounded in that evidence (new)
    const brief = await generateSalesBrief(company, scored, evidence);

    // Step 4: save everything - extending the existing leads table
    await saveLead(company, scored, evidence, brief);

    res.json({ company, scored, evidence, brief });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
});
