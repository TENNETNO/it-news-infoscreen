import { useCallback, useEffect, useRef, useState } from "react";

export function useNewsPolling({ url, intervalMs, backoffSequence }) {
  const [data, setData] = useState(null);
  const [online, setOnline] = useState(true);

  const retriesRef = useRef(0);
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback((ms, fn) => {
    clear();
    timerRef.current = window.setTimeout(fn, ms);
  }, [clear]);

  const fetchLoop = useCallback(async () => {
    try {
      const requestUrl = new URL(url, window.location.href);
      requestUrl.searchParams.set("t", String(Date.now()));

      const response = await fetch(requestUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      setData(payload);
      setOnline(true);
      retriesRef.current = 0;
      schedule(intervalMs, fetchLoop);
    } catch {
      setOnline(false);
      const delay = backoffSequence[Math.min(retriesRef.current, backoffSequence.length - 1)];
      retriesRef.current += 1;
      schedule(delay, fetchLoop);
    }
  }, [backoffSequence, intervalMs, schedule, url]);

  useEffect(() => {
    fetchLoop();
    return () => clear();
  }, [clear, fetchLoop]);

  return { data, online };
}
