# GTM Account Research Engine

Given a UK company name, or a target industry, this tool verifies the company against real government data, scores it against a defined ideal customer profile, gathers real evidence (hiring, funding), generates an evidence-only AI sales brief, and syncs qualified leads into a CRM - the manual research a sales rep normally spends 20-30 minutes doing per account.

**Live app:** https://frontend-apra-k.vercel.app
*(Free-tier hosting sleeps after inactivity — first load may take 30-50 seconds.)*

---

## The problem this solves

Sales teams lose hours every week doing the same manual check before a call: is this a real, active company, what industry are they in, how big are they, and which "Acme Ltd" out of five is actually the right one. That research is repetitive, doesn't scale, and delays the moment a rep can actually act.

This tool automates that entire loop - enrichment, ICP scoring, evidence-backed signals, and CRM sync - so a sales team starts each day with the best data already assembled, instead of assembling it themselves. It runs on real government data and a real AI research layer, with a rule enforced everywhere: never guess, verify it or say plainly that nothing was found.

---

## What it actually does

- **Verify a specific company** - resolves a name against Companies House. If more than one real company matches, it doesn't guess - it flags the exact accounts for a human to pick, the same discipline it applies everywhere it isn't certain.
- **Discover prospects by industry** - generates a ranked, scored list of real active UK companies for a target sector.
- **ICP scoring** - a transparent, rule-based score with a visible factor-by-factor breakdown (company age, industry match, legal structure), not a black box.
- **AI research** - Claude, with real web search, gathers sourced evidence (hiring activity, funding news). If nothing real is found, it says so explicitly rather than inventing a result.
- **AI sales brief** - a structured summary (why now, likely contact, outreach angle, confidence) generated *only* from the verified data and evidence already gathered - this step has no search access at all, so it's structurally unable to invent a new fact.
- **Output validation** - every AI response is checked in code, not just trusted: required fields must be present, and a `found: true` result must carry a real source URL, while `found: false` must carry none. Inconsistent output is rejected before the app ever shows it.
- **CRM sync** - pushes a qualified account into HubSpot as a real Company record, one click.
- **Automated leads** - a dedicated webhook endpoint lets an external tool (n8n) trigger the full pipeline with zero human interaction. It only ever accepts an exact, already-resolved company number - never a name - because automating a name search would reintroduce the exact ambiguity problem (multiple real companies sharing a name) into a context where nothing is watching to catch it and confirm.

---

## Tech stack

React + TypeScript (Vercel) · Node.js + Express (Render) · PostgreSQL (Render) · UK Companies House API · Anthropic Claude API (web search + structured output) · HubSpot API · Clay · n8n 

---

## Architecture

```
User / n8n webhook → Express API → Companies House (verification)
                                 → Claude + web search (evidence)
                                 → Claude, no tools (sales brief - evidence-only)
                                 → Output validation (structure + consistency)
                                 → PostgreSQL (persistence)
                                 → HubSpot (CRM sync)
```

Two independent lookup paths, on purpose:
- **Verify** - resolve one known lead by name, with ambiguity handling
- **Discover** - generate new leads by industry, no name-matching involved at all

They solve different problems a GTM engineer's tooling needs to handle, and are kept separate rather than merged.

---

## Integrations

- **[Clay](./integrations/clay)** - a real enrichment table, built in Clay's own interface, enriching real prospects discovered via `/api/search-industry` with firmographic data (size, industry, LinkedIn).
- **[n8n](./integrations/n8n)** - two independent workflows: a manual-trigger workflow with conditional branching for testing, and a fully automated production workflow that receives Clay's enrichment completion via an outbound webhook and calls this project's `/api/webhook/new-lead` endpoint to trigger the full research pipeline - closing the loop from discovery to CRM sync without a human moving data between systems.

**End-to-end automated flow:** `/api/search-industry` discovers real prospects → Clay enriches each one (name → verified domain → firmographics) → Clay's outbound webhook fires once enrichment completes → n8n receives it and calls `/api/webhook/new-lead` → Companies House verification, AI research, ICP scoring, and PostgreSQL persistence run exactly as they do for a manual search → the result appears in the app's "Automated leads" tab, tagged and separated from manual searches. Tested end-to-end: full round-trip completes in under 20 seconds once Clay's enrichment finishes.

---

## Running locally

```bash
npm install
node --env-file=.env server.js
```
```bash
cd frontend
npm install
npm run dev
```

Required `.env` variables: `COMPANIES_HOUSE_API_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_PORTAL_ID`

---

Built by Apra Khanna.
