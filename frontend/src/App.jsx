import ChatWindow from "./components/ChatWindow";
import Sidebar from "./components/Sidebar";
import { useChatSessions } from "./hooks/useChatSessions";

export default function App() {
  const { sessions, activeSession, newChat, selectSession, deleteSession, updateSessionMessages } =
    useChatSessions();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSession.id}
        onNewChat={newChat}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
      />
      <ChatWindow
        key={activeSession.id}
        session={activeSession}
        onMessagesChange={(updater) => updateSessionMessages(activeSession.id, updater)}
      />
    </div>
  );
}
