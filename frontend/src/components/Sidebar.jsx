export default function Sidebar({ sessions, activeSessionId, onNewChat, onSelectSession, onDeleteSession }) {
  return (
    <aside className="w-64 shrink-0 h-screen bg-gray-900 text-gray-200 flex flex-col">
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          <span>New chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Recents</p>
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelectSession(s.id)}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer ${
              s.id === activeSessionId ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800/60"
            }`}
          >
            <span className="truncate">{s.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(s.id);
              }}
              aria-label="Delete chat"
              className="ml-2 shrink-0 text-gray-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
