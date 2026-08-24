const { searchByIndustry } = require("./companiesHouse");
const { scoreCompany } = require("./scoring");

async function main() {
  const companies = await searchByIndustry({
    sicCodes: ["62012"], // business/domestic software development
    incorporatedFrom: "2018-01-01",
    size: 10,
  });

  companies.forEach((c) => {
    const scored = scoreCompany(c);
    console.log(
      `${c.company_name} (${c.company_number}) — ${scored.priority} (${scored.score})`,
    );
    console.log("  Address:", c.registered_address);
  });
}

main();
