const { gatherEvidence } = require("./webResearch");

async function main() {
  const companyName = process.argv[2];
  if (!companyName) {
    console.log('Usage: node testResearch2.js "Company Name"');
    return;
  }
  console.log(`Researching: ${companyName}...`);
  const result = await gatherEvidence(companyName);
  console.log(JSON.stringify(result, null, 2));
}

main();
