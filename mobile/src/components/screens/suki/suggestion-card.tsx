
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShoppingBasket, Sparkles } from "lucide-react-native";

import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { Badge, Button, moneyText } from "@/components/shared/ui";
import { refreshAll } from "@/store/data";
import { bulkAddShoppingItems } from "@/db/repos/shopping";
import { peso } from "@/logic/format";
import type { RestockSuggestion } from "@/logic/restock-suggester";

/**
 * "Suhestiyon ni Suki" — budget restock suggestion card.
 * Rendered directly under the assistant reply that carried a
 * RestockSuggestion; one tap adds every line to the restock list.
 */

export function SuggestionCard({ suggestion }: { suggestion: RestockSuggestion }) {
  const { palette } = useTheme();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const items = suggestion.items ?? [];

  function handleAdd() {
    if (adding || added || items.length === 0) return;
    setAdding(true);
    try {
      bulkAddShoppingItems(
        items.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          estUnitCost: i.estUnitCost,
          source: "ai",
        }))
      );
      setAdded(true);
      toast.success("Naidagdag sa restock list!");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema sa server");
    } finally {
      setAdding(false);
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.tones.amber.border,
        },
      ]}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        <Sparkles size={16} color={palette.primary} />
        <Text style={[styles.title, { color: palette.foreground }]} numberOfLines={1}>
          Suhestiyon ni Suki
        </Text>
        <Badge label={`Budget: ${peso(suggestion.budget)}`} tone="amber" />
      </View>

      {/* Item rows */}
      {items.length > 0 ? (
        <View style={styles.items}>
          {items.map((item, idx) => (
            <View
              key={`${item.productId}-${idx}`}
              style={styles.itemRow}
            >
              <View style={styles.itemLeft}>
                <Text
                  style={[styles.itemName, { color: palette.foreground }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.reasonLabel ? (
                  <Text style={[styles.itemReason, { color: palette.mutedForeground }]}>
                    {item.reasonLabel}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.itemMath, moneyText, { color: palette.foreground }]}>
                {item.qty} × {peso(item.estUnitCost)} = {peso(item.estTotal)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer totals */}
      <View
        style={[
          styles.footer,
          { borderTopColor: palette.tones.amber.border },
        ]}
      >
        <Text style={[styles.footerTotal, moneyText, { color: palette.foreground }]}>
          Estimated total: {peso(suggestion.total)}
        </Text>
        <Text style={[styles.footerRemaining, moneyText, { color: palette.tones.emerald.text }]}>
          Matitira sa budget: {peso(suggestion.remaining)}
        </Text>
      </View>

      <Button
        title={added ? "Naidagdag na!" : adding ? "Nagdaragdag…" : "Add to Restock List"}
        variant="emerald"
        onPress={handleAdd}
        disabled={added || adding || items.length === 0}
        busy={adding}
        icon={<ShoppingBasket size={14} color={palette.tones.emerald.onSolid} />}
        accessibilityLabel="Idagdag ang suhestiyon sa restock list"
        style={styles.addButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    width: "88%",
    maxWidth: "88%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  items: {
    marginTop: 10,
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  itemLeft: {
    flexShrink: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemReason: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },
  itemMath: {
    fontSize: 13.5,
    flexShrink: 0,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  footerTotal: {
    fontSize: 14,
  },
  footerRemaining: {
    fontSize: 12,
  },
  addButton: {
    marginTop: 12,
  },
});
