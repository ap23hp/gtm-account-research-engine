// db.js
const { Pool } = require('pg');

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
      searched_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database ready');
}

async function saveLead(company, scored) {
  await pool.query(
    `INSERT INTO leads (company_name, company_number, status, incorporated_on, sic_codes, score, priority, reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      company.company_name || 'Unknown',
      company.company_number || null,
      company.status || null,
      company.incorporated_on || null,
      JSON.stringify(company.sic_codes || []),
      scored.score,
      scored.priority,
      scored.reasoning,
    ]
  );
}

async function getLeadsByPriority(priority) {
  const result = await pool.query(
    `SELECT * FROM leads WHERE priority = $1 ORDER BY score DESC`,
    [priority]
  );
  return result.rows;
}

async function getAllLeads() {
  const result = await pool.query(`SELECT * FROM leads ORDER BY searched_at DESC`);
  return result.rows;
}

module.exports = { initDb, saveLead, getLeadsByPriority, getAllLeads };