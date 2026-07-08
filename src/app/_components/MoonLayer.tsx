"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./MoonLayer.module.css";

type Stage = "intro" | "loading" | "result";

interface Props {
  stage: Stage;
  isLoading: boolean;
  onExitDone: () => void;
  /** Marks the intro moon's resting spot (the 52px .moon element). */
  introSentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Screen position of the intro moon captured just before IntroScreen unmounts,
   *  so the fly-in can start from the exact intro moon location. */
  introMoonStartPos: React.RefObject<{ x: number; y: number } | null>;
  /** True while flying back from the result screen to the intro moon. */
  moonReturning: boolean;
  /** Called once the moon has reached the intro spot (handoff to IntroScreen). */
  onReturnDone: () => void;
}

// Intro moon is 52px; this layer's base moon is 120px.
const INTRO_SCALE = 52 / 120;

export default function MoonLayer({
  stage,
  isLoading,
  onExitDone,
  introSentinelRef,
  introMoonStartPos,
  moonReturning,
  onReturnDone,
}: Props) {
  const [orbiting, setOrbiting] = useState(true);
  const moonWrapRef = useRef<HTMLDivElement>(null);
  const moonCutRef = useRef<SVGCircleElement>(null);
  const onExitDoneRef = useRef(onExitDone);
  onExitDoneRef.current = onExitDone;
  const onReturnDoneRef = useRef(onReturnDone);
  onReturnDoneRef.current = onReturnDone;
  // Guards against re-running the fly-in if setOrbiting(true) triggers a re-render
  // while the animation is already in progress.
  const flyInStarted = useRef(false);

  // Fly the moon from the intro moon's captured position to screen center.
  // useLayoutEffect fires synchronously before paint, so the moon is positioned
  // before the first frame — no flash at (0,0). flyInStarted prevents a second
  // run if setOrbiting(true) causes an intermediate re-render.
  useLayoutEffect(() => {
    if (stage !== "loading") {
      flyInStarted.current = false;
      return;
    }
    setOrbiting(true);
    if (flyInStarted.current) return;
    flyInStarted.current = true;

    const el = moonWrapRef.current;
    if (!el) return;

    const startPos = introMoonStartPos.current;
    el.style.transition = "none";
    el.style.transform = startPos
      ? `translate(${startPos.x}px, ${startPos.y}px) scale(${INTRO_SCALE})`
      : `translate(${window.innerWidth / 2 - 60}px, ${window.innerHeight / 2 - 60}px) scale(1)`;
    el.style.opacity = "1";

    requestAnimationFrame(() => {
      const w = moonWrapRef.current;
      if (!w) return;
      w.style.transition = "transform 0.65s ease-in-out";
      w.style.transform = `translate(${window.innerWidth / 2 - 60}px, ${
        window.innerHeight / 2 - 60
      }px) scale(1)`;
    });
  // introMoonStartPos is a stable ref object — its .current changes but the ref
  // itself never changes, so it doesn't belong in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Handle loading completion: complete orbit → 500ms pause → call onExitDone.
  // Guard on stage so this never fires at mount (intro, isLoading already false).
  useEffect(() => {
    if (stage !== "loading") return;
    if (isLoading) return;

    const period = 3000;
    let remainingMs = 0;
    const cutEl = moonCutRef.current;
    if (cutEl) {
      const anims = cutEl.getAnimations();
      if (anims.length > 0 && anims[0].currentTime !== null) {
        const elapsed = (anims[0].currentTime as number) % period;
        remainingMs = elapsed > 0 ? Math.round(period - elapsed) : 0;
      }
    }

    const t0 = setTimeout(() => setOrbiting(false), remainingMs);
    const t1 = setTimeout(() => onExitDoneRef.current(), remainingMs + 500);

    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [isLoading, stage]);

  // Fade the moon out when result screen appears — it stays centered from loading.
  useEffect(() => {
    if (stage !== "result") return;
    const wrap = moonWrapRef.current;
    if (!wrap) return;
    requestAnimationFrame(() => {
      const w = moonWrapRef.current;
      if (!w) return;
      w.style.transition = "opacity 0.4s ease-out";
      w.style.opacity = "0";
    });
  }, [stage]);

  // Reset return: fly the moon from its result spot back to the intro moon,
  // then hand off to IntroScreen's own moon. Runs while stage is "intro" but the
  // moon is still mounted because moonReturning keeps it rendered.
  useEffect(() => {
    if (stage !== "intro" || !moonReturning) return;

    const wrap = moonWrapRef.current;
    const target = introSentinelRef.current;
    if (!wrap || !target) {
      onReturnDoneRef.current();
      return;
    }

    // Snap moon back to loading center (faded out), restore it, then fly to intro moon
    wrap.style.transition = "none";
    wrap.style.opacity = "1";
    wrap.style.transform = `translate(${window.innerWidth / 2 - 60}px, ${window.innerHeight / 2 - 60}px) scale(1)`;

    requestAnimationFrame(() => {
      const w = moonWrapRef.current;
      if (!w) return;
      const rect = target.getBoundingClientRect();
      w.style.transition = "transform 0.6s ease-in-out";
      w.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(${INTRO_SCALE})`;
    });

    const t = setTimeout(() => onReturnDoneRef.current(), 650);
    return () => clearTimeout(t);
  }, [stage, moonReturning, introSentinelRef]);


  // Hidden in intro, except while the moon is flying back from the result screen.
  if (stage === "intro" && !moonReturning) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div ref={moonWrapRef} className={styles.moonWrap}>
        <svg className={styles.moonSvg} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="ml-crescent">
              <circle cx="60" cy="60" r="60" fill="white" />
              <circle
                ref={moonCutRef}
                className={orbiting ? styles.orbiting : ""}
                cx="69" cy="37" r="48"
                fill="black"
              />
            </mask>
          </defs>
          <circle cx="60" cy="60" r="60" fill="#e8d5a3" mask="url(#ml-crescent)" />
        </svg>
      </div>
    </div>
  );
}
