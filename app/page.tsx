"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, BarChart2, AlertCircle, Loader2 } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import DataTable from "@/components/DataTable";
import ChartRenderer, { ChartConfig } from "@/components/ChartRenderer";
import { ParsedData } from "@/lib/fileParser";

interface Message {
  role: "user" | "assistant";
  content: string;
  chart?: ChartConfig;
}

function extractChart(text: string): { cleanText: string; chart: ChartConfig | null } {
  const chartBlockRegex = /```chart\s*([\s\S]*?)```/;
  const match = text.match(chartBlockRegex);

  if (!match) return { cleanText: text, chart: null };

  try {
    const chart = JSON.parse(match[1].trim()) as ChartConfig;
    const cleanText = text.replace(chartBlockRegex, "").trim();
    return { cleanText, chart };
  } catch {
    return { cleanText: text, chart: null };
  }
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const { cleanText, chart } = extractChart(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] ${
          isUser ? "order-2" : "order-1"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <BarChart2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Financial Analyst
            </span>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/60 text-foreground rounded-tl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{cleanText}</p>
        </div>

        {chart && !isUser && (
          <ChartRenderer config={chart} />
        )}

        {message.chart && !isUser && !chart && (
          <ChartRenderer config={message.chart} />
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleDataParsed = useCallback(async (data: ParsedData) => {
    setParsedData(data);
    setMessages([]);
    setError(null);
    setSummary(null);

    // Get a quick Haiku summary
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileContent: data.rawText,
          fileName: data.fileName,
        }),
      });
      if (res.ok) {
        const { summary: s } = await res.json();
        setSummary(s);
      }
    } catch {
      // Summary is optional
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Build messages to send — include file context in first message
      const apiMessages = newMessages.map((m, i) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          // Include file content only if this is the first message
          fileContent:
            messages.length === 0 && parsedData ? parsedData.rawText : undefined,
          fileName:
            messages.length === 0 && parsedData ? parsedData.fileName : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulatedText = "";

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Update the last message in real time
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulatedText,
          };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      // Remove the empty assistant message if there was an error
      setMessages((prev) =>
        prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, parsedData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the key trends in this data?",
    "Show me a chart of the main metrics",
    "What are the top 5 categories by value?",
    "Identify any anomalies or outliers",
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left panel: Upload + Data Preview */}
      <div className="w-[380px] flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-sm">Financial Analyst</h1>
              <p className="text-xs text-muted-foreground">Powered by Claude</p>
            </div>
          </div>
        </div>

        {/* Upload zone */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Upload Data
          </p>
          <FileUpload
            onDataParsed={handleDataParsed}
            onError={(e) => setError(e)}
          />
        </div>

        {/* Summary */}
        {(isSummarizing || summary) && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Quick Summary
            </p>
            {isSummarizing ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing with Haiku...
              </div>
            ) : (
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            )}
          </div>
        )}

        {/* Data table preview */}
        {parsedData && parsedData.fileType === "csv" && parsedData.rows.length > 0 && (
          <div className="flex-1 overflow-auto px-5 py-4">
            <DataTable headers={parsedData.headers} rows={parsedData.rows} />
          </div>
        )}

        {parsedData && parsedData.fileType === "pdf" && (
          <div className="flex-1 overflow-auto px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              PDF Content
            </p>
            <div className="text-xs text-foreground/70 bg-muted/30 rounded-lg p-3 max-h-[300px] overflow-auto font-mono leading-relaxed">
              {parsedData.rawText.slice(0, 2000)}
              {parsedData.rawText.length > 2000 && (
                <span className="text-muted-foreground">... (truncated)</span>
              )}
            </div>
          </div>
        )}

        {!parsedData && (
          <div className="flex-1 flex items-center justify-center px-5">
            <div className="text-center">
              <BarChart2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Upload a file to get started
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                CSV or PDF supported
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="px-6 py-3.5 border-b border-border bg-card/50 backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-foreground">
            {parsedData ? `Analyzing: ${parsedData.fileName}` : "Chat with your data"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {parsedData
              ? `${parsedData.fileType.toUpperCase()} · Ask questions, request charts, explore trends`
              : "Upload a file to begin analysis"}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              {parsedData ? (
                <>
                  <p className="text-sm text-muted-foreground font-medium">
                    Ready to analyze your data
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                          textareaRef.current?.focus();
                        }}
                        className="text-xs px-3 py-2 rounded-full border border-border bg-card hover:bg-muted/60 text-foreground/70 hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <BarChart2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">
                    Upload a CSV or PDF file to start your analysis
                  </p>
                </div>
              )}
            </div>
          )}

          {messages.map((message, i) => (
            <MessageBubble key={i} message={message} />
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start mb-4">
              <div className="max-w-[85%]">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <BarChart2 className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Financial Analyst
                  </span>
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 rounded-xl text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border bg-card/50">
          <div className="flex items-end gap-3 bg-background rounded-2xl border border-border px-4 py-3 shadow-sm focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                parsedData
                  ? "Ask about trends, request a chart, or analyze specific metrics..."
                  : "Upload a file to start chatting..."
              }
              disabled={!parsedData || isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-32"
              style={{ lineHeight: "1.5" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !parsedData || isLoading}
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5 text-center">
            Claude Sonnet for analysis · Haiku for quick summaries
          </p>
        </div>
      </div>
    </div>
  );
}
