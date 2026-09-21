export default function MessageBubble({ role, text, isStreaming }) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-white text-gray-800 border border-gray-200 shadow-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">
          {text}
          {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />}
        </p>
      </div>
    </div>
  );
}
