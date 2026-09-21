import { useEffect, useRef, useState } from "react";
import { streamChat } from "../api/chat";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";

const WELCOME = {
  role: "assistant",
  text: "Ask me anything about cricket's rules and laws — LBW, DRS, no-balls, follow-on, dismissals, powerplays, and more.",
  sources: [],
};

export default function ChatWindow() {
  const [messages, setMessages] = useState([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (question) => {
    // messages[0] is the welcome message, not part of the real conversation.
    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.text }));

    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: "", sources: [], streaming: true },
    ]);
    setIsStreaming(true);

    streamChat(question, history, {
      onToken: (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, text: last.text + token };
          return next;
        });
      },
      onSources: (sources) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, sources, streaming: false };
          return next;
        });
        setIsStreaming(false);
      },
      onError: () => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            text: last.text || "Sorry, something went wrong reaching the server.",
            streaming: false,
          };
          return next;
        });
        setIsStreaming(false);
      },
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <header className="px-4 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-800">🏏 Cricket Rules Chatbot</h1>
        <p className="text-xs text-gray-400">Answers grounded in the Laws of Cricket knowledge base</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} text={m.text} sources={m.sources} isStreaming={m.streaming} />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
