// db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render's Postgres requires SSL
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_number TEXT,
      status TEXT,
      incorporated_on TEXT,
      sic_codes TEXT,
      score INTEGER,
      priority TEXT,
      reasoning TEXT,
      evidence JSONB,
      brief JSONB,
      searched_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS evidence JSONB`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS brief JSONB`);
  await pool.query(
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`,
  );
  console.log("Database ready");
}

async function saveLead(
  company,
  scored,
  evidence = null,
  brief = null,
  source = "manual",
) {
  await pool.query(
    `INSERT INTO leads (company_name, company_number, status, incorporated_on, sic_codes, score, priority, reasoning, evidence, brief, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      company.company_name || "Unknown",
      company.company_number || null,
      company.status || null,
      company.incorporated_on || null,
      JSON.stringify(company.sic_codes || []),
      scored.score,
      scored.priority,
      scored.reasoning,
      evidence ? JSON.stringify(evidence) : null,
      brief ? JSON.stringify(brief) : null,
      source,
    ],
  );
}

async function getLeadsByPriority(priority) {
  const result = await pool.query(
    `SELECT * FROM leads WHERE priority = $1 ORDER BY score DESC`,
    [priority],
  );
  return result.rows;
}

async function getAllLeads() {
  const result = await pool.query(
    `SELECT * FROM leads ORDER BY searched_at DESC`,
  );
  return result.rows;
}

// Fetches the most recent saved lead for a given company number, if
// any exists. Used by /api/sync-to-crm to pull the already-generated
// AI brief (if Research has been run) before pushing to HubSpot -
// this route never re-runs Research itself, it only reads what's
// already been saved.
async function getLatestLeadByCompanyNumber(companyNumber) {
  const result = await pool.query(
    `SELECT * FROM leads WHERE company_number = $1 ORDER BY searched_at DESC LIMIT 1`,
    [companyNumber],
  );
  return result.rows[0] || null;
}

module.exports = {
  initDb,
  saveLead,
  getLeadsByPriority,
  getAllLeads,
  getLatestLeadByCompanyNumber,
};
