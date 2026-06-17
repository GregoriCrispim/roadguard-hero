import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/guardiao")({ component: Guardiao });

const SUGESTOES = [
  "Há risco de neblina na BR-153 hoje?",
  "Como agir ao encontrar um animal silvestre na pista?",
  "O que fazer em caso de acidente?",
  "Dicas para dirigir à noite com segurança",
];

function Guardiao() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const loading = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary glow-primary">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Guardião Inteligente</h1>
          <p className="text-muted-foreground">Seu assistente especializado em segurança viária.</p>
        </div>
      </div>

      <div className="mt-6 min-h-[50vh] space-y-4 rounded-2xl border bg-card p-5">
        {!messages.length && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => sendMessage({ text: s })} className="rounded-xl border bg-surface p-3 text-left text-sm hover:border-primary/40">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => {
          const txt = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{txt}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
        {loading && <p className="text-sm text-muted-foreground">Digitando...</p>}
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre segurança viária..." />
        <Button type="submit" disabled={loading || !input.trim()} className="gap-2"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}