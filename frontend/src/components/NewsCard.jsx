import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildDisplaySummary, buildDisplayTitle } from "../utils/copy.js";
import { withBase } from "../utils/paths.js";

export function NewsCard({ item, highlighted, timeAgo, mode = "default" }) {
  const [qrData, setQrData] = useState("");
  const imageSrc = item.image_url ? withBase(item.image_url) : "";
  const isFeature = mode === "feature";
  const fallbackImageSrc = isFeature ? withBase("generated/test-news-image.png") : "";
  const displayImageSrc = imageSrc || fallbackImageSrc;
  const usingFallbackImage = !imageSrc && Boolean(fallbackImageSrc);
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
      <div className="feature-grid">
        <div className="feature-visual-wrap">
          {displayImageSrc ? (
            <>
              <img
                className={`feature-visual ${usingFallbackImage ? "feature-visual-fallback" : ""}`}
                src={displayImageSrc}
                alt=""
              />
              <div className={`feature-scrim ${usingFallbackImage ? "feature-scrim-fallback" : ""}`} />
            </>
          ) : (
            <div className="feature-placeholder" aria-hidden="true" />
          )}
        </div>

        <div className="feature-body">
          <div className="card-top">
            <span className="category">{item.category}</span>
            <span className={`badge lang-${item.language}`}>{item.language.toUpperCase()}</span>
          </div>

          <div className="feature-copy">
            <h3>{displayTitle}</h3>
            <p>{displaySummary}</p>
          </div>

          <div className="feature-footer">
            <div className="feature-meta-block">
              <div className="source">{item.source_name}</div>
              <div className="published">{timeAgo}</div>
              <a className="story-link" href={item.source_url} target="_blank" rel="noreferrer">Open source article</a>
            </div>

            {qrData ? (
              <div className="qr-panel">
                <div className="qr-caption">Scan to read</div>
                <img className="qr feature-qr" src={qrData} alt={`QR code for ${item.source_name}`} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
