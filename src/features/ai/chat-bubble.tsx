"use client";

// ── One chat bubble for the Suki AI conversation ────────────────
// user   → right side, primary bubble, plain text (keeps newlines)
// assistant → left side, card bubble, rendered as markdown with a tiny "Suki" label

import ReactMarkdown from "react-markdown";
import type { AiMessage } from "@/types";
import { cn } from "@/lib/utils";

export function ChatBubble({ message, className }: { message: AiMessage; className?: string }) {
  if (message.role === "user") {
    return (
      <div
        className={cn(
          "self-end max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground",
          "px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words",
          className
        )}
      >
        {message.content}
      </div>
    );
  }

  return (
    <div className={cn("self-start max-w-[85%] min-w-0", className)}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-primary">Suki</p>
      <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-[15px] leading-relaxed break-words">
        <div className="space-y-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-0">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
