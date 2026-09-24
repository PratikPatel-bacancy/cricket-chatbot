import { useEffect, useRef, useState } from "react";
import { streamChat } from "../api/chat";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import SportPicker from "./SportPicker";

export default function ChatWindow({ session, onMessagesChange, onSportChange }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef(null);
  const messages = session.messages;
  const sportLocked = messages.length > 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (question) => {
    // messages[0] is the welcome message, not part of the real conversation.
    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.text }));

    onMessagesChange((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: "", sources: [], streaming: true },
    ]);
    setIsStreaming(true);

    streamChat(question, history, session.sport, {
      onToken: (token) => {
        onMessagesChange((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, text: last.text + token };
          return next;
        });
      },
      onSources: (sources) => {
        onMessagesChange((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, sources, streaming: false };
          return next;
        });
        setIsStreaming(false);
      },
      onError: () => {
        onMessagesChange((prev) => {
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
    <div className="flex flex-col h-screen flex-1 min-w-0 bg-gray-50">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">🏆 Sports Rules Chatbot</h1>
          <p className="text-xs text-gray-400">Answers grounded in a curated rules knowledge base</p>
        </div>

        <SportPicker value={session.sport} onChange={onSportChange} locked={sportLocked} />
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} text={m.text} isStreaming={m.streaming} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
