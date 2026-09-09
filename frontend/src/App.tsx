import { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "https://gtm-account-research-engine.onrender.com";

type Candidate = {
  company_name: string;
  company_number: string;
  address: string;
};
type Address = {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  postal_code?: string;
  country?: string;
};
type CompanyResult = {
  found: boolean;
  ambiguous?: boolean;
  company_name?: string;
  company_number?: string;
  status?: string;
  incorporated_on?: string;
  sic_codes?: string[];
  registered_address?: Address;
  reason?: string;
  candidates?: Candidate[];
};
type Factor = { label: string; passed: boolean; points: string; width: number };
type Scored = {
  score: number | null;
  priority: string;
  reasoning: string;
  factors: Factor[];
};
type Signal = {
  type: string;
  found: boolean;
  claim: string | null;
  source_url: string | null;
  date: string | null;
};
type Brief = {
  why_now: string;
  likely_contact_role: string;
  outreach_angle: string;
  confidence: string;
};
type ProspectRow = {
  company: {
    company_name: string;
    company_number: string;
    incorporated_on: string;
  };
  scored: Scored;
};
type Lead = {
  id: number;
  company_name: string;
  company_number: string;
  score: number | null;
  priority: string;
  searched_at: string;
  source?: string;
};

const INDUSTRY_OPTIONS = [
  { label: "Software development", sic: "62012" },
  { label: "IT consultancy", sic: "62020" },
  { label: "Data processing / hosting", sic: "63110" },
  { label: "Business & management consultancy", sic: "70229" },
];

const SIC_DESCRIPTIONS: Record<string, string> = {
  "62012": "Business and domestic software development",
  "62020": "Information technology consultancy activities",
  "62030": "Computer facilities management activities",
  "62090": "Other information technology service activities",
  "63110": "Data processing, hosting and related activities",
  "63120": "Web portals",
  "58290": "Other software publishing",
  "70229": "Management consultancy activities other than financial management",
  "73110": "Advertising agencies",
  "73200": "Market research and public opinion polling",
  "47910": "Retail sale via mail order houses or via internet",
  "64209": "Activities of other holding companies",
  "64191": "Banks",
  "64999": "Other financial service activities",
  "78109": "Activities of employment placement agencies",
  "78300":
    "Human resources provision and management of human resources functions",
  "82200": "Activities of call centres",
  "74909": "Other professional, scientific and technical activities",
  "33190": "Repair of other equipment",
};

function sicLabel(codes?: string[]) {
  if (!codes || codes.length === 0) return null;
  return codes
    .map(
      (c) =>
        SIC_DESCRIPTIONS[c] ||
        `Code ${c} — description not in our reference list`,
    )
    .join(", ");
}

function priorityClass(priority: string) {
  if (priority === "Priority A") return "priority-a";
  if (priority === "Priority B") return "priority-b";
  if (priority === "Nurture") return "nurture";
  if (priority === "Reject") return "reject";
  return "neutral";
}
function confidenceClass(conf: string) {
  if (conf === "high") return "conf-high";
  if (conf === "low") return "conf-low";
  return "conf-medium";
}
function formatAddress(a?: Address) {
  if (!a) return "—";
  return [a.address_line_1, a.locality, a.postal_code]
    .filter(Boolean)
    .join(", ");
}

function ScoreGauge({ score }: { score: number | null }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  const offset = c * (1 - pct / 100);
  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <circle
        cx="56"
        cy="56"
        r={r}
        stroke="var(--border-light)"
        strokeWidth="9"
        fill="none"
      />
      <circle
        cx="56"
        cy="56"
        r={r}
        stroke="var(--score-bar-fill)"
        strokeWidth="9"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 56 56)"
      />
      <text
        x="56"
        y="52"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill="var(--text)"
      >
        {score ?? "—"}
      </text>
      <text
        x="56"
        y="70"
        textAnchor="middle"
        fontSize="12"
        fill="var(--text-muted)"
      >
        of 100
      </text>
    </svg>
  );
}

function AutomationBadge() {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: "#e0e7ff",
        color: "#3730a3",
      }}
    >
      via automation
    </span>
  );
}

