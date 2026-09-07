'use client';

import React, { useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';

export default function CandlestickChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    // Fixed mock candlestick data simulating an epic rally
    const baseCandles = [
      { open: 30, close: 42, high: 46, low: 28 },
      { open: 42, close: 38, high: 45, low: 36 },
      { open: 38, close: 55, high: 58, low: 35 },
      { open: 55, close: 68, high: 72, low: 52 },
      { open: 68, close: 64, high: 74, low: 62 },
      { open: 64, close: 82, high: 86, low: 60 },
      { open: 82, close: 95, high: 99, low: 80 },
      { open: 95, close: 89, high: 102, low: 86 },
      { open: 89, close: 110, high: 115, low: 87 },
      { open: 110, close: 128, high: 132, low: 106 },
      { open: 128, close: 122, high: 135, low: 118 },
      { open: 122, close: 145, high: 152, low: 120 },
      { open: 145, close: 168, high: 172, low: 140 },
      { open: 168, close: 185, high: 190, low: 165 },
      { open: 185, close: 210, high: 220, low: 180 },
    ];

    const render = () => {
      tick += 0.03;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle cyber grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
      ctx.lineWidth = 1;
      const gridSpacing = 30;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Candlesticks
      const candleWidth = 14;
      const spacing = 22;
      const startX = 30;
      const scaleY = height / 260;

      baseCandles.forEach((c, idx) => {
        const isBullish = c.close >= c.open;
        const color = isBullish ? '#00f0ff' : '#00a3b4';
        const glowColor = isBullish ? 'rgba(0, 240, 255, 0.6)' : 'rgba(0, 163, 180, 0.3)';

        // Gentle pulse on the last candle
        let displayClose = c.close;
        if (idx === baseCandles.length - 1) {
          displayClose += Math.sin(tick * 3) * 6;
        }

        const x = startX + idx * spacing;
        const yOpen = height - (c.open * scaleY);
        const yClose = height - (displayClose * scaleY);
        const yHigh = height - (c.high * scaleY);
        const yLow = height - (c.low * scaleY);

        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, yHigh);
        ctx.lineTo(x + candleWidth / 2, yLow);
        ctx.stroke();

        // Body
        const top = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yClose - yOpen), 3);

        ctx.fillStyle = isBullish ? '#00f0ff' : '#0b2030';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, top, candleWidth, bodyHeight);
        ctx.strokeRect(x, top, candleWidth, bodyHeight);

        ctx.restore();
      });

      // Trending upward beam line
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, height - 30);
      ctx.lineTo(width - 20, 20);
      ctx.stroke();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#070e17]/80 backdrop-blur-md p-4">
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-xs font-bold text-cyan-300 tracking-wider uppercase">
            ARC / STONKS INDEX
          </span>
        </div>
        <div className="flex items-center space-x-2 font-mono text-xs text-emerald-400 font-semibold">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+4,444% ALL-TIME MOMENTUM</span>
        </div>
      </div>

      <div className="w-full flex justify-center items-center py-2 overflow-x-auto">
        <canvas
          ref={canvasRef}
          width={400}
          height={180}
          className="max-w-full block"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cyan-500/10 text-center font-mono text-[11px]">
        <div>
          <span className="text-slate-500 block">COLLECTION</span>
          <span className="text-cyan-300 font-bold">4,444 NFTs</span>
        </div>
        <div>
          <span className="text-slate-500 block">ECOSYSTEM</span>
          <span className="text-teal-300 font-bold">ARC NETWORK</span>
        </div>
        <div>
          <span className="text-slate-500 block">STONK STATUS</span>
          <span className="text-emerald-400 font-bold">ALWAYS UP</span>
        </div>
      </div>
    </div>
  );
}
