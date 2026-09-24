import { useState } from "react";

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-2 p-4">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask a cricket rules question, e.g. 'What counts as LBW?'"
          disabled={disabled}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
