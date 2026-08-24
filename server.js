// server.js
const express = require('express');
const cors = require('cors');
const { lookupCompany, searchByIndustry } = require('./companiesHouse');
const { scoreCompany } = require('./scoring');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/lookup', async (req, res) => {
  const companyName = req.query.name;
  if (!companyName) {
    return res.status(400).json({ error: 'Missing "name" query parameter' });
  }
  try {
    const company = await lookupCompany(companyName);
    const scored = scoreCompany(company);
    res.json({ company, scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search-industry', async (req, res) => {
  const sicCodesParam = req.query.sicCodes;
  if (!sicCodesParam) {
    return res.status(400).json({ error: 'Missing "sicCodes" query parameter' });
  }
  try {
    const companies = await searchByIndustry({
      sicCodes: sicCodesParam.split(','),
      incorporatedFrom: req.query.incorporatedFrom,
      size: parseInt(req.query.size) || 20,
    });

    const results = companies.map(company => ({
      company,
      scored: scoreCompany(company),
    }));

    results.sort((a, b) => (b.scored.score || 0) - (a.scored.score || 0));
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});