"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-10", className)}>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-7" strokeWidth={1.8} />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-[260px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
