// clearLeads.js
// One-off utility to wipe the leads table before recording the demo.
// Self-contained: opens its own connection using the same DATABASE_URL
// your app already uses, so db.js doesn't need to change at all.
//
// Run with:
//   node --env-file=.env clearLeads.js

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render's Postgres requires SSL
});

async function clearLeads() {
  try {
    const before = await pool.query("SELECT COUNT(*) FROM leads");
    console.log(`Rows before delete: ${before.rows[0].count}`);

    await pool.query("DELETE FROM leads");

    const after = await pool.query("SELECT COUNT(*) FROM leads");
    console.log(`Rows after delete: ${after.rows[0].count}`);

    console.log("Done — leads table is clear.");
  } catch (err) {
    console.error("Failed to clear leads table:", err.message);
  } finally {
    await pool.end();
  }
}

clearLeads();
