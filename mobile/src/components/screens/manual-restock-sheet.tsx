import React from "react";
import { Sheet } from "@/components/shared/sheet";
import { ReceiptReviewForm } from "@/components/screens/receipt-review-form";

/** Manual restock sheet — same review form, blank items list (web parity). */
export function ManualRestockSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Manual na Restock"
      subtitle="I-type ang mga binili para sa tinda, kahit walang resibo"
    >
      {visible ? (
        <ReceiptReviewForm source="manual" onCancel={onClose} onSaved={() => onClose()} />
      ) : null}
    </Sheet>
  );
}
