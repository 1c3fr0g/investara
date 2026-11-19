"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserAppContext } from "@/app/api/ai-chat/route";
import { ChatMessageRenderer } from "./ChatMessageRenderer";

export interface ChatAttachment {
  id: string;
  type: "image" | "video";
  dataUrl: string; // base64 data url
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  assetTag?: string;
  source?: "gemini" | "local";
  model?: string;
  attachments?: ChatAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  activeAsset: { type: "stock" | "crypto"; code: string } | null;
  horizon: "investing" | "swing" | "scalping";
  risk: "konservatif" | "moderat" | "agresif";
}

const STORAGE_KEY = "investara_ai_chat_sessions_v2";
const ACTIVE_SESSION_KEY = "investara_ai_active_session_id_v2";

const createWelcomeMessage = (): ChatMessage => ({
  id: "welcome",
  role: "assistant",
  content:
    "Halo! Saya **Investara AI Analyst**.\n\nSaya mengingat riwayat analisis Anda dan siap membantu membedah **seluruh saham IHSG (fundamental, teknikal, bandarmologi, best buy, dividen)** dan **kripto global Binance**.\n\nApa aset yang ingin kita diskusikan hari ini?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

export function AiChatbot() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [searchHistory, setSearchHistory] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{ type: "image" | "video"; url: string; name: string } | null>(null);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [appContextStats, setAppContextStats] = useState<{
    portfolioCount: number;
    simulationCount: number;
    watchlistCount: number;
  }>({ portfolioCount: 0, simulationCount: 0, watchlistCount: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextCacheRef = useRef<{ at: number; data: UserAppContext } | null>(null);
  const contextPendingRef = useRef<Promise<UserAppContext> | null>(null);

  // Dynamically gather user app context in parallel with 20s cache
  const gatherInvestaraContext = useCallback(() => {
    if (contextCacheRef.current && Date.now() - contextCacheRef.current.at < 20000) {
      return Promise.resolve(contextCacheRef.current.data);
    }

    contextPendingRef.current ??= (async () => {
      let portfolioItems: NonNullable<NonNullable<UserAppContext["portfolio"]>["items"]> = [];
      let watchlistItems: string[] = [];
      let alertsData: NonNullable<UserAppContext["alerts"]> = [];

      try {
        const signal = AbortSignal.timeout(1_500);
        const [portRes, watchRes, alertRes] = await Promise.allSettled([
          fetch("/api/portofolio", { signal }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/watchlist", { signal }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/alerts", { signal }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (portRes.status === "fulfilled" && portRes.value?.items) {
          portfolioItems = portRes.value.items;
        }
        if (watchRes.status === "fulfilled" && watchRes.value?.kodes) {
          watchlistItems = watchRes.value.kodes;
        }
        if (alertRes.status === "fulfilled" && alertRes.value) {
          alertsData = alertRes.value.alerts || (Array.isArray(alertRes.value) ? alertRes.value : []);
        }
      } catch {}

      if (portfolioItems.length === 0) {
        try {
          const old = JSON.parse(localStorage.getItem("ihsg-portofolio-v1") || "[]");
          if (Array.isArray(old)) portfolioItems = old;
        } catch {}
      }

      let paperTradingData: UserAppContext["paperTrading"];
      try {
        const tradesRaw = localStorage.getItem("investara_paper_trades");
        const balRaw = localStorage.getItem("investara_paper_starting_balance");
        if (tradesRaw) {
          const trades: NonNullable<NonNullable<UserAppContext["paperTrading"]>["openTrades"]> = JSON.parse(tradesRaw);
          const openTradesList = trades.filter((trade) => trade.status === "OPEN");
          paperTradingData = {
            startingBalance: Number(balRaw) || 100_000_000,
            openTrades: openTradesList,
            openTradesCount: openTradesList.length,
          };
        }
      } catch {}

      setAppContextStats({
        portfolioCount: portfolioItems.length,
        simulationCount: paperTradingData?.openTradesCount ?? 0,
        watchlistCount: watchlistItems.length,
      });

      const ctx: UserAppContext = {
        portfolio: { items: portfolioItems },
        paperTrading: paperTradingData,
        watchlist: watchlistItems,
        alerts: alertsData,
      };

      contextCacheRef.current = { at: Date.now(), data: ctx };
      return ctx;
    })().finally(() => {
      contextPendingRef.current = null;
    });
    return contextPendingRef.current;
  }, []);

  // Sync app context when opened
  useEffect(() => {
    if (open) {
      gatherInvestaraContext();
    }
  }, [open, gatherInvestaraContext]);

  // Process single or multiple image/video files (from file input, paste, or drag-and-drop)
  const processImageOrVideoFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return false;

    // Max size: 5MB for image, 15MB for video
    const limit = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > limit) {
      alert(`Ukuran file "${file.name}" melebihi batas (${isVideo ? "15MB" : "5MB"}).`);
      return false;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const formattedName =
        file.name && !file.name.startsWith("image.")
          ? file.name
          : `Screenshot_${new Date().toLocaleTimeString().replace(/:/g, "-")}.png`;

      setPendingAttachments((prev) => [
        ...prev,
        {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: isVideo ? "video" : "image",
          dataUrl,
          name: formattedName,
          mimeType: file.type || "image/png",
          size: file.size,
        },
      ]);

      setPasteToast("✓ Gambar dari clipboard berhasil ditempel!");
      setTimeout(() => setPasteToast(null), 2500);
    };
    reader.readAsDataURL(file);
    return true;
  };

  // Handle media file upload from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach(processImageOrVideoFile);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle Clipboard Paste (Ctrl+C image anywhere -> Ctrl+V paste into chatbot)
  const handlePaste = (e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    let imageFound = false;

    // 1. Check clipboard items (standard for copied screenshot / snipping tool images)
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            processImageOrVideoFile(blob);
            imageFound = true;
          }
        }
      }
    }

    // 2. Fallback to clipboard files
    if (!imageFound && clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          e.preventDefault();
          processImageOrVideoFile(file);
          imageFound = true;
        }
      }
    }
  };

  // Global paste event listener when chatbot is open
  useEffect(() => {
    if (!open || view !== "chat") return;

    const onGlobalPaste = (e: ClipboardEvent) => {
      // If user pasted image data, intercept and attach to chatbot
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            handlePaste(e);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", onGlobalPaste);
    return () => window.removeEventListener("paste", onGlobalPaste);
  }, [open, view]);

  // Load persistent sessions from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const matched = parsed.find((s) => s.id === savedActiveId);
          setActiveSessionId(matched ? matched.id : parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error("Gagal memuat riwayat obrolan AI:", e);
    }

    // Default first session if none exists
    const initialSession: ChatSession = {
      id: `sess_${Date.now()}`,
      title: "Percakapan Baru",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [createWelcomeMessage()],
      activeAsset: null,
      horizon: "investing",
      risk: "moderat",
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, []);

  // Helper to persist sessions
  const persistSessions = (newSessions: ChatSession[], newActiveId: string) => {
    setSessions(newSessions);
    setActiveSessionId(newActiveId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
      localStorage.setItem(ACTIVE_SESSION_KEY, newActiveId);
    } catch (e) {
      console.error("Gagal menyimpan ke localStorage:", e);
    }
  };

  // Get active session
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ||
    sessions[0] || {
      id: "fallback",
      title: "Percakapan Baru",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [createWelcomeMessage()],
      activeAsset: null,
      horizon: "investing" as const,
      risk: "moderat" as const,
    };

  const messages = activeSession.messages;
  const activeAsset = activeSession.activeAsset;
  const horizon = activeSession.horizon;
  const risk = activeSession.risk;

  // Auto-scroll to bottom of chat when new message arrives or chat opened
  useEffect(() => {
    if (open && view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, view]);

  // Focus input when opened
  useEffect(() => {
    if (open && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, view]);

  // Handle global open-ai-chat events from buttons across the app (BestBuyCard, StockDetail, etc.)
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{
        asset?: string;
        type?: "stock" | "crypto";
        initialPrompt?: string;
      }>;
      const asset = customEvent.detail?.asset;
      const type = customEvent.detail?.type || "stock";
      const initialPrompt = customEvent.detail?.initialPrompt;

      setOpen(true);
      setView("chat");

      if (asset) {
        const assetCode = asset.toUpperCase();
        // Check if current active session is already about this asset
        if (activeSession.activeAsset?.code === assetCode) {
          if (initialPrompt) {
            sendMessage(initialPrompt, { type, code: assetCode });
          }
        } else {
          // Check if an existing session is about this asset
          const existing = sessions.find((s) => s.activeAsset?.code === assetCode);
          if (existing) {
            setActiveSessionId(existing.id);
            if (initialPrompt) {
              setTimeout(() => sendMessage(initialPrompt, { type, code: assetCode }), 100);
            }
          } else {
            // Start a new dedicated thread for this asset
            startNewChat({ type, code: assetCode }, initialPrompt);
          }
        }
      }
    };

    window.addEventListener("open-ai-chat", handleOpenChat);
    return () => window.removeEventListener("open-ai-chat", handleOpenChat);
  }, [activeSession, sessions]);

  // Start a new conversation thread
  const startNewChat = (
    initialAsset?: { type: "stock" | "crypto"; code: string },
    autoPrompt?: string
  ) => {
    const newSession: ChatSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: initialAsset ? `Analisis ${initialAsset.code}` : "Percakapan Baru",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [createWelcomeMessage()],
      activeAsset: initialAsset || null,
      horizon: "investing",
      risk: "moderat",
    };

    const updated = [newSession, ...sessions];
    persistSessions(updated, newSession.id);
    setView("chat");

    if (autoPrompt && initialAsset) {
      setTimeout(() => sendMessage(autoPrompt, initialAsset, newSession.id), 100);
    }
  };

  // Switch to another session from history
  const switchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    } catch {}
    setView("chat");
  };

  // Delete a specific session
  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== sessionId);

    if (filtered.length === 0) {
      const fresh: ChatSession = {
        id: `sess_${Date.now()}`,
        title: "Percakapan Baru",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [createWelcomeMessage()],
        activeAsset: null,
        horizon: "investing",
        risk: "moderat",
      };
      persistSessions([fresh], fresh.id);
    } else {
      const nextActiveId = activeSessionId === sessionId ? filtered[0].id : activeSessionId;
      persistSessions(filtered, nextActiveId);
    }
  };

  // Clear all history
  const clearAllHistory = () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh riwayat percakapan?")) {
      const fresh: ChatSession = {
        id: `sess_${Date.now()}`,
        title: "Percakapan Baru",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [createWelcomeMessage()],
        activeAsset: null,
        horizon: "investing",
        risk: "moderat",
      };
      persistSessions([fresh], fresh.id);
      setView("chat");
    }
  };

  // Update session horizon & risk
  const updateActiveProfile = (newHorizon?: "investing" | "swing" | "scalping", newRisk?: "konservatif" | "moderat" | "agresif") => {
    const updated = sessions.map((s) =>
      s.id === activeSession.id
        ? {
            ...s,
            horizon: newHorizon ?? s.horizon,
            risk: newRisk ?? s.risk,
            updatedAt: Date.now(),
          }
        : s
    );
    persistSessions(updated, activeSession.id);
  };

  // Remove active asset focus
  const clearActiveAsset = () => {
    const updated = sessions.map((s) =>
      s.id === activeSession.id
        ? {
            ...s,
            activeAsset: null,
            updatedAt: Date.now(),
          }
        : s
    );
    persistSessions(updated, activeSession.id);
  };

  // Send message
  const sendMessage = async (
    textToSend?: string,
    contextOverride?: { type: "stock" | "crypto"; code: string },
    targetSessionId?: string
  ) => {
    let query = (textToSend || input).trim();
    const attachmentsToSend = [...pendingAttachments];
    if (!query && attachmentsToSend.length === 0) return;
    if (attachmentsToSend.length > 3 || attachmentsToSend.reduce((sum, attachment) => sum + attachment.size, 0) > 15 * 1024 * 1024) {
      alert("Gunakan hingga tiga lampiran dengan ukuran total maksimal 15 MB.");
      return;
    }
    if (loading) return;

    if (!query && attachmentsToSend.length > 0) {
      query = "Tolong berikan analisis teknikal dan evaluasi grafik/tangkapan layar yang saya lampirkan ini.";
    }

    const currentSessId = targetSessionId || activeSession.id;
    const currentSess = sessions.find((s) => s.id === currentSessId) || activeSession;
    const ctx = contextOverride || currentSess.activeAsset;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      assetTag: ctx?.code,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
    };

    // Auto-generate title if this is the first user query
    let newTitle = currentSess.title;
    if (currentSess.title === "Percakapan Baru" || currentSess.title.startsWith("Analisis")) {
      if (ctx?.code) {
        newTitle = `Analisis ${ctx.code}`;
      } else if (attachmentsToSend.length > 0) {
        newTitle = `Analisis Media: ${attachmentsToSend[0].name.slice(0, 24)}`;
      } else {
        newTitle = query.length > 36 ? query.slice(0, 36) + "..." : query;
      }
    }

    const optimisticMessages = [...currentSess.messages, userMsg];
    const optimisticSessions = sessions.map((s) =>
      s.id === currentSessId
        ? {
            ...s,
            title: newTitle,
            updatedAt: Date.now(),
            messages: optimisticMessages,
            activeAsset: ctx || s.activeAsset,
          }
        : s
    );

    persistSessions(optimisticSessions, currentSessId);
    setInput("");
    setPendingAttachments([]);
    setLoading(true);

    try {
      const userAppContext = await gatherInvestaraContext();

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          messages: optimisticMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 24_000),
          })),
          attachments: attachmentsToSend,
          assetContext: ctx,
          horizon: currentSess.horizon,
          risk: currentSess.risk,
          userAppContext: { ...userAppContext, route: window.location.pathname },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Gagal menghubungi asisten AI");
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: data.content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        assetTag: data.assetDetected?.code,
        source: data.source === "gemini" || data.source === "local" ? data.source : undefined,
        model: typeof data.model === "string" ? data.model : undefined,
      };

      const finalAsset = data.assetDetected || ctx || currentSess.activeAsset;
      const finalSessions = optimisticSessions.map((s) =>
        s.id === currentSessId
          ? {
              ...s,
              title: s.title === "Percakapan Baru" && finalAsset?.code ? `Analisis ${finalAsset.code}` : s.title,
              updatedAt: Date.now(),
              messages: [...s.messages, assistantMsg],
              activeAsset: finalAsset,
            }
          : s
      );

      persistSessions(finalSessions, currentSessId);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `⚠️ Maaf, terjadi kendala saat memproses analisis: ${
          err instanceof Error ? err.message : "Koneksi terputus"
        }. Silakan coba lagi.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalSessions = optimisticSessions.map((s) =>
        s.id === currentSessId
          ? {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, errorMsg],
            }
          : s
      );

      persistSessions(finalSessions, currentSessId);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    { label: "💼 Evaluasi Portofolio Saya", prompt: "Tolong evaluasi portofolio saham saya: hitung modal, nilai live, floating profit/loss, estimasi dividen tahunan, dan periksa apakah ada risiko konsentrasi berlebih." },
    { label: "🧪 Cek Posisi Paper Trading", prompt: "Analisis posisi aktif saya di simulasi paper trading Radar Swing 1-3%: apakah ada yang sudah mendekati target TP1/TP2 atau perlu cut loss?" },
    { label: "⭐ Bedah Saham Watchlist", prompt: "Dari saham-saham di watchlist saya, mana yang saat ini paling menarik untuk masuk berdasarkan valuasi dan dividen?" },
    { label: "🔔 Status Alert Harga", prompt: "Bagaimana status notifikasi alert harga saya hari ini?" },
    { label: "Analisis BBCA", prompt: "Bagaimana analisis fundamental, teknikal, dan best buy BBCA?" },
    { label: "Analisis Bitcoin (BTC)", prompt: "Bagaimana prospek Bitcoin (BTC) dan sentimen pasar kripto hari ini?" },
    { label: "Bandingkan BBRI vs BMRI", prompt: "Bandingkan valuasi dan dividen saham BBRI vs BMRI mana yang lebih menarik?" },
    { label: "Saham MSCI Indonesia", prompt: "Jelaskan saham apa saja yang masuk MSCI Standard Index dan pengaruhnya ke IHSG" },
    { label: "Dividen Hunter", prompt: "Apa saja saham IHSG dengan dividen yield tinggi dan neraca utang paling aman?" },
    { label: "Strategi DCA Crypto", prompt: "Bagaimana cara mengatur strategi DCA kripto di kondisi pasar saat ini?" },
  ];

  // Filter history by search keyword
  const filteredSessions = sessions.filter((s) => {
    if (!searchHistory.trim()) return true;
    const q = searchHistory.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.activeAsset?.code.toLowerCase().includes(q) ||
      s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const formatSessionTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins}m lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j lalu`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Kemarin";
    if (days < 7) return `${days} hari lalu`;
    return new Date(timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <>
      {/* Floating Trigger Button (Satoshi Style) */}
      <div className="fixed right-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)] z-50 flex items-center sm:right-6 sm:bottom-6">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="group relative flex size-11 items-center justify-center gap-2 rounded-full border border-zinc-200/80 bg-[#191919] sm:h-auto sm:w-auto sm:px-4 sm:py-3 text-white shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:bg-black active:scale-95 dark:border-white/20 dark:bg-white dark:text-[#191919] dark:hover:bg-zinc-100"
          aria-label="Buka Chatbot Analisis AI"
          aria-expanded={open}
        >
          {/* Subtle Satoshi Beacon */}
          <span className="relative hidden h-2.5 w-2.5 shrink-0 sm:flex">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9A83FF] opacity-80"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#9A83FF]"></span>
          </span>

          <span aria-hidden="true" className="text-base sm:hidden">{open ? "?" : "?"}</span>
          <span className="hidden text-sm font-bold tracking-tight sm:inline">
            {open ? "Tutup AI" : "🤖 Tanya Analis AI"}
          </span>

          {activeAsset && !open && (
            <span className="hidden rounded-full bg-[#9A83FF]/25 px-2 py-0.5 text-[10px] font-black sm:inline text-[#9A83FF] dark:bg-[#9A83FF]/30 dark:text-[#9A83FF]">
              {activeAsset.code}
            </span>
          )}
        </button>
      </div>

      {/* Slide-over / Modal Chat Window */}
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[55] flex min-w-0 items-end justify-end px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:inset-auto sm:bottom-20 sm:right-6 sm:p-0">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragging(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(processImageOrVideoFile);
              }
            }}
            className="pointer-events-auto relative flex h-[min(calc(100dvh-1.25rem),680px)] min-w-0 w-full max-w-full flex-col overflow-hidden sm:h-[min(calc(100dvh-6rem),680px)] rounded-[1.75rem] ios-glass-pill crystal-frosted sm:w-[500px]"
          >
            {/* Drag & Drop Visual Overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#9A83FF]/20 backdrop-blur-xs border-2 border-dashed border-[#9A83FF] m-2.5 rounded-2xl pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9A83FF] text-white text-2xl shadow-lg animate-bounce">
                  📸
                </div>
                <p className="mt-2 text-sm font-black text-[#191919] dark:text-white">
                  Lepaskan gambar atau video di sini
                </p>
                <p className="text-xs text-zinc-500">Otomatis dilampirkan ke obrolan</p>
              </div>
            )}

            {/* Paste from Clipboard Notification Toast */}
            {pasteToast && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white shadow-xl pointer-events-none">
                <span>📋</span>
                <span>{pasteToast}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/70 px-2.5 py-2 sm:px-5 sm:py-3.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#191919] text-white text-sm font-black shadow-xs dark:bg-white dark:text-[#191919]">
                  ✦
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black tracking-tight text-[#191919] dark:text-white truncate">
                      {view === "history" ? "Riwayat Percakapan" : activeSession.title}
                    </h2>
                    {view === "chat" && (
                      <span className="shrink-0 rounded-full bg-[#9A83FF]/15 px-1.5 py-0.2 text-[9px] font-black uppercase text-[#9A83FF] dark:bg-[#9A83FF]/25">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">
                    {view === "history"
                      ? `${sessions.length} percakapan tersimpan`
                      : "Memori konteks aktif · Siap lanjutkan obrolan"}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Toggle History, New Chat, Close */}
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                {/* Riwayat Button */}
                <button
                  onClick={() => setView((v) => (v === "chat" ? "history" : "chat"))}
                  className={`control-button rounded-full px-2 text-xs font-bold transition sm:px-3 ${
                    view === "history"
                      ? "bg-[#9A83FF] text-white shadow-xs"
                      : "ios-glass-subtle border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  title={view === "history" ? "Kembali ke chat" : "Buka riwayat percakapan"}
                >
                  <span>🕒</span>
                  <span className="hidden sm:inline">{view === "history" ? "Chat" : "Riwayat"}</span>
                  <span className="rounded-full bg-zinc-200/80 px-1.5 text-[10px] text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                    {sessions.length}
                  </span>
                </button>

                {/* + Obrolan Baru Button */}
                <button
                  onClick={() => startNewChat()}
                  className="control-button rounded-full border border-zinc-200/80 bg-white px-2 sm:px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
                  title="Mulai percakapan baru"
                >
                  <span>＋</span>
                  <span className="hidden sm:inline">Baru</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setOpen(false)}
                  className="icon-button rounded-full border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs font-bold text-xs shrink-0 transition"
                  title="Tutup jendela chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* VIEW 1: HISTORY WINDOW */}
            {view === "history" ? (
              <div className="flex flex-1 flex-col overflow-hidden bg-[#F8F7F7]/50 dark:bg-white/[0.02]">
                {/* Search & Actions Bar */}
                <div className="p-3 border-b border-zinc-200/80 dark:border-white/10 space-y-2 bg-white dark:bg-[#191919]">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari topik atau nama saham..."
                      value={searchHistory}
                      onChange={(e) => setSearchHistory(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-[#F8F7F7] pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#9A83FF] focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <span className="absolute left-2.5 top-2 text-xs text-zinc-400">🔍</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => startNewChat()}
                      className="font-bold text-[#9A83FF] hover:underline flex items-center gap-1"
                    >
                      <span>＋ Mulai Percakapan Baru</span>
                    </button>
                    {sessions.length > 1 && (
                      <button
                        onClick={clearAllHistory}
                        className="text-zinc-400 hover:text-rose-500 transition"
                      >
                        Hapus Semua
                      </button>
                    )}
                  </div>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredSessions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
                      <p className="text-2xl">💬</p>
                      <p>Tidak ada riwayat percakapan yang cocok.</p>
                    </div>
                  ) : (
                    filteredSessions.map((s) => {
                      const isActive = s.id === activeSessionId;
                      const userMsgs = s.messages.filter((m) => m.role === "user");
                      const lastMsg = s.messages[s.messages.length - 1];

                      return (
                        <div
                          key={s.id}
                          onClick={() => switchSession(s.id)}
                          className={`group relative flex flex-col gap-1.5 rounded-2xl p-3 cursor-pointer transition border text-xs ${
                            isActive
                              ? "border-[#9A83FF] bg-[#9A83FF]/10 shadow-xs dark:bg-[#9A83FF]/15"
                              : "border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-zinc-950 dark:text-white truncate">
                                {s.title}
                              </span>
                              {s.activeAsset && (
                                <span className="shrink-0 rounded-full bg-[#9A83FF]/15 px-1.5 py-0.2 text-[9px] font-black text-[#9A83FF]">
                                  {s.activeAsset.code}
                                </span>
                              )}
                              {isActive && (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Aktif
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-zinc-400">
                                {formatSessionTime(s.updatedAt)}
                              </span>
                              <button
                                onClick={(e) => deleteSession(s.id, e)}
                                title="Hapus percakapan"
                                className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded text-zinc-400 transition"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Last message preview */}
                          {lastMsg && (
                            <p className="line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {lastMsg.content.replace(/[*#_`>]/g, "").slice(0, 110)}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                            <span>{userMsgs.length} pertanyaan</span>
                            <span className="text-[#9A83FF] font-bold group-hover:underline">
                              Lanjutkan obrolan →
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* VIEW 2: CHAT CONVERSATION */
              <>
                {/* Profile & Active Asset Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/50 bg-zinc-100/50 px-4 py-2 text-[11px] dark:border-white/[0.05] dark:bg-zinc-900/40">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-500">Horizon:</span>
                    <select
                      value={horizon}
                      onChange={(e) => updateActiveProfile(e.target.value as any, undefined)}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <option value="investing">🌱 Investasi Panjang</option>
                      <option value="swing">📈 Swing Trading</option>
                      <option value="scalping">⚡ Scalping Cepat</option>
                    </select>

                    {/* App Context Connected Badge */}
                    <button
                      type="button"
                      onClick={() => sendMessage("Tolong berikan ringkasan dan analisis kesehatan portofolio saham saya saat ini.")}
                      className="flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      title="Klik untuk mengevaluasi data portofolio & aplikasi yang terhubung secara otomatis"
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span>Porto ({appContextStats.portfolioCount})</span>
                      <span className="text-zinc-400 dark:text-zinc-500">·</span>
                      <span>Sim ({appContextStats.simulationCount})</span>
                    </button>
                  </div>

                  {activeAsset && (
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {activeAsset.type === "stock" ? "🇮🇩 Saham" : "🪙 Kripto"}: {activeAsset.code}
                      </span>
                      <button
                        onClick={clearActiveAsset}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                        title="Hapus fokus aset"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* Messages Scroll Area */}
                <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-2.5 text-xs leading-relaxed sm:p-4">
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`min-w-0 max-w-[96%] rounded-2xl px-2.5 py-3 wrap-anywhere sm:max-w-[88%] sm:px-4 ${
                            isUser
                              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                              : "border border-zinc-200/80 bg-white/90 text-zinc-900 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100"
                          }`}
                        >
                          {/* Attachments rendering in message bubble */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-2">
                              {m.attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-950/10 dark:border-white/10"
                                >
                                  {att.type === "image" ? (
                                    <div className="group relative">
                                      <img
                                        src={att.dataUrl}
                                        alt={att.name}
                                        onClick={() => setPreviewMedia({ type: "image", url: att.dataUrl, name: att.name })}
                                        className="max-h-48 max-w-full rounded-xl object-contain cursor-zoom-in hover:brightness-95 transition"
                                      />
                                      <div className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                                        🔍 Perbesar
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1 p-1">
                                      <video
                                        src={att.dataUrl}
                                        controls
                                        className="max-h-56 max-w-full rounded-lg bg-black"
                                      />
                                      <div className="px-1 text-[10px] text-zinc-300 truncate max-w-[200px]">
                                        🎥 {att.name}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Rich Markdown & Structured Data Renderer */}
                          <ChatMessageRenderer content={m.content} isUser={isUser} />

                          <div
                            className={`mt-1.5 flex items-center justify-between text-[10px] ${
                              isUser ? "text-emerald-100" : "text-zinc-400"
                            }`}
                          >
                            <span>{m.timestamp}</span>
                            {m.source && <span>{m.source === "local" ? "Analisis lokal" : m.model ? "Gemini · " + m.model : "Gemini"}</span>}
                            {!isUser && (
                              <button
                                onClick={() => navigator.clipboard.writeText(m.content)}
                                title="Salin analisis"
                                className="hover:underline ml-2"
                              >
                                Salin
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 max-w-[80%]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Membaca data portofolio &amp; membedah pergerakan pasar live...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="border-t border-zinc-200/50 bg-zinc-50/60 px-3 py-2 dark:border-white/[0.05] dark:bg-zinc-900/50">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                    {quickPrompts.map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => sendMessage(qp.prompt)}
                        className="shrink-0 rounded-xl border border-zinc-200/80 bg-white px-2.5 py-1 text-zinc-600 transition hover:border-[#9A83FF] hover:text-[#9A83FF] dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-[#9A83FF]"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pending Media Attachments Tray */}
                {pendingAttachments.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto border-t border-zinc-200/70 bg-zinc-50/90 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    {pendingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="relative flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 pr-6 shadow-xs dark:border-white/10 dark:bg-zinc-800"
                      >
                        {att.type === "image" ? (
                          <img src={att.dataUrl} alt={att.name} className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#9A83FF]/20 text-base">
                            🎥
                          </div>
                        )}
                        <div className="max-w-[130px] truncate text-[11px] leading-tight">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{att.name}</div>
                          <div className="text-[10px] text-zinc-400">{(att.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.id !== att.id))}
                          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600 hover:bg-rose-500 hover:text-white dark:bg-zinc-700 dark:text-zinc-300 transition"
                          title="Hapus lampiran"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat Input Field (Satoshi Style) with Attachment Upload */}
                <div className="border-t border-zinc-200/80 bg-white p-3 dark:border-white/10 dark:bg-[#191919]">
                  <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-[#F8F7F7] px-2.5 py-1.5 focus-within:border-[#191919] focus-within:ring-2 focus-within:ring-[#9A83FF]/20 dark:border-white/10 dark:bg-white/[0.05] dark:focus-within:border-white">
                    {/* Hidden Native File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Paperclip Media Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="icon-button rounded-xl border border-zinc-200/80 bg-white text-zinc-600 hover:border-[#9A83FF] hover:text-[#9A83FF] transition shadow-xs dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-[#9A83FF]"
                      title="Lampirkan Gambar atau Video (atau tekan Ctrl+V langsung untuk paste gambar dari clipboard)"
                    >
                      <span className="text-sm">📎</span>
                    </button>

                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={
                        pendingAttachments.length > 0
                          ? "Ketik pertanyaan terkait media terlampir..."
                          : "Tanya saham, portofolio, atau tekan Ctrl+V untuk paste gambar..."
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="min-w-0 flex-1 bg-transparent py-2 text-base sm:text-sm text-[#191919] placeholder:text-zinc-400 focus:outline-hidden dark:text-zinc-100"
                    />

                    <button
                      onClick={() => sendMessage()}
                      disabled={(!input.trim() && pendingAttachments.length === 0) || loading}
                      className="icon-button rounded-xl bg-[#191919] text-white shadow-xs transition hover:bg-black disabled:opacity-40 dark:bg-white dark:text-[#191919]"
                      title="Kirim pesan"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Media Fullscreen Zoom Lightbox */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-zinc-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600 transition"
              title="Tutup perbesaran"
            >
              ✕
            </button>
            {previewMedia.type === "image" ? (
              <img
                src={previewMedia.url}
                alt={previewMedia.name}
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl"
              />
            ) : (
              <video
                src={previewMedia.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[85vw] rounded-xl"
              />
            )}
            <div className="p-2 text-center text-xs text-zinc-400 truncate">
              {previewMedia.name}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