export default function App() {
  const [mode, setMode] = useState<"search" | "prospects">("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [company, setCompany] = useState<CompanyResult | null>(null);
  const [scored, setScored] = useState<Scored | null>(null);
  const [tab, setTab] = useState<"overview" | "signals" | "brief">("overview");

  const [researching, setResearching] = useState(false);
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);

  const [syncStatus, setSyncStatus] = useState<{
    success: boolean;
    url?: string;
    message: string;
  } | null>(null);

  const [industry, setIndustry] = useState(INDUSTRY_OPTIONS[0].sic);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);

  const [history, setHistory] = useState<Lead[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/leads`);
      const data = await res.json();
      setHistory(data.leads || []);
    } catch {
      /* silent */
    }
  }

  function resetResult() {
    setCompany(null);
    setScored(null);
    setSignals(null);
    setBrief(null);
    setSyncStatus(null);
    setTab("overview");
    setError("");
  }

  async function runSearch() {
    if (!query.trim()) return;
    setMode("search");
    resetResult();
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/lookup?name=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setCompany(data.company);
      setScored(data.scored);
      loadHistory();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function openByNumber(companyNumber: string, companyName?: string) {
    resetResult();
    setLoading(true);
    setMode("search");
    if (companyName) setQuery(companyName);
    try {
      const res = await fetch(
        `${API_BASE}/api/lookup-by-number?number=${companyNumber}`,
      );
      const data = await res.json();
      setCompany(data.company);
      setScored(data.scored);
      if (data.company?.company_name) setQuery(data.company.company_name);
      loadHistory();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function runResearch() {
    if (!company?.company_number) return;
    setResearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyNumber: company.company_number }),
      });
      const data = await res.json();
      if (data.evidence) setSignals(data.evidence.signals);
      if (data.brief) setBrief(data.brief);
      loadHistory();
    } catch {
      setError("Research failed - could not reach the server.");
    } finally {
      setResearching(false);
    }
  }

  async function syncToCrm() {
    if (!company?.company_number) return;
    setSyncStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync-to-crm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyNumber: company.company_number }),
      });
      const data = await res.json();
      if (data.synced)
        setSyncStatus({
          success: true,
          url: data.hubspot_url,
          message: "Synced",
        });
      else
        setSyncStatus({ success: false, message: data.error || "Sync failed" });
    } catch {
      setSyncStatus({ success: false, message: "Could not reach the server" });
    }
  }

  async function findProspects() {
    setProspectsLoading(true);
    setProspects([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/search-industry?sicCodes=${industry}&incorporatedFrom=2018-01-01&size=15`,
      );
      const data = await res.json();
      setProspects(data.results || []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setProspectsLoading(false);
    }
  }

  const showEmpty = mode === "search" && !company && !loading && !error;
  const showAmbiguous = mode === "search" && company?.ambiguous;
  const showNotFound = mode === "search" && company && !company.found;
  const showResult = mode === "search" && company?.found && !company.ambiguous;
  const canSync =
    scored?.priority === "Priority A" || scored?.priority === "Priority B";

  return (
    <div className="page">
      <aside className="dashboard-nav">
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "0 6px",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "var(--accent)",
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>
            GTM Account
            <br />
            Research Engine
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className={`nav-btn ${mode === "search" ? "active" : ""}`}
            onClick={() => setMode("search")}
          >
            Search a company
          </button>
          <button
            className={`nav-btn ${mode === "prospects" ? "active" : ""}`}
            onClick={() => setMode("prospects")}
          >
            Find prospects
          </button>
        </nav>
        <div className="nav-footnote">
          <div
            style={{
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 5,
            }}
          >
            Built for GTM
          </div>
          Companies House, verified signals and an AI brief. Nothing else.
        </div>
      </aside>

      <main
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header className="top-header">
          <div
            style={{ flex: "1 1 320px", minWidth: 0, display: "flex", gap: 10 }}
          >
            <input
              className="field"
              style={{ flex: "1 1 auto", minWidth: 0 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Enter a company name or domain..."
            />
            <button
              className="btn-primary"
              onClick={runSearch}
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
          <div className="avatar">AP</div>
        </header>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 24,
            padding: "26px 22px 100px",
            flex: "1 1 auto",
          }}
        >
          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div className="mode-tabs-wrapper">
              <div className="mode-tabs">
                <button
                  className={`mode-tab ${mode === "search" ? "active" : ""}`}
                  onClick={() => setMode("search")}
                >
                  Search a company
                </button>
                <button
                  className={`mode-tab ${mode === "prospects" ? "active" : ""}`}
                  onClick={() => setMode("prospects")}
                >
                  Find prospects
                </button>
              </div>
            </div>

            {error && (
              <p style={{ color: "var(--error)", fontSize: 16 }}>{error}</p>
            )}

            {mode === "prospects" && (
              <section className="card">
                <h2
                  style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 600 }}
                >
                  Find prospects by industry
                </h2>
                <p
                  style={{
                    margin: "0 0 18px",
                    fontSize: 15,
                    color: "var(--text-secondary)",
                  }}
                >
                  Returns companies ranked by ICP score, drawn from Companies
                  House records.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select
                    className="field"
                    style={{ flex: "1 1 260px" }}
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.sic} value={o.sic}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-primary"
                    onClick={findProspects}
                    disabled={prospectsLoading}
                  >
                    {prospectsLoading ? "Loading…" : "Find prospects"}
                  </button>
                </div>
                {prospects.length > 0 && (
                  <div
                    className="prospect-table-wrap"
                    style={{
                      marginTop: 20,
                      border: "1px solid var(--border-light)",
                      borderRadius: 12,
                    }}
                  >
                    <table className="prospect-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Incorporated</th>
                          <th>Priority</th>
                          <th style={{ textAlign: "right" }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prospects.map((r) => (
                          <tr
                            key={r.company.company_number}
                            onClick={() =>
                              openByNumber(
                                r.company.company_number,
                                r.company.company_name,
                              )
                            }
                          >
                            <td style={{ fontWeight: 600 }}>
                              {r.company.company_name}
                            </td>
                            <td style={{ color: "var(--text-secondary)" }}>
                              {r.company.incorporated_on}
                            </td>
                            <td>
                              <span
                                className={`badge ${priorityClass(r.scored.priority)}`}
                              >
                                {r.scored.priority}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              {r.scored.score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {showEmpty && (
              <section className="dashed-card">
                <h2 style={{ margin: "0 0 8px", fontWeight: 600 }}>
                  Verify a specific company
                </h2>
                <p
                  style={{
                    margin: "0 auto",
                    maxWidth: 440,
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  Search a name or domain to resolve it against Companies House,
                  then score it and pull verified signals.
                </p>
              </section>
            )}

            {showAmbiguous && (
              <section className="card">
                <h2
                  style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}
                >
                  Multiple companies found — human review required
                </h2>
                <p
                  style={{
                    margin: "0 0 18px",
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  Rather than guessing which company you meant, the system flags
                  this for you to confirm — the same discipline it applies
                  everywhere it isn't certain. Pick the correct one below.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {company?.candidates?.map((c) => (
                    <button
                      key={c.company_number}
                      onClick={() =>
                        openByNumber(c.company_number, c.company_name)
                      }
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 14,
                        alignItems: "center",
                        textAlign: "left",
                        padding: "16px",
                        border: "1px solid var(--border-light)",
                        borderRadius: 11,
                        background: "var(--bg)",
                        cursor: "pointer",
                        fontSize: 15,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{c.company_name}</span>
                      <span
                        style={{ color: "var(--text-secondary)", fontSize: 14 }}
                      >
                        {c.address}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showNotFound && (
              <section className="card">
                <p style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>
                  No company found. {company?.reason}
                </p>
              </section>
            )}

            {showResult && company && scored && (
              <>
                <section className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 24,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 320px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <h2
                          style={{ margin: 0, fontSize: 26, fontWeight: 700 }}
                        >
                          {company.company_name}
                        </h2>
                        <span className="badge priority-a">
                          {company.status}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px 32px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "var(--text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            Company Number
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>
                            {company.company_number}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "var(--text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            Incorporated
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>
                            {company.incorporated_on}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "var(--text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            SIC Code
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>
                            {company.sic_codes?.join(", ")}
                          </div>
                          {sicLabel(company.sic_codes) && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--text-secondary)",
                                marginTop: 2,
                              }}
                            >
                              {sicLabel(company.sic_codes)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "var(--text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            Registered Address
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>
                            {formatAddress(company.registered_address)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 20,
                        alignItems: "flex-start",
                      }}
                    >
                      <ScoreGauge score={scored.score} />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          minWidth: 150,
                        }}
                      >
                        <span
                          className={`badge ${priorityClass(scored.priority)}`}
                          style={{ textAlign: "center" }}
                        >
                          {scored.priority}
                        </span>
                        <button
                          className="btn-secondary"
                          onClick={runResearch}
                          disabled={researching}
                        >
                          {researching ? "Researching…" : "Research"}
                        </button>
                        {canSync && (
                          <button className="btn-primary" onClick={syncToCrm}>
                            Sync to CRM
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {syncStatus && (
                    <p
                      style={{
                        marginTop: 14,
                        fontSize: 14,
                        color: syncStatus.success
                          ? "var(--priority-a-fg)"
                          : "var(--error)",
                      }}
                    >
                      {syncStatus.success ? (
                        <>
                          ✓ Synced —{" "}
                          <a
                            href={syncStatus.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            view in HubSpot
                          </a>
                        </>
                      ) : (
                        syncStatus.message
                      )}
                    </p>
                  )}

                  <div className="result-tabs" style={{ marginTop: 24 }}>
                    {(["overview", "signals", "brief"] as const).map((t) => (
                      <button
                        key={t}
                        className={`result-tab ${tab === t ? "active" : ""}`}
                        onClick={() => setTab(t)}
                      >
                        {t === "overview"
                          ? "Overview"
                          : t === "signals"
                            ? `Signals (${signals?.length ?? 0})`
                            : "AI Sales Brief"}
                      </button>
                    ))}
                  </div>

                  {tab === "overview" && (
                    <div style={{ paddingTop: 22 }}>
                      <h3
                        style={{
                          margin: "0 0 18px",
                          fontSize: 19,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        ICP score breakdown
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 20,
                        }}
                      >
                        {(scored.factors || []).map((f, i) => (
                          <div key={i}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 8,
                                fontSize: 17,
                              }}
                            >
                              <span
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 500,
                                }}
                              >
                                {f.label}
                              </span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: f.passed
                                    ? "var(--priority-a-fg)"
                                    : "var(--text)",
                                }}
                              >
                                {f.points}
                              </span>
                            </div>
                            <div className="score-bar-track">
                              <div
                                className="score-bar-fill"
                                style={{
                                  width: `${f.width}%`,
                                  background: f.passed
                                    ? "var(--score-bar-fill)"
                                    : "var(--border)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        {(!scored.factors || scored.factors.length === 0) && (
                          <p style={{ fontSize: 16, color: "var(--text)" }}>
                            No factor breakdown available for this result.
                          </p>
                        )}
                      </div>

                      <p
                        style={{
                          marginTop: 20,
                          fontSize: 16.5,
                          lineHeight: 1.7,
                          color: "var(--text)",
                        }}
                      >
                        {scored.reasoning}
                      </p>

                      <div
                        style={{
                          marginTop: 28,
                          paddingTop: 24,
                          borderTop: "1.5px solid var(--border)",
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 10px",
                            fontSize: 18,
                            fontWeight: 700,
                            color: "var(--text)",
                          }}
                        >
                          Register record
                        </h3>
                        <p
                          style={{
                            margin: "0 0 18px",
                            fontSize: 16,
                            color: "var(--text)",
                            lineHeight: 1.6,
                          }}
                        >
                          Every field on this card comes from the Companies
                          House filing for {company.company_number}. Scoring
                          uses only status, incorporation date, SIC code and
                          country of registration.
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 17,
                              paddingBottom: 10,
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <span style={{ color: "var(--text)" }}>Status</span>
                            <strong style={{ color: "var(--text)" }}>
                              {company.status}
                            </strong>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 17,
                              paddingBottom: 10,
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <span style={{ color: "var(--text)" }}>
                              Company age
                            </span>
                            <strong style={{ color: "var(--text)" }}>
                              {company.incorporated_on
                                ? new Date().getFullYear() -
                                  new Date(
                                    company.incorporated_on,
                                  ).getFullYear()
                                : "—"}{" "}
                              years
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "signals" && (
                    <div style={{ paddingTop: 20 }}>
                      {!signals ? (
                        <p
                          style={{
                            fontSize: 15,
                            color: "var(--text-secondary)",
                          }}
                        >
                          Click "Research" above to gather real hiring and
                          funding signals.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          {signals.map((sig, i) => (
                            <div
                              key={i}
                              style={{
                                padding: 16,
                                border: "1px solid var(--border-light)",
                                borderRadius: 11,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: 8,
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: 15,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {sig.type}
                                </strong>
                                <span
                                  className={`badge ${sig.found ? "priority-a" : "neutral"}`}
                                >
                                  {sig.found
                                    ? "Verified"
                                    : "No verified signal found"}
                                </span>
                              </div>
                              <p
                                style={{
                                  margin: "0 0 8px",
                                  fontSize: 15,
                                  color: "var(--text)",
                                }}
                              >
                                {sig.claim ||
                                  "No confirmable result was found for this signal."}
                              </p>
                              {sig.source_url && (
                                <a
                                  href={sig.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: 14 }}
                                >
                                  source ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "brief" && (
                    <div style={{ paddingTop: 20 }}>
                      {!brief ? (
                        <p
                          style={{
                            fontSize: 15,
                            color: "var(--text-secondary)",
                          }}
                        >
                          Click "Research" above to generate an AI sales brief.
                        </p>
                      ) : (
                        <div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: 18,
                                fontWeight: 600,
                              }}
                            >
                              AI sales brief
                            </h3>
                            <span
                              className={`badge ${confidenceClass(brief.confidence)}`}
                            >
                              Confidence: {brief.confidence}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 14,
                            }}
                          >
                            <div
                              style={{
                                background: "var(--surface-muted)",
                                borderRadius: 12,
                                padding: 18,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                }}
                              >
                                Why now
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 15.5,
                                  lineHeight: 1.6,
                                  color: "var(--text)",
                                }}
                              >
                                {brief.why_now}
                              </p>
                            </div>
                            <div
                              style={{
                                background: "var(--surface-muted)",
                                borderRadius: 12,
                                padding: 18,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                }}
                              >
                                Likely contact role
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 15.5,
                                  lineHeight: 1.6,
                                  color: "var(--text)",
                                }}
                              >
                                {brief.likely_contact_role}
                              </p>
                            </div>
                          </div>
                          <div
                            style={{
                              background: "var(--surface-muted)",
                              borderRadius: 12,
                              padding: 18,
                              marginTop: 14,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color: "var(--text-muted)",
                                marginBottom: 8,
                              }}
                            >
                              Outreach angle
                            </div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 15.5,
                                lineHeight: 1.6,
                                color: "var(--text)",
                              }}
                            >
                              {brief.outreach_angle}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="history-rail">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 700 }}>History</h3>
              <span style={{ fontSize: 15, color: "var(--text-muted)" }}>
                {history.length}
              </span>
            </div>
            {history.length === 0 ? (
              <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
                Companies you score will be saved here.
              </p>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="history-item"
                  onClick={() => openByNumber(h.company_number, h.company_name)}
                >
                  <div>{h.company_name}</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 6,
                      alignItems: "center",
                    }}
                  >
                    <span className={`badge ${priorityClass(h.priority)}`}>
                      {h.priority}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      {h.score}
                    </span>
                    {h.source === "webhook" && <AutomationBadge />}
                  </div>
                </div>
              ))
            )}
          </aside>
        </div>
      </main>

      <button className="history-fab" onClick={() => setHistoryOpen(true)}>
        History{" "}
        <span
          style={{
            background: "#fff",
            color: "var(--text)",
            borderRadius: 999,
            padding: "2px 9px",
            fontSize: 14,
          }}
        >
          {history.length}
        </span>
      </button>

      {historyOpen && (
        <>
          <div
            onClick={() => setHistoryOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20,21,23,.32)",
              zIndex: 10,
            }}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              background: "var(--bg)",
              borderRadius: "16px 16px 0 0",
              maxHeight: "74vh",
              overflowY: "auto",
              zIndex: 11,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 19 }}>History</h3>
              <span
                onClick={() => setHistoryOpen(false)}
                style={{ cursor: "pointer", fontSize: 22 }}
              >
                ×
              </span>
            </div>
            {history.map((h) => (
              <div
                key={h.id}
                className="history-item"
                onClick={() => {
                  openByNumber(h.company_number, h.company_name);
                  setHistoryOpen(false);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 16 }}>{h.company_name}</div>
                  {h.source === "webhook" && <AutomationBadge />}
                </div>
                <span className={`badge ${priorityClass(h.priority)}`}>
                  {h.priority}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
