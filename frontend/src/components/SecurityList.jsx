import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatTimeAgo } from "../utils/time.js";

function SecurityRow({ item }) {
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(item.qr_url, { width: 68, margin: 1 })
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
    <li className="security-row">
      <div className="security-content">
        <div className="security-title">{item.title}</div>
        <div className="security-meta">
          <span>{item.source_name}</span>
          <span>{formatTimeAgo(item.published_at)}</span>
          <span className="badge">{item.language.toUpperCase()}</span>
        </div>
      </div>
      {qrData ? <img className="qr tiny" src={qrData} alt="QR" /> : null}
    </li>
  );
}

export function SecurityList({ items, limit = 6 }) {
  if (!items.length) {
    return <div className="security-empty">No security stories available.</div>;
  }

  return (
    <ul className="security-list">
      {items.slice(0, limit).map((item) => <SecurityRow key={item.id} item={item} />)}
    </ul>
  );
}
