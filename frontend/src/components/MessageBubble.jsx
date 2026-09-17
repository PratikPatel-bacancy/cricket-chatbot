export default function MessageBubble({ role, text, sources, isStreaming }) {
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

        {sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-1">Sources</p>
            <ul className="space-y-1">
              {sources.map((s, i) => (
                <li key={i} className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">{s.title}</span>
                  {" "}
                  <span className="text-gray-400">({s.file}, relevance {(s.score * 100).toFixed(0)}%)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
