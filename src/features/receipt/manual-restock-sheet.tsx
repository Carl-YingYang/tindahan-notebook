"use client";

// ── Manual restock sheet — same review form, blank items list ─────

import { useMemo } from "react";
import { PackagePlus } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useRefreshAll } from "@/hooks/use-store";
import type { RestockItemDTO } from "@/types";
import { ReceiptReviewForm } from "./receipt-review-form";

export function ManualRestockSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refreshAll = useRefreshAll();
  // Stable empty list — the form remounts fresh on every open anyway.
  const initialItems = useMemo<RestockItemDTO[]>(() => [], []);

  const handleSaved = () => {
    refreshAll();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="shrink-0 pb-2 text-left">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackagePlus className="size-4" />
            </span>
            Manual na Restock
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            I-type ang mga binili para sa tinda, kahit walang resibo
          </DrawerDescription>
        </DrawerHeader>

        <ReceiptReviewForm
          initialItems={initialItems}
          onSaved={handleSaved}
          source="manual"
        />
      </DrawerContent>
    </Drawer>
  );
}
