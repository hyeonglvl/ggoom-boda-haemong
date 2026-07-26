"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ResultScreen.module.css";

type Bubble = { role: "ai" | "user"; text: string };

interface Props {
  dream: string;
  summary: string;
  analysis: string[];
  goodElements?: string;
  badElements?: string;
  onReset: () => void;
}

export default function ResultScreen({
  dream,
  summary,
  analysis,
  goodElements,
  badElements,
  onReset,
}: Props) {
  const buildInitialBubbles = (): Bubble[] => {
    const b: Bubble[] = [];
    if (dream.trim()) b.push({ role: "user", text: dream });
    b.push({ role: "ai", text: summary });
    if (analysis.length > 1) b.push({ role: "ai", text: analysis.slice(0, -1).join("\n\n") });
    if (analysis.length > 0) b.push({ role: "ai", text: analysis[analysis.length - 1] });
    const elements: string[] = [];
    if (goodElements) elements.push(`✦ 좋은요소\n${goodElements}`);
    if (badElements) elements.push(`✦ 나쁜요소\n${badElements}`);
    if (elements.length > 0) b.push({ role: "ai", text: elements.join("\n\n") });
    return b;
  };

  const initialBubbles = useRef<Bubble[]>(buildInitialBubbles());
  const [revealedCount, setRevealedCount] = useState(0);
  const [chatBubbles, setChatBubbles] = useState<Bubble[]>([]);
  const [inputActive, setInputActive] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followUpFetched = useRef(false);

  const parseBold = (text: string): React.ReactNode[] =>
    text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );

  // Reveal initial bubbles one by one
  useEffect(() => {
    if (revealedCount >= initialBubbles.current.length) return;
    const delay = revealedCount === 0 ? 300 : 500;
    const t = setTimeout(() => setRevealedCount(v => v + 1), delay);
    return () => clearTimeout(t);
  }, [revealedCount]);

  // Auto-scroll on follow-up conversation activity only — not while the
  // initial result bubbles are being revealed, so the user can read from
  // the top without being pulled down.
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chatBubbles, isAiTyping]);

  // Fetch follow-up question once all initial bubbles are revealed.
  // Skipped when the interpretation was a refusal (not an actual dream) —
  // goodElements/badElements are only ever empty in that case — since there's
  // no real dream content for the model to ask a deepening question about.
  const isRefusal = !goodElements && !badElements;

  useEffect(() => {
    if (revealedCount < initialBubbles.current.length) return;
    if (followUpFetched.current) return;
    followUpFetched.current = true;

    const fetchFollowUp = async () => {
      if (isRefusal) {
        setInputActive(true);
        return;
      }
      setIsAiTyping(true);
      try {
        const res = await fetch("/api/dream-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dream,
            interpretation: { summary, analysis, goodElements, badElements },
            messages: [],
          }),
        });
        const data = await res.json();
        if (data.reply) {
          setChatBubbles([{ role: "ai", text: data.reply }]);
          setConversationHistory([{ role: "assistant", content: data.reply }]);
        }
      } catch {
        // Skip follow-up on error, still activate input
      } finally {
        setIsAiTyping(false);
        setInputActive(true);
      }
    };

    fetchFollowUp();
  }, [revealedCount, dream, summary, analysis, goodElements, badElements, isRefusal]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAiTyping) return;

    setInputText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userBubble: Bubble = { role: "user", text };
    const newHistory = [...conversationHistory, { role: "user", content: text }];
    setChatBubbles(prev => [...prev, userBubble]);
    setConversationHistory(newHistory);

    setIsAiTyping(true);
    try {
      const res = await fetch("/api/dream-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dream,
          interpretation: { summary, analysis, goodElements, badElements },
          messages: newHistory,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "죄송합니다, 오류가 발생했습니다.";
      setChatBubbles(prev => [...prev, { role: "ai", text: reply }]);
      setConversationHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch {
      setChatBubbles(prev => [...prev, { role: "ai", text: "죄송합니다, 오류가 발생했습니다." }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [inputText, isAiTyping, conversationHistory, dream, summary, analysis, goodElements, badElements]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.resetBtn} onClick={onReset}>처음으로</button>
      </div>

      {/* Chat scroll area */}
      <div ref={chatRef} className={styles.chat}>
        <div className={styles.chatInner}>
          {/* Initial bubbles revealed one by one */}
          {initialBubbles.current.slice(0, revealedCount).map((bubble, i) => (
            bubble.role === "ai" ? (
              <div key={`init-${i}`} className={`${styles.aiBubbleWrap} ${styles.fadeIn}`}>
                <span className={styles.aiIcon}>🌙</span>
                <div className={styles.aiBubble}>
                  {parseBold(bubble.text)}
                </div>
              </div>
            ) : (
              <div key={`init-${i}`} className={`${styles.userBubbleWrap} ${styles.fadeIn}`}>
                <div className={styles.userBubble}>{bubble.text}</div>
              </div>
            )
          ))}

          {/* Conversation bubbles */}
          {chatBubbles.map((bubble, i) => (
            bubble.role === "ai" ? (
              <div key={`chat-${i}`} className={`${styles.aiBubbleWrap} ${styles.fadeIn}`}>
                <span className={styles.aiIcon}>🌙</span>
                <div className={styles.aiBubble}>{parseBold(bubble.text)}</div>
              </div>
            ) : (
              <div key={`chat-${i}`} className={`${styles.userBubbleWrap} ${styles.fadeIn}`}>
                <div className={styles.userBubble}>{bubble.text}</div>
              </div>
            )
          ))}

          {/* Typing indicator */}
          {isAiTyping && (
            <div className={`${styles.aiBubbleWrap} ${styles.fadeIn}`}>
              <span className={styles.aiIcon}>🌙</span>
              <div className={`${styles.aiBubble} ${styles.typingBubble}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className={`${styles.inputBar} ${inputActive ? styles.inputBarVisible : ""}`}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="답변하거나 더 궁금한 점을 물어보세요..."
          rows={1}
          disabled={isAiTyping}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!inputText.trim() || isAiTyping}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 15L15 9L3 3V7.5L11 9L3 10.5V15Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
