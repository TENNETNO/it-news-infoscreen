import { useMemo } from "react";

function shortSummary(item) {
  const text = (item.summary || item.title || "").replace(/\s+/g, " ").trim();
  if (text.length <= 130) {
    return text;
  }
  return `${text.slice(0, 127).trim()}...`;
}

export function Ticker({ items }) {
  const text = useMemo(() => {
    const rows = items.map((item) => `${shortSummary(item)} Resource: ${item.source_name}`);
    return rows.length ? rows.join("  ||  ") : "No major stories from the last 10 days yet.";
  }, [items]);

  const repeated = `${text}        ${text}`;

  return (
    <footer className="ticker" aria-live="polite">
      <div className="ticker-label">Latest</div>
      <div className="ticker-track-wrap">
        <div className="ticker-track">{repeated}</div>
      </div>
    </footer>
  );
}
