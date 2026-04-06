import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { withBase } from "../utils/paths.js";

export function NewsCard({ item, highlighted, timeAgo }) {
  const [qrData, setQrData] = useState("");
  const imageSrc = item.image_url ? withBase(item.image_url) : "";

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(item.qr_url, { width: 96, margin: 1 })
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
  }, [item.qr_url]);

  return (
    <article className={`news-card ${highlighted ? "highlighted" : ""} ${imageSrc ? "has-image" : ""}`}>
      <div className="card-top">
        <span className="category">{item.category}</span>
        <span className={`badge lang-${item.language}`}>{item.language.toUpperCase()}</span>
      </div>

      {imageSrc ? (
        <div className="card-hero">
          <img className="news-image" src={imageSrc} alt="" />
          <img className="hero-logo" src={withBase("mowi-logo.svg")} alt="Mowi" />
        </div>
      ) : null}

      <h3>{item.title}</h3>
      <p>{item.summary}</p>

      <div className="card-bottom">
        <div>
          <div className="source">{item.source_name}</div>
          <div className="published">{timeAgo}</div>
        </div>
        {qrData ? <img className="qr" src={qrData} alt={`QR code for ${item.source_name}`} /> : null}
      </div>
    </article>
  );
}
