import { useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3001";

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
  scored: {
    score: number | null;
    priority: string;
    reasoning: string;
  };
};

type IndustryResult = {
  company: {
    company_name: string;
    company_number: string;
    status: string;
    incorporated_on: string;
  };
  scored: {
    score: number | null;
    priority: string;
    reasoning: string;
  };
};

const INDUSTRY_OPTIONS = [
  { label: "Software development", sic: "62012" },
  { label: "Web portals / platforms", sic: "63120" },
  { label: "Software publishing", sic: "58290" },
  { label: "IT consultancy", sic: "62020" },
  { label: "Data processing / hosting", sic: "63110" },
];

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "16px 18px",
  fontSize: 17,
  borderRadius: 10,
  border: "1.5px solid #d1d5db",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "16px 28px",
  fontSize: 17,
  borderRadius: 10,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function priorityColor(priority: string) {
  if (priority === "Priority A") return { bg: "#dcfce7", text: "#166534" };
  if (priority === "Priority B") return { bg: "#fef9c3", text: "#854d0e" };
  if (priority === "Nurture") return { bg: "#e0e7ff", text: "#3730a3" };
  return { bg: "#fee2e2", text: "#991b1b" };
}

function App() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<ScoredCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sicCode, setSicCode] = useState(INDUSTRY_OPTIONS[0].sic);
  const [industryResults, setIndustryResults] = useState<IndustryResult[]>([]);
  const [industryLoading, setIndustryLoading] = useState(false);

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
    } catch {
      setError("Could not reach the server - is it running?");
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
    } catch {
      setError("Could not reach the server");
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
      setError("Could not reach the server");
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: "64px 32px 100px",
        color: "#111827",
      }}
    >
      <h1
        style={{
          fontSize: 40,
          fontWeight: 700,
          marginBottom: 10,
          letterSpacing: -0.5,
        }}
      >
        GTM Account Research
      </h1>
      <p
        style={{
          color: "#6b7280",
          marginBottom: 56,
          fontSize: 18,
          lineHeight: 1.5,
        }}
      >
        Look up a UK company, or discover prospects by industry — powered by
        real Companies House data.
      </p>

      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#374151",
            marginBottom: 18,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Verify a specific company
        </h2>
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Company name, e.g. Deliveroo"
            style={inputStyle}
          />
          <button onClick={handleSearch} disabled={loading} style={buttonStyle}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 15 }}>{error}</p>}

        {result?.company.ambiguous && result.company.candidates && (
          <div>
            <p style={{ fontSize: 16, color: "#374151", marginBottom: 14 }}>
              <strong>
                {result.company.candidates.length} companies matched.
              </strong>{" "}
              Which one did you mean?
            </p>
            {result.company.candidates.map((c) => (
              <div
                key={c.company_number}
                onClick={() => handlePickCandidate(c.company_number)}
                style={{
                  padding: 18,
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  marginBottom: 10,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#9ca3af")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#e5e7eb")
                }
              >
                <strong style={{ fontSize: 16 }}>{c.company_name}</strong>
                <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                  {c.address}
                </div>
              </div>
            ))}
          </div>
        )}

        {result && !result.company.found && (
          <p style={{ fontSize: 16, color: "#6b7280" }}>
            Not found: {result.company.reason}
          </p>
        )}

        {result?.company.found && !result.company.ambiguous && (
          <div
            style={{
              border: "1.5px solid #e5e7eb",
              borderRadius: 14,
              padding: 32,
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
              {result.company.company_name}
            </h3>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 18 }}>
              {result.company.company_number} · {result.company.status} ·
              incorporated {result.company.incorporated_on}
            </p>

            <div
              style={{
                display: "inline-block",
                padding: "7px 18px",
                borderRadius: 999,
                background: priorityColor(result.scored.priority).bg,
                color: priorityColor(result.scored.priority).text,
                fontWeight: 700,
                fontSize: 15,
                marginBottom: 18,
              }}
            >
              {result.scored.priority} · {result.scored.score ?? "—"}
            </div>

            <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.7 }}>
              {result.scored.reasoning}
            </p>
          </div>
        )}
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e5e7eb",
          margin: "48px 0",
        }}
      />

      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#374151",
            marginBottom: 18,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Discover prospects by industry
        </h2>
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
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
            style={buttonStyle}
          >
            {industryLoading ? "Loading…" : "Find prospects"}
          </button>
        </div>

        {industryResults.length > 0 && (
          <div
            style={{
              border: "1.5px solid #e5e7eb",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 15,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                  <th
                    style={{
                      padding: "16px 18px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    Company
                  </th>
                  <th
                    style={{
                      padding: "16px 18px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    Incorporated
                  </th>
                  <th
                    style={{
                      padding: "16px 18px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    Priority
                  </th>
                  <th
                    style={{
                      padding: "16px 18px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {industryResults.map((r) => (
                  <tr
                    key={r.company.company_number}
                    onClick={() => handleRowClick(r.company.company_number)}
                    style={{
                      borderTop: "1px solid #f0f0f0",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "16px 18px", fontWeight: 500 }}>
                      {r.company.company_name}
                    </td>
                    <td style={{ padding: "16px 18px", color: "#6b7280" }}>
                      {r.company.incorporated_on}
                    </td>
                    <td style={{ padding: "16px 18px" }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 700,
                          background: priorityColor(r.scored.priority).bg,
                          color: priorityColor(r.scored.priority).text,
                        }}
                      >
                        {r.scored.priority}
                      </span>
                    </td>
                    <td style={{ padding: "16px 18px", fontWeight: 600 }}>
                      {r.scored.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
