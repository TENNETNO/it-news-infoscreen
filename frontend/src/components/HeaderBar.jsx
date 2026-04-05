import { formatDate, formatTime } from "../utils/time.js";
import { withBase } from "../utils/paths.js";

export function HeaderBar({ now }) {
  return (
    <header className="header-bar">
      <div className="brand-wrap">
        <img className="brand-logo" src={withBase("mowi-logo.png")} alt="Mowi" />
        <div className="brand-text">
          <div className="brand-title">IT News Dashboard</div>
          <div className="brand-subtitle">Office InfoScreen</div>
        </div>
      </div>

      <div className="clock-wrap">
        <div className="time">{formatTime(now)}</div>
        <div className="date">{formatDate(now)}</div>
      </div>
    </header>
  );
}
