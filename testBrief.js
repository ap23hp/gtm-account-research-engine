const { lookupByNumber } = require("./companiesHouse");
const { scoreCompany } = require("./scoring");
const { gatherEvidence } = require("./webResearch");
const { generateSalesBrief } = require("./aiService");

async function main() {
  const companyNumber = process.argv[2] || "13227665"; // Deliveroo Limited, default
  const company = await lookupByNumber(companyNumber);
  const scored = scoreCompany(company);
  console.log("Gathering evidence...");
  const evidence = await gatherEvidence(company.company_name);
  console.log("Generating brief...");
  const brief = await generateSalesBrief(company, scored, evidence);
  console.log(JSON.stringify(brief, null, 2));
}

main();
