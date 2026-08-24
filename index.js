// index.js
const { lookupCompany } = require("./companiesHouse");
const { scoreCompany } = require("./scoring");

async function main() {
  const companyName = process.argv[2]; // takes the name from command line

  if (!companyName) {
    console.log('Usage: node index.js "Company Name"');
    return;
  }

  console.log(`Looking up: ${companyName}...`);
  const result = await lookupCompany(companyName);
  console.log(result);

  const scored = scoreCompany(result);
  console.log("\n--- SCORE ---");
  console.log(scored);
}

main();
