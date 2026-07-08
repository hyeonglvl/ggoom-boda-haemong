"use client";

import { useRef, useState } from "react";
import IntroScreen from "./_components/IntroScreen";
import LoadingScreen from "./_components/LoadingScreen";
import MoonLayer from "./_components/MoonLayer";
import ResultScreen from "./_components/ResultScreen";
import StarBackground from "./_components/StarBackground";

type Stage = "intro" | "loading" | "result";

type Result = {
  summary: string;
  analysis: string[];
  goodElements?: string;
  badElements?: string;
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  // Passed to ResultScreen so the chat API knows the original dream text for follow-up questions
  const [pendingDream, setPendingDream] = useState("");
  // true while the moon is flying from the result screen back to the intro moon
  const [moonReturning, setMoonReturning] = useState(false);
  const introMoonRef = useRef<HTMLDivElement>(null);
  // Captured just before IntroScreen unmounts so MoonLayer can start its fly-in
  // from the exact intro moon position (including any parallax offset).
  const introMoonStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleSubmit = async (dream: string) => {
    if (!dream.trim() || isLoading) return;

    const moonEl = introMoonRef.current;
    if (moonEl) {
      const rect = moonEl.getBoundingClientRect();
      introMoonStartPos.current = { x: rect.left, y: rect.top };
    }

    // Save dream text so ResultScreen can pass it to /api/dream-chat for follow-up questions
    setPendingDream(dream);
    setIsLoading(true);
    setError("");
    setMoonReturning(false); // cancel any in-flight reset return
    setStage("loading");

    try {
      const res = await fetch("/api/interpret-dream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dream }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했습니다.");
      setResult({
        summary: data.summary,
        analysis: data.analysis,
        goodElements: data.goodElements,
        badElements: data.badElements,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "예기치 않은 오류가 발생했습니다.");
      setStage("intro");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadingExit = () => {
    setStage("result");
  };

  const handleReset = () => {
    // Keep MoonLayer alive and fly its moon back to the intro moon's spot,
    // then MoonLayer hands off to IntroScreen's own moon and unmounts.
    setMoonReturning(true);
    setStage("intro");
    setResult(null);
    setError("");
  };

  return (
    <div suppressHydrationWarning style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg, #0a1628 0%, #122050 40%, #0d1f4a 65%, #091220 100%)" }}>
      <StarBackground />
      <MoonLayer
        stage={stage}
        isLoading={isLoading}
        onExitDone={handleLoadingExit}
        introSentinelRef={introMoonRef}
        introMoonStartPos={introMoonStartPos}
        moonReturning={moonReturning}
        onReturnDone={() => setMoonReturning(false)}
      />
      {stage === "intro" && (
        <IntroScreen
          onSubmit={handleSubmit}
          moonRef={introMoonRef}
          moonReturning={moonReturning}
        />
      )}
      {stage === "loading" && <LoadingScreen isLoading={isLoading} />}
      {stage === "result" && result && (
        <ResultScreen
          dream={pendingDream}
          summary={result.summary}
          analysis={result.analysis}
          goodElements={result.goodElements}
          badElements={result.badElements}
          onReset={handleReset}
        />
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,100,100,0.15)",
            color: "#ff9999",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            zIndex: 99,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
