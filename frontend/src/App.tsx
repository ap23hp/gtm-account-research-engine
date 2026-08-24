import { useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3001";

// TypeScript types matching what our backend actually returns.
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

function App() {
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<ScoredCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
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
    } catch (err) {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "40px auto",
        fontFamily: "sans-serif",
        padding: "0 20px",
      }}
    >
      <h1>GTM Account Research</h1>
      <p style={{ color: "#666" }}>
        Look up a UK company and see its ICP fit score.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Company name, e.g. Deliveroo"
          style={{ flex: 1, padding: 10, fontSize: 16 }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{ padding: "10px 20px" }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result?.company.ambiguous && result.company.candidates && (
        <div>
          <p>
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
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              <strong>{c.company_name}</strong>
              <div style={{ fontSize: 14, color: "#666" }}>{c.address}</div>
            </div>
          ))}
        </div>
      )}

      {result && !result.company.found && (
        <p>Not found: {result.company.reason}</p>
      )}

      {result?.company.found && !result.company.ambiguous && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>{result.company.company_name}</h2>
          <p style={{ color: "#666" }}>
            {result.company.company_number} · {result.company.status} ·
            incorporated {result.company.incorporated_on}
          </p>

          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 20,
              background:
                result.scored.priority === "Priority A" ? "#d1f7d1" : "#fff3cd",
              fontWeight: "bold",
              marginBottom: 12,
            }}
          >
            {result.scored.priority} ({result.scored.score})
          </div>

          <p style={{ fontSize: 14, color: "#444" }}>
            {result.scored.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
