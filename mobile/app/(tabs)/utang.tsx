import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarClock, ChevronRight, HandCoins, Plus, Search, StickyNote } from "lucide-react-native";
import { Avatar, Badge, Button, Card, EmptyState, ScreenHeader } from "@/components/shared/ui";
import { CustomerDetailDrawer } from "@/components/screens/utang/customer-detail-drawer";
import { AddUtangSheet } from "@/components/screens/shared/add-utang-sheet";
import { useTheme } from "@/theme/theme";
import { useDbQuery } from "@/store/data";
import { listCustomerSummaries } from "@/db/repos/customers";
import {
  avatarTone,
  dueInfo,
  dueUrgencyRank,
  formatDayLabel,
  peso,
} from "@/logic/format";
import { radius } from "@/theme/tokens";

export default function UtangScreen() {
  const { palette } = useTheme();
  const customers = useDbQuery(() => listCustomerSummaries(), []);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const withBalance = (customers ?? []).filter((c) => c.balance > 0);
  const totalOutstanding = withBalance.reduce((s, c) => s + c.balance, 0);
  const dueList = withBalance.filter((c) => {
    const d = dueInfo(c.dueDate);
    return d && (d.tone === "late" || d.tone === "today");
  });
  const dueCount = dueList.length;
  const dueTotal = dueList.reduce((s, c) => s + c.balance, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? (customers ?? []).filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.note ?? "").toLowerCase().includes(q) ||
            (c.notes ?? "").toLowerCase().includes(q)
        )
      : customers ?? [];
    return list.slice().sort((a, b) => {
      const ra = dueUrgencyRank(dueInfo(a.dueDate));
      const rb = dueUrgencyRank(dueInfo(b.dueDate));
      if (ra !== rb) return ra - rb;
      const da = a.dueDate ? dueInfo(a.dueDate)?.days ?? 0 : 0;
      const db = b.dueDate ? dueInfo(b.dueDate)?.days ?? 0 : 0;
      if (da !== db) return da - db;
      if (a.balance !== b.balance) return b.balance - a.balance;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
  }, [customers, search]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Utang"
          subtitle="Listahan ng mga suki"
          right={
            <Button
              title="+ Add Utang"
              size="sm"
              icon={<Plus size={14} color={palette.primaryForeground} />}
              onPress={() => setAddOpen(true)}
            />
          }
        />

        {(customers ?? []).length === 0 ? (
          <EmptyState
            icon={<HandCoins size={28} color={palette.mutedForeground} />}
            title="Wala pang utang dito"
            subtitle="Hindi pa nagagamit ang listahan. I-tap ang Add Utang para magsimula."
            action={<Button title="+ Add Utang" onPress={() => setAddOpen(true)} />}
          />
        ) : (
          <>
            {/* Summary strip */}
            <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: palette.mutedForeground }}>
                  Kabuuang natitirang utang
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: palette.tones.orange.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {peso(totalOutstanding)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: palette.foreground }}>
                  {withBalance.length} suki
                </Text>
                <Text style={{ fontSize: 11, color: palette.mutedForeground }}>ang may utang</Text>
              </View>
            </View>

            {dueCount > 0 ? (
              <View style={[styles.dueBanner, { backgroundColor: palette.tones.rose.soft }]}>
                <CalendarClock size={16} color={palette.tones.rose.text} />
                <Text style={{ color: palette.tones.rose.text, fontSize: 12.5, fontWeight: "700", flex: 1 }}>
                  {`${dueCount} suki ang due na (${peso(dueTotal)}) — kausapin na sila!`}
                </Text>
              </View>
            ) : null}

            {/* Search */}
            <View style={[styles.searchBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Search size={16} color={palette.mutedForeground} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Hanapin ang suki o tala…"
                placeholderTextColor={palette.mutedForeground}
                style={{ flex: 1, fontSize: 13.5, color: palette.foreground, paddingVertical: 10 }}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            {/* Customer cards */}
            <View style={{ gap: 8 }}>
              {filtered.map((c) => {
                const due = dueInfo(c.dueDate);
                const late = due?.tone === "late";
                const tone = avatarTone(c.name);
                const noteText = c.note?.trim() || c.notes || "";
                return (
                  <Card key={c.id} onPress={() => setDetailId(c.id)} style={styles.customerCard}>
                    <Avatar name={c.name} tone={tone} late={late} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          style={{ fontSize: 14, fontWeight: "800", color: palette.foreground, flexShrink: 1 }}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        {due && (due.tone === "late" || due.tone === "today") ? (
                          <Badge label={due.tone === "late" ? "Late" : "Due ngayon"} tone={due.tone === "late" ? "rose" : "orange"} />
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 11, color: palette.mutedForeground }} numberOfLines={1}>
                        {`${due ? `${due.label} · ` : ""}Huling tala: ${
                          c.lastActivityAt ? formatDayLabel(c.lastActivityAt) : "Walang tala pa"
                        }`}
                      </Text>
                      {noteText ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <StickyNote size={11} color={palette.tones.amber.text} />
                          <Text style={{ fontSize: 11, color: palette.tones.amber.text, flexShrink: 1 }} numberOfLines={1}>
                            {noteText}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 3 }}>
                      {c.balance > 0 ? (
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: palette.tones.orange.text,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {peso(c.balance)}
                        </Text>
                      ) : (
                        <Badge label="Bayad na" tone="emerald" />
                      )}
                      <ChevronRight size={15} color={palette.mutedForeground} />
                    </View>
                  </Card>
                );
              })}
              {filtered.length === 0 ? (
                <Text style={{ textAlign: "center", fontSize: 13, color: palette.mutedForeground, paddingVertical: 20 }}>
                  Walang tumugma.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <CustomerDetailDrawer
        visible={detailId !== null}
        onClose={() => setDetailId(null)}
        customerId={detailId}
        onDeleted={() => setDetailId(null)}
      />
      <AddUtangSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  dueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    padding: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  customerCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
});
