import { useEffect, useMemo, useState } from "react";
import { HeaderBar } from "./components/HeaderBar.jsx";
import { NewsCard } from "./components/NewsCard.jsx";
import { Ticker } from "./components/Ticker.jsx";
import { useNewsPolling } from "./hooks/useNewsPolling.js";
import { withBase } from "./utils/paths.js";
import { formatTimeAgo, oslotime } from "./utils/time.js";

const CATEGORY_ORDER = ["security", "norway", "ai", "cloud"];
const BACKOFF_SEQUENCE = [10000, 30000, 60000, 120000];

function pickTopFour(items) {
  const usedIds = new Set();
  const usedCategories = new Set();
  const result = [];

  for (const cat of CATEGORY_ORDER) {
    const item = items.find((i) => i.category === cat && !usedIds.has(i.id));
    if (item) {
      result.push(item);
      usedIds.add(item.id);
      usedCategories.add(item.category);
    }
  }

  for (const item of items) {
    if (result.length >= 4) break;
    if (!usedIds.has(item.id) && !usedCategories.has(item.category)) {
      result.push(item);
      usedIds.add(item.id);
      usedCategories.add(item.category);
    }
  }

  for (const item of items) {
    if (result.length >= 4) break;
    if (!usedIds.has(item.id)) {
      result.push(item);
      usedIds.add(item.id);
    }
  }

  return result;
}

function isWithinLastDays(date, days) {
  const delta = Date.now() - Date.parse(date);
  return Number.isFinite(delta) && delta >= 0 && delta <= days * 24 * 60 * 60 * 1000;
}

function importanceScore(item) {
  const categoryPriority = {
    security: 5,
    microsoft: 3,
    cloud: 2,
    ai: 1,
    norway: 1
  };

  return categoryPriority[item.category] ?? 0;
}

export default function App() {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [clock, setClock] = useState(new Date());

  const topFeed = useNewsPolling({
    url: withBase("data/news.json"),
    intervalMs: 600000,
    backoffSequence: BACKOFF_SEQUENCE
  });

  const topStories = useMemo(() => {
    const items = topFeed.data?.items ?? [];
    return pickTopFour(items);
  }, [topFeed.data]);

  const tenDayTickerItems = useMemo(() => {
    const recent = (topFeed.data?.items ?? []).filter((item) => isWithinLastDays(item.published_at, 10));

    return recent
      .sort((a, b) => {
        const scoreDiff = importanceScore(b) - importanceScore(a);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return Date.parse(b.published_at) - Date.parse(a.published_at);
      })
      .slice(0, 10);
  }, [topFeed.data]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!topStories.length) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setHighlightIndex((current) => (current + 1) % topStories.length);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [topStories.length]);

  useEffect(() => {
    const startedAt = Date.now();
    let lastReloadDay = "";

    const timer = window.setInterval(() => {
      const now = new Date();
      const oslo = oslotime(now);
      const hasRun24h = Date.now() - startedAt >= 24 * 60 * 60 * 1000;
      const inTargetMinute = oslo.hour === 3 && oslo.minute === 30;
      const dayKey = `${oslo.year}-${oslo.month}-${oslo.day}`;

      if (hasRun24h && inTargetMinute && lastReloadDay !== dayKey) {
        lastReloadDay = dayKey;
        window.location.reload();
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <HeaderBar now={clock} />

      <main className="main-grid">
        <section className="top-stories">
          <h2>Live Feed</h2>
          <div className="top-story-grid">
            {topStories.map((item, index) => (
              <NewsCard
                key={item.id}
                item={item}
                highlighted={index === highlightIndex}
                timeAgo={formatTimeAgo(item.published_at)}
              />
            ))}
          </div>
        </section>
      </main>

      <Ticker items={tenDayTickerItems} />
    </div>
  );
}
