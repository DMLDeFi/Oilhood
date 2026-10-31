"use client";

import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useCandles } from "@/hooks/useData";

const FRAMES = ["5m", "15m", "1h", "4h", "1d"] as const;

/** Candlestick chart of $OILHOOD price snapshots with traded volume, powered by TradingView Lightweight Charts. */
export function PriceChart() {
  const [tf, setTf] = useState<(typeof FRAMES)[number]>("15m");
  const { data } = useCandles(tf, true);
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8d8a99", fontFamily: "var(--font-jetbrains), monospace", attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      rightPriceScale: { borderColor: "#24242e" },
      timeScale: { borderColor: "#24242e", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#f5b83d55" }, horzLine: { color: "#f5b83d55" } },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: "#3ddc97", downColor: "#ff5c6c", borderVisible: false, wickUpColor: "#3ddc97", wickDownColor: "#ff5c6c",
    });
    volume.current = c.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", color: "#f5b83d40", lastValueVisible: false, priceLineVisible: false });
    volume.current.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    const list = data?.candles ?? [];
    if (!candles.current || !volume.current) return;
    const last = list.at(-1)?.close ?? 1;
    // Memecoin prices can be tiny; keep ~4 significant digits on the axis.
    const precision = Math.min(12, Math.max(2, Math.ceil(-Math.log10(last)) + 3));
    candles.current.applyOptions({ priceFormat: { type: "price", precision, minMove: 10 ** -precision } });
    candles.current.setData(list.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    volume.current.setData(list.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "#3ddc9740" : "#ff5c6c40" })));
    chart.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="label">$OILHOOD / USD</p>
        <div className="flex gap-1 font-mono text-xs">
          {FRAMES.map((f) => (
            <button key={f} onClick={() => setTf(f)} className={`rounded-md px-2 py-1 ${tf === f ? "bg-gold/15 text-gold" : "text-smoke hover:text-sand"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div ref={box} className="relative min-h-[300px] flex-1">
        {data && data.candles.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-smoke">Chart fills in as trades come in.</p>
        )}
      </div>
    </div>
  );
}
