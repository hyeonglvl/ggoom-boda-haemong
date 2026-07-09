"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./IntroScreen.module.css";

interface Props {
  onSubmit: (dreamText: string) => void;
  /** External ref to the moon element so MoonLayer can measure its position. */
  moonRef?: React.RefObject<HTMLDivElement | null>;
  /** True while MoonLayer is flying back from the result screen to this moon's
   *  spot. The intro's own moon stays hidden + entrance-less until handoff. */
  moonReturning?: boolean;
}

export default function IntroScreen({ onSubmit, moonRef: moonRefProp, moonReturning = false }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const moonParallaxRef = useRef<HTMLDivElement>(null);
  const internalMoonRef = useRef<HTMLDivElement>(null);
  const moonRef = moonRefProp ?? internalMoonRef;
  // Captured at mount: if this intro instance appeared because of a reset return,
  // the moon must skip its fadeUp entrance and sit at the settled position so the
  // incoming MoonLayer moon lands exactly on it (no translateY drift).
  const skipMoonEntrance = useRef(moonReturning);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);
  const inputModeRef = useRef(false);
  const [inputMode, setInputMode] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
//   const [db, setdb] = useState(0);

  useEffect(() => { inputModeRef.current = inputMode; }, [inputMode]);

  useEffect(() => {
    const vv = window.visualViewport;
    const el = contentRef.current;
    if (!vv || !el) return;

    if (!inputMode) {
      el.style.transform = "";
      return;
    }

    const update = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
    //   setdb(keyboardHeight);
      el.style.transform = keyboardHeight > 80 ? `translateY(-${keyboardHeight / 2}px)` : "";
    };
    const ta = textareaRef.current;
    // Poll at multiple points during keyboard animation (visualViewport.resize
    // sometimes skips on re-focus of the same textarea on iOS)
    const onFocus = () => [50, 150, 300, 500].forEach(d => setTimeout(update, d));

    vv.addEventListener("resize", update);
    ta?.addEventListener("focus", onFocus);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      ta?.removeEventListener("focus", onFocus);
      if (contentRef.current) contentRef.current.style.transform = "";
    };
  }, [inputMode]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isSubmittingRef.current || inputModeRef.current || !moonParallaxRef.current) return;
      const mx = (e.clientX / window.innerWidth - 0.5) * -20;
      const my = (e.clientY / window.innerHeight - 0.5) * -20;
      moonParallaxRef.current.style.transform = `translate(${mx}px, ${my}px)`;
    };
    const onMouseLeave = () => {
      if (isSubmittingRef.current || inputModeRef.current || !moonParallaxRef.current) return;
      moonParallaxRef.current.style.transform = "translate(0px, 0px)";
    };
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        setExiting(true);
        e.preventDefault();

        textareaRef.current?.focus();
        setTimeout(() => {
          setInputMode(true);
          setExiting(false);
          const el = textareaRef.current;
          if (el && e.key.length === 1) {
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            el.setRangeText(e.key, start, end, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, 350);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (inputMode) {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }
  }, [inputMode]);

  const doSubmit = (dream: string) => {
    if (!dream.trim() || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    // MoonLayer handles the fly-in from the intro moon position to center.
    onSubmit(dream);
  };

  const handleWrapClick = () => {
    if (inputMode || exiting || submitting) return;
    setExiting(true);
    textareaRef.current?.focus();
    setTimeout(() => {
      setInputMode(true);
      setExiting(false);
    }, 350);
  };

  return (
    <div className={styles.wrap} onClick={handleWrapClick}>
      <div ref={contentRef} className={styles.content}>
        <div className={styles.left}>
          <div
            className={`${styles.moonWrap} ${exiting || inputMode ? styles.moonMoved : ""}`}
          >
            <div ref={moonParallaxRef} className={styles.moonParallax}>
              <div
                className={`${styles.moonBlock} ${
                  skipMoonEntrance.current ? styles.moonSettled : ""
                } ${moonReturning || submitting ? styles.moonHidden : ""}`}
              >
                <div ref={moonRef} className={styles.moon}>
                  <svg className={styles.moonSvg} viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <mask id="intro-crescent">
                        <circle cx="26" cy="26" r="26" fill="white" />
                        <circle cx="30" cy="16" r="21" fill="black" />
                      </mask>
                    </defs>
                    <circle cx="26" cy="26" r="26" fill="#e8d5a3" mask="url(#intro-crescent)" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.textGroup}>
            <div
              className={`${styles.staticContent} ${exiting || inputMode ? styles.staticGone : ""} ${skipMoonEntrance.current ? styles.contentSettled : ""}`}
            >
              <h1 className={styles.title}>꿈해몽</h1>
              <div className={styles.divider} />
              <p className={styles.subtitle}>
                {/* 수천 년의 해몽 전통과 현대 심리학이<br />
                당신의 꿈이 전하는 말을 읽어드립니다. */}
                화면을 클릭하세요
              </p>
            </div>
            <div
              className={`${styles.dreamInputWrap} ${inputMode ? styles.dreamInputVisible : ""}`}
              style={
                submitting
                  ? {
                      opacity: 0,
                      pointerEvents: "none",
                      transition: "opacity 0.25s ease",
                    }
                  : {}
              }
            >
              <p className={styles.privacyNote}>입력하신 꿈 내용은 저장되지 않습니다.</p>
              <textarea
                ref={textareaRef}
                className={styles.dreamInput}
                suppressHydrationWarning
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    doSubmit(inputValue.trim());
                  }
                }}
                placeholder="꿈의 내용을 입력해주세요..."
                rows={8}
              />
              <button
                type="button"
                className={styles.submitArrow}
                onClick={(e) => {
                  e.stopPropagation();
                  doSubmit(inputValue.trim());
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="#e8d5a3"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {/* <div>{db}</div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
