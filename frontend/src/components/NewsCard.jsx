import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildDisplaySummary, buildDisplayTitle } from "../utils/copy.js";

export function NewsCard({ item, highlighted, timeAgo, mode = "default" }) {
  const [qrData, setQrData] = useState("");
  const isFeature = mode === "feature";
  const displayTitle = buildDisplayTitle(item);
  const displaySummary = buildDisplaySummary(item);

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(item.qr_url, { width: isFeature ? 132 : 96, margin: 1 })
      .then((url) => {
        if (mounted) {
          setQrData(url);
        }
      })
      .catch(() => {
        if (mounted) {
          setQrData("");
        }
      });

    return () => {
      mounted = false;
    };
  }, [item.qr_url, isFeature]);

  return (
    <article className={`news-card ${highlighted ? "highlighted" : ""} ${isFeature ? "feature-card" : ""}`}>
      <div className="feature-grid feature-grid-text-only">
        <div className="feature-body feature-body-text-only">
          <div className="feature-copy feature-copy-text-only">
            <h3>{displayTitle}</h3>
            <p>{displaySummary}</p>
          </div>
        </div>

        <div className="feature-footer feature-footer-text-only">
          <div className="feature-meta-stack">
            <div className="feature-label-row">
              <span className="category">{item.category}</span>
              <span className={`badge lang-${item.language}`}>{item.language.toUpperCase()}</span>
            </div>
            <div className="feature-meta-line">
              <span className="source">{item.source_name}</span>
              <span className="feature-divider">/</span>
              <span className="published">{timeAgo}</span>
              <span className="feature-divider">/</span>
              <a className="story-link" href={item.source_url} target="_blank" rel="noreferrer">Open source article</a>
            </div>
          </div>

          {qrData ? (
            <div className="qr-panel qr-panel-text-only">
              <img className="qr feature-qr" src={qrData} alt={`QR code for ${item.source_name}`} />
              <div className="qr-caption">Scan to read</div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
