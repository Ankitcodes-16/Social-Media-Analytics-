/** Renders post text with hashtags accented and search matches marked. */
export function HighlightedText({ text, query }: { text: string; query?: string }) {
  const q = query?.trim().replace(/^#/, "") ?? "";
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped ? `(#[A-Za-z0-9_]+|${escaped})` : "(#[A-Za-z0-9_]+)";
  const parts = text.split(new RegExp(pattern, "gi"));
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <span key={i} className="text-signal">
              {part}
            </span>
          );
        }
        if (q && part.toLowerCase() === q.toLowerCase()) {
          return (
            <mark key={i} className="rounded bg-signal/25 px-0.5 text-fg">
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
