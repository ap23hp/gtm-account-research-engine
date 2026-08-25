import { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "https://gtm-account-research-engine.onrender.com";

type Candidate = {
  company_name: string;
  company_number: string;
  address: string;
};
type ScoredCompany = {
  company: {
    found: boolean;
    ambiguous?: boolean;
    company_name?: string;
    company_number?: string;
    status?: string;
    incorporated_on?: string;
    sic_codes?: string[];
    reason?: string;
    candidates?: Candidate[];
  };
  scored: { score: number | null; priority: string; reasoning: string };
};
type IndustryResult = {
  company: {
    company_name: string;
    company_number: string;
    status: string;
    incorporated_on: string;
  };
  scored: { score: number | null; priority: string; reasoning: string };
};
type Lead = {
  id: number;
  company_name: string;
  score: number | null;
  priority: string;
  reasoning: string;
  searched_at: string;
};

const INDUSTRY_OPTIONS = [
  { label: "Software development", sic: "62012" },
  { label: "Web portals / platforms", sic: "63120" },
  { label: "Software publishing", sic: "58290" },
  { label: "IT consultancy", sic: "62020" },
  { label: "Data processing / hosting", sic: "63110" },
  { label: "Computer facilities management", sic: "62030" },
  { label: "Business & management consultancy", sic: "70229" },
  { label: "Advertising agencies", sic: "73110" },
];

function priorityColor(priority: string) {
  if (priority === "Priority A") return { bg: "#e7f6ec", text: "#1a6b39" };
  if (priority === "Priority B") return { bg: "#fdf3d6", text: "#7a5a09" };
  if (priority === "Nurture") return { bg: "#f0ebfb", text: "#5b3fa8" };
  return { bg: "#fdeaea", text: "#a52a2a" };
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "13px 15px",
  fontSize: 16,
  fontFamily: "inherit",
  color: "#17181a",
  background: "#fff",
  border: "1px solid #d9dade",
  borderRadius: 10,
  outline: "none",
};
const buttonPrimary: React.CSSProperties = {
  padding: "13px 24px",
  fontSize: 16,
  fontFamily: "inherit",
  fontWeight: 550,
  color: "#fff",
  background: "#17181a",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};
const buttonSecondary: React.CSSProperties = {
  padding: "13px 24px",
  fontSize: 16,
  fontFamily: "inherit",
  fontWeight: 550,
  color: "#17181a",
  background: "#fff",
  border: "1px solid #d9dade",
  borderRadius: 10,
  cursor: "pointer",
};

function App() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<ScoredCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sicCode, setSicCode] = useState(INDUSTRY_OPTIONS[0].sic);
  const [industryResults, setIndustryResults] = useState<IndustryResult[]>([]);
  const [industryLoading, setIndustryLoading] = useState(false);

  const [history, setHistory] = useState<Lead[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load saved history once, when the app first opens
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

  async function handleSearch() {
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/lookup?name=${encodeURIComponent(companyName)}`,
      );
      const data = await res.json();
      setResult(data);
      loadHistory();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePickCandidate(companyNumber: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/lookup-by-number?number=${companyNumber}`,
      );
      const data = await res.json();
      setResult(data);
      loadHistory();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleIndustrySearch() {
    setIndustryLoading(true);
    setIndustryResults([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/search-industry?sicCodes=${sicCode}&incorporatedFrom=2018-01-01&size=15`,
      );
      const data = await res.json();
      setIndustryResults(data.results || []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIndustryLoading(false);
    }
  }

  async function handleRowClick(companyNumber: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/lookup-by-number?number=${companyNumber}`,
      );
      const data = await res.json();
      setResult(data);
      loadHistory();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const HistoryList = () =>
    history.length === 0 ? (
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#9a9ea5" }}>
        Companies you score will be saved here.
      </p>
    ) : (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {history.map((lead) => {
          const c = priorityColor(lead.priority);
          return (
            <div
              key={lead.id}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid #f2f2f3",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>
                {lead.company_name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    padding: "4px 10px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: c.text,
                    background: c.bg,
                    borderRadius: 999,
                  }}
                >
                  {lead.priority}
                </span>
                <span style={{ fontSize: 14, color: "#6b6f76" }}>
                  {lead.score}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#9a9ea5" }}>
                {new Date(lead.searched_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#17181a",
      }}
    >
      <div className="layout">
        <div className="main-col">
          <div style={{ maxWidth: 640 }}>
            <h1
              style={{
                margin: "0 0 8px",
                fontSize: 44,
                lineHeight: 1.15,
                fontWeight: 650,
                letterSpacing: "-.02em",
              }}
            >
              GTM Account Research
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.55,
                color: "#6b6f76",
              }}
            >
              Score any UK company against your ideal customer profile, using
              live Companies House data.
            </p>
          </div>

          <div
            style={{
              marginTop: 40,
              paddingTop: 36,
              borderTop: "1px solid #ececee",
              maxWidth: 640,
            }}
          >
            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 600 }}>
              Verify a specific company
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "#6b6f76" }}>
              Look up a company you already know by name.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Company name, e.g. Deliveroo"
                style={inputStyle}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                style={
                  loading
                    ? {
                        ...buttonPrimary,
                        color: "#9a9ea5",
                        background: "#f1f2f3",
                      }
                    : buttonPrimary
                }
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>

            {error && (
              <p
                style={{
                  margin: "22px 0 0",
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: "#c0392b",
                }}
              >
                {error}
              </p>
            )}

            {!error && !result && (
              <div
                style={{
                  marginTop: 22,
                  padding: "36px 28px",
                  border: "1px dashed #dfe0e3",
                  borderRadius: 14,
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: 15.5, color: "#6b6f76", lineHeight: 1.6 }}
                >
                  No company scored yet.
                  <br />
                  Search a name above, or pick an industry below.
                </div>
              </div>
            )}

            {result?.company.ambiguous && result.company.candidates && (
              <>
                <p
                  style={{
                    margin: "24px 0 14px",
                    fontSize: 15.5,
                    lineHeight: 1.6,
                    color: "#3b3e43",
                  }}
                >
                  {result.company.candidates.length} companies matched "
                  {companyName}". Choose the one you meant:
                </p>
                <div
                  style={{
                    border: "1px solid #e9eaec",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  {result.company.candidates.map((c, i) => (
                    <div
                      key={c.company_number}
                      onClick={() => handlePickCandidate(c.company_number)}
                      style={{
                        padding: "16px 20px",
                        borderBottom:
                          i < result.company.candidates!.length - 1
                            ? "1px solid #f2f2f3"
                            : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 500 }}>
                        {c.company_name}
                      </div>
                      <div
                        style={{ marginTop: 4, fontSize: 13, color: "#6b6f76" }}
                      >
                        {c.address}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {result && !result.company.found && (
              <p
                style={{
                  margin: "22px 0 0",
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: "#3b3e43",
                }}
              >
                No company found for "{companyName}". {result.company.reason}
              </p>
            )}

            {result?.company.found &&
              !result.company.ambiguous &&
              (() => {
                const c = priorityColor(result.scored.priority);
                return (
                  <div
                    style={{
                      marginTop: 24,
                      border: "1px solid #e9eaec",
                      borderRadius: 14,
                      boxShadow: "0 1px 2px rgba(0,0,0,.05)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "26px 28px 24px",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 24,
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: "0 0 10px",
                            fontSize: 25,
                            fontWeight: 600,
                            letterSpacing: "-.01em",
                          }}
                        >
                          {result.company.company_name}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 20,
                            fontSize: 14,
                            color: "#6b6f76",
                          }}
                        >
                          <span>
                            No.{" "}
                            <span style={{ color: "#17181a" }}>
                              {result.company.company_number}
                            </span>
                          </span>
                          <span>
                            Status{" "}
                            <span style={{ color: "#17181a" }}>
                              {result.company.status}
                            </span>
                          </span>
                          <span>
                            Incorporated{" "}
                            <span style={{ color: "#17181a" }}>
                              {result.company.incorporated_on}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 14px",
                          background: c.bg,
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: c.text,
                          }}
                        >
                          {result.scored.priority}
                        </span>
                        <span
                          style={{ fontSize: 13, color: c.text, opacity: 0.65 }}
                        >
                          {result.scored.score ?? "—"}
                        </span>
                      </div>
                    </div>
                    {result.scored.score !== null && (
                      <div style={{ padding: "0 28px 22px" }}>
                        <div
                          style={{
                            height: 6,
                            background: "#f1f2f3",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${result.scored.score}%`,
                              height: "100%",
                              background: "#2e9e5b",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 7,
                            fontSize: 11.5,
                            color: "#9a9ea5",
                          }}
                        >
                          <span>Fit score</span>
                          <span>{result.scored.score} / 100</span>
                        </div>
                      </div>
                    )}
                    <div
                      style={{
                        padding: "22px 28px 26px",
                        borderTop: "1px solid #f1f2f3",
                        background: "#fcfcfc",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          color: "#9a9ea5",
                          marginBottom: 10,
                        }}
                      >
                        Scoring reasoning
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 15.5,
                          lineHeight: 1.65,
                          color: "#3b3e43",
                        }}
                      >
                        {result.scored.reasoning}
                      </p>
                    </div>
                  </div>
                );
              })()}
          </div>

          <div
            style={{
              marginTop: 40,
              paddingTop: 36,
              borderTop: "1px solid #ececee",
              maxWidth: 640,
            }}
          >
            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 600 }}>
              Discover prospects by industry
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "#6b6f76" }}>
              Generate a scored, ranked list of companies in a target sector.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={sicCode}
                onChange={(e) => setSicCode(e.target.value)}
                style={inputStyle}
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.sic} value={opt.sic}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleIndustrySearch}
                disabled={industryLoading}
                style={buttonSecondary}
              >
                {industryLoading ? "Loading…" : "Find prospects"}
              </button>
            </div>

            {industryResults.length > 0 && (
              <div
                style={{
                  marginTop: 22,
                  border: "1px solid #e9eaec",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 130px 120px 64px",
                    gap: 16,
                    padding: "13px 22px",
                    background: "#fafafa",
                    borderBottom: "1px solid #ececee",
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                    color: "#9a9ea5",
                  }}
                >
                  <span>Company</span>
                  <span>Incorporated</span>
                  <span>Priority</span>
                  <span style={{ textAlign: "right" }}>Score</span>
                </div>
                {industryResults.map((r, i) => {
                  const c = priorityColor(r.scored.priority);
                  return (
                    <div
                      key={r.company.company_number}
                      onClick={() => handleRowClick(r.company.company_number)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 130px 120px 64px",
                        gap: 16,
                        padding: "16px 22px",
                        borderBottom:
                          i < industryResults.length - 1
                            ? "1px solid #f2f2f3"
                            : "none",
                        fontSize: 15.5,
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        {r.company.company_name}
                      </span>
                      <span style={{ color: "#6b6f76" }}>
                        {r.company.incorporated_on}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.text,
                            background: c.bg,
                            borderRadius: 999,
                          }}
                        >
                          {r.scored.priority}
                        </span>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        {r.scored.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <div className="sidebar">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: ".01em",
              }}
            >
              History
            </h2>
            <span style={{ fontSize: 16, color: "#9a9ea5" }}>
              {history.length}
            </span>
          </div>
          <HistoryList />
        </div>
      </div>

      {/* MOBILE FLOATING BUTTON */}
      <button
        className="mobile-history-btn"
        onClick={() => {
          loadHistory();
          setHistoryOpen(true);
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 550 }}>History</span>
        <span
          style={{
            minWidth: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
            fontSize: 12.5,
            fontWeight: 600,
            color: "#17181a",
            background: "#fff",
            borderRadius: 999,
          }}
        >
          {history.length}
        </span>
      </button>

      {/* MOBILE SLIDE-UP PANEL */}
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
              background: "#fff",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -2px 20px rgba(0,0,0,.14)",
              maxHeight: "74vh",
              overflow: "hidden",
              zIndex: 11,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 14px",
                borderBottom: "1px solid #f1f2f3",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
                  History
                </h2>
                <span style={{ fontSize: 15, color: "#9a9ea5" }}>
                  {history.length} saved
                </span>
              </div>
              <div
                onClick={() => setHistoryOpen(false)}
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "-10px -10px -10px 0",
                  fontSize: 20,
                  color: "#6b6f76",
                  cursor: "pointer",
                }}
              >
                ×
              </div>
            </div>
            <div style={{ padding: "4px 20px 26px", overflowY: "auto" }}>
              <HistoryList />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
