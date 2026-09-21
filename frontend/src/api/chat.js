/**
 * Streams a chat answer from the backend's SSE endpoint.
 * Calls onToken(text) for each streamed token and onSources(sources) once
 * the answer is complete.
 */
export async function streamChat(question, history, { onToken, onSources, onError }) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        const event = JSON.parse(payload);
        if (event.type === "token") {
          onToken(event.text);
        } else if (event.type === "sources") {
          onSources(event.sources);
        }
      }
    }
  } catch (err) {
    onError?.(err);
  }
}
