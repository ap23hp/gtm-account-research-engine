// cleanupDuplicates.js
// One-off maintenance script - NOT part of the running app, not called
// by any route. Run manually, once, to clean up duplicate automated
// leads created during testing (the repeated Deliveroo runs from the
// n8n cost incident). Keeps the single most recent entry per company,
// deletes the rest.

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // First, show what we're about to touch - never delete blind.
  const before = await pool.query(
    `SELECT id, company_name, company_number, searched_at
     FROM leads
     WHERE source = 'webhook'
     ORDER BY company_number, searched_at DESC`,
  );
  console.log(
    `Found ${before.rows.length} webhook-sourced leads before cleanup:`,
  );
  console.table(before.rows);

  // Delete all but the most recent (highest id) row per company_number,
  // restricted to source='webhook' only - manual searches are untouched.
  const result = await pool.query(`
    DELETE FROM leads a
    USING leads b
    WHERE a.id < b.id
      AND a.company_number = b.company_number
      AND a.source = 'webhook'
      AND b.source = 'webhook'
  `);

  console.log(`Deleted ${result.rowCount} duplicate webhook entries.`);

  const after = await pool.query(
    `SELECT id, company_name, company_number, searched_at
     FROM leads
     WHERE source = 'webhook'
     ORDER BY searched_at DESC`,
  );
  console.log(`Remaining webhook-sourced leads after cleanup:`);
  console.table(after.rows);

  await pool.end();
}

main();
