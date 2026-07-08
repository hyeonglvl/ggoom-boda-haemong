"use client";

import { useEffect, useRef } from "react";

export default function StarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let logicalW = 0;
    let logicalH = 0;
    let stars: {
      x: number;
      y: number;
      deltax: number;
      deltay: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      target: number;
      base: number;
      twinkleSpeed: number;
      twinkleDir: number;
      depth: number;
      floatPhase: number;
    }[] = [];
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      logicalW = window.innerWidth;
      logicalH = window.innerHeight;
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const initStars = () => {
      stars = [];
      const count = Math.floor((logicalW * logicalH) / 2800);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * logicalW,
          y: Math.random() * logicalH,
          deltax: 0,
          deltay: 0,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.08,
          size: Math.random() * 0.4 + 0.2,
          base: Math.random() * 0.5 + 0.2,
          alpha: Math.random() * 0.4 + 0.15,
          target: Math.random() * 0.6 + 0.25,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          depth: Math.random() * 0.6 + 0.2,
          floatPhase: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = () => {
      time += 0.002;
      ctx.clearRect(0, 0, logicalW, logicalH);
      stars.forEach((s) => {
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.target) {
          s.alpha = s.target;
          s.twinkleDir = -1;
        }
        if (s.alpha <= s.base * 0.3) {
          s.alpha = s.base * 0.3;
          s.twinkleDir = 1;
          s.target = Math.random() * 0.6 + 0.25;
        }

        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -20) s.x = logicalW + 10;
        if (s.x > logicalW + 20) s.x = -10;
        if (s.y < -20) s.y = logicalH + 10;
        if (s.y > logicalH + 20) s.y = -10;

        const dx = mouse.x - (s.x + s.deltax);
        const dy = mouse.y - (s.y + s.deltay);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 130;

        if (dist < maxDist && dist > 0) {
          const proximity = 1 - dist / maxDist;
          const force = proximity * s.depth;
          s.deltax += (-(dx / dist) * force * 100 * s.size - s.deltax) * 0.2;
          s.deltay += (-(dy / dist) * force * 100 * s.size - s.deltay) * 0.2;
          s.alpha += (0.95 - s.alpha) * proximity * 0.15;
        } else {
          s.deltax += (0 - s.deltax) * 0.06;
          s.deltay += (0 - s.deltay) * 0.06;
        }

        const floatY = Math.sin(time + s.floatPhase) * 2;
        const px = s.x + s.deltax;
        const py = s.y + s.deltay + floatY;

        const r = s.size * 3.5;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, `rgba(232,213,163,${s.alpha})`);
        grad.addColorStop(1, `rgba(232,213,163,${s.alpha})`);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: "block",
      }}
      suppressHydrationWarning
    />
  );
}
