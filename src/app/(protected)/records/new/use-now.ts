"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1_000;

/**
 * 残り時間の表示用の現在時刻（ミリ秒）。active の間だけ1秒ごとに更新する。
 * サーバーで描いた画面と食い違わないよう、最初の描画では null を返す。
 */
export function useNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  return now;
}
