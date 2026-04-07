import { useEffect, useMemo, useState } from "react";
import { HeaderBar } from "./components/HeaderBar.jsx";
import { NewsCard } from "./components/NewsCard.jsx";
import { Ticker } from "./components/Ticker.jsx";
import { useNewsPolling } from "./hooks/useNewsPolling.js";
import { buildDisplayTitle } from "./utils/copy.js";
import { withBase } from "./utils/paths.js";
import { formatTimeAgo, oslotime } from "./utils/time.js";

const CATEGORY_ORDER = ["security", "norway", "ai", "cloud"];
const BACKOFF_SEQUENCE = [10000, 30000, 60000, 120000];
const SLIDE_INTERVAL_MS = 15 * 60 * 1000;
const FEATURED_STORY_LIMIT = 4;

function pickFeaturedStories(items, limit = FEATURED_STORY_LIMIT) {
  const usedIds = new Set();
  const results = [];

  for (const category of CATEGORY_ORDER) {
    const item = items.find((candidate) => candidate.category === category && !usedIds.has(candidate.id));
    if (item) {
      results.push(item);
      usedIds.add(item.id);
    }
  }

  for (const item of items) {
    if (results.length >= limit) {
      break;
    }

    if (!usedIds.has(item.id)) {
      results.push(item);
      usedIds.add(item.id);
    }
  }

  return results;
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

  const featuredStories = useMemo(() => {
    const items = topFeed.data?.items ?? [];
    return pickFeaturedStories(items);
  }, [topFeed.data]);

  const currentStory = featuredStories[highlightIndex] ?? null;

  const tickerItems = useMemo(() => {
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
    if (!featuredStories.length) {
      return undefined;
    }

    setHighlightIndex((current) => Math.min(current, featuredStories.length - 1));

    const timer = window.setInterval(() => {
      setHighlightIndex((current) => (current + 1) % featuredStories.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [featuredStories.length]);

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
    <div className="app-shell slider-shell">
      <HeaderBar now={clock} />

      <main className="slider-main">
        <section className="feature-stage">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Featured Story</span>
              <h2>News Briefing</h2>
            </div>
          </div>

          {currentStory ? (
            <div className="feature-layout">
              <NewsCard
                item={currentStory}
                highlighted
                timeAgo={formatTimeAgo(currentStory.published_at)}
                mode="feature"
              />

              <aside className="story-rail" aria-label="Story queue">
                <div className="rail-title">Queue</div>
                <div className="story-progress">
                  Story {highlightIndex + 1} of {featuredStories.length}
                </div>
                <div className="rail-list">
                  {featuredStories.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`rail-item ${index === highlightIndex ? "active" : ""}`}
                      onClick={() => setHighlightIndex(index)}
                    >
                      <span className="rail-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="rail-copy">
                        <span className="rail-headline">{buildDisplayTitle(item)}</span>
                        <span className="rail-meta">{item.source_name} / {formatTimeAgo(item.published_at)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          ) : (
            <section className="top-stories">
              <h2>Loading</h2>
            </section>
          )}
        </section>
      </main>

      <Ticker items={tickerItems} />
    </div>
  );
}





