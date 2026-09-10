import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  CheckCircle2,
  Moon,
  ShoppingBasket,
  Sun,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import { Card, Dot, EmptyState, SectionHeader } from "@/components/shared/ui";
import { WeekChart } from "@/components/screens/home/week-chart";
import { DaySheet } from "@/components/screens/home/day-sheet";
import { QuickEntrySheet } from "@/components/screens/home/quick-entry-sheet";
import { TalaanDrawer } from "@/components/screens/home/talaan-drawer";
import { AddUtangSheet } from "@/components/screens/shared/add-utang-sheet";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery, refreshAll } from "@/store/data";
import { getSummary, listSales, listExpenses, deleteSale, deleteExpense } from "@/db/repos/records";
import { AppError } from "@/db/repos/helpers";
import {
  greetingForHour,
  formatLongDate,
  formatDayLabel,
  peso,
  pesoSigned,
  manilaMonthStr,
} from "@/logic/format";
import { radius } from "@/theme/tokens";
import type { Sale } from "@/types";

export default function HomeScreen() {
  const { palette, scheme, setOverride } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const summary = useDbQuery(() => getSummary(), []);
  const sales = useDbQuery(() => listSales(60), []);
  const expenses = useDbQuery(() => listExpenses(60), []);

  const [talaanOpen, setTalaanOpen] = useState(false);
  const [quickEntry, setQuickEntry] = useState<"benta" | "gastos" | null>(null);
  const [addUtangOpen, setAddUtangOpen] = useState(false);
  const [dayDetail, setDayDetail] = useState<{ date: string; label: string } | null>(null);

  const greeting = greetingForHour(new Date().getHours());
  const now = new Date();

  const trend = useMemo(() => {
    const wd = summary?.weekDaily;
    if (!wd || wd.length < 7) return null;
    const prev = wd[5];
    const today = wd[6];
    return { benta: today.benta - prev.benta, gastos: today.gastos - prev.gastos };
  }, [summary]);

  const watch = useMemo(() => {
    const s = summary;
    if (!s) return [];
    const rows: Array<{ key: string; text: string; tone: "orange" | "rose" | "amber"; route: string }> = [];
    if (s.stock.paubos > 0) rows.push({ key: "paubos", text: `${s.stock.paubos} na paninda ang paubos`, tone: "orange", route: "/(tabs)/tinda" });
    if (s.stock.ubos > 0) rows.push({ key: "ubos", text: `${s.stock.ubos} na paninda ang ubos na`, tone: "rose", route: "/(tabs)/tinda" });
    if (s.utang.outstanding > 0)
      rows.push({
        key: "utang",
        text: `${peso(s.utang.outstanding)} kabuuang utang mula sa ${s.utang.customerCount} suki`,
        tone: "orange",
        route: "/(tabs)/utang",
      });
    if (s.utang.dueCount > 0)
      rows.push({
        key: "due",
        text: `${s.utang.dueCount} suki ang due na (${peso(s.utang.dueTotal)})`,
        tone: "rose",
        route: "/(tabs)/utang",
      });
    if (s.shopping.pendingCount > 0)
      rows.push({
        key: "restock",
        text: `${s.shopping.pendingCount} items sa restock list (${peso(s.shopping.pendingEstTotal)})`,
        tone: "amber",
        route: "/(tabs)/restock",
      });
    return rows;
  }, [summary]);

  const recent = useMemo(() => {
    const merged: Array<{ kind: "sale" | "expense"; record: Sale }> = [
      ...(sales ?? []).map((s) => ({ kind: "sale" as const, record: s })),
      ...(expenses ?? []).map((e) => ({ kind: "expense" as const, record: e })),
    ];
    return merged.sort((a, b) => (a.record.date < b.record.date ? 1 : -1)).slice(0, 5);
  }, [sales, expenses]);

  const deleteRecord = (kind: "sale" | "expense", id: string, amountText: string) => {
    Alert.alert(
      "Burahin ang tala?",
      kind === "sale" ? `Buburahin ang benta na ${amountText}.` : `Buburahin ang gastos na ${amountText}.`,
      [
        { text: "Hindi na lang", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              if (kind === "sale") deleteSale(id);
              else deleteExpense(id);
              refreshAll();
              toast.success("Nabura ang tala");
            } catch (e) {
              toast.error(e instanceof AppError ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: palette.primary }]}>TINDAHAN KO</Text>
          <Text style={[styles.greeting, { color: palette.foreground }]}>{greeting}!</Text>
          <Text style={{ fontSize: 12, color: palette.mutedForeground, marginTop: 2 }}>
            {formatLongDate(now)}
          </Text>
        </View>
        <Pressable
          onPress={() => setTalaanOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Buksan ang Talaan (buwanang report)"
          style={[styles.iconBtn, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          <CalendarDays size={19} color={palette.primary} />
        </Pressable>
        <Pressable
          onPress={() => setOverride(scheme === "dark" ? "light" : "dark")}
          accessibilityRole="button"
          accessibilityLabel="Palitan ang theme"
          style={[styles.iconBtn, { borderColor: palette.border, backgroundColor: palette.card }]}
        >
          {scheme === "dark" ? (
            <Sun size={19} color={palette.tones.amber.text} />
          ) : (
            <Moon size={19} color={palette.mutedForeground} />
          )}
        </Pressable>
      </View>

      {/* Ngayong Araw */}
      <SectionHeader title="Ngayong Araw" subtitle="Benta, gastos, at net ngayon" />
      <View style={styles.statRow}>
        <StatCard
          label="Benta"
          value={peso(summary?.today.benta ?? 0)}
          icon={<ShoppingBasket size={17} color={palette.tones.emerald.solid} />}
          iconBg={palette.tones.emerald.soft}
          trend={
            trend
              ? `${trend.benta >= 0 ? "+" : "-"}${peso(Math.abs(trend.benta))} vs kahapon`
              : undefined
          }
          trendIcon={
            trend && trend.benta >= 0 ? (
              <TrendingUp size={11} color={palette.tones.emerald.text} />
            ) : (
              <TrendingDown size={11} color={palette.tones.rose.text} />
            )
          }
          trendColor={trend && trend.benta >= 0 ? palette.tones.emerald.text : palette.tones.rose.text}
        />
        <StatCard
          label="Gastos"
          value={peso(summary?.today.gastos ?? 0)}
          icon={<Wallet size={17} color={palette.tones.rose.solid} />}
          iconBg={palette.tones.rose.soft}
          trend={
            trend
              ? `${trend.gastos >= 0 ? "+" : "-"}${peso(Math.abs(trend.gastos))} vs kahapon`
              : undefined
          }
          trendIcon={
            trend && trend.gastos <= 0 ? (
              <TrendingUp size={11} color={palette.tones.emerald.text} />
            ) : (
              <TrendingDown size={11} color={palette.tones.rose.text} />
            )
          }
          trendColor={trend && trend.gastos <= 0 ? palette.tones.emerald.text : palette.tones.rose.text}
        />
        <StatCard
          label="Net"
          value={pesoSigned(summary?.today.net ?? 0)}
          icon={<TrendingUp size={17} color={palette.tones.amber.text} />}
          iconBg={palette.tones.amber.soft}
        />
      </View>

      {/* Mga Dapat Bantayan */}
      <SectionHeader title="Mga Dapat Bantayan" subtitle="Paubos, ubos, utang, at restock" />
      {watch.length === 0 ? (
        <Card style={styles.allClear}>
          <CheckCircle2 size={18} color={palette.tones.emerald.solid} />
          <Text style={{ color: palette.tones.emerald.text, fontWeight: "700", fontSize: 13.5, flex: 1 }}>
            Maayos ang tindahan ngayong araw!
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {watch.map((w) => (
            <Card key={w.key} onPress={() => router.push(w.route as never)} style={styles.watchRow}>
              <Dot tone={w.tone} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: palette.foreground }}>
                {w.text}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {/* Nitong Linggo */}
      <SectionHeader title="Nitong Linggo" subtitle="Benta vs gastos sa loob ng 7 araw" />
      <Card>
        <WeekChart
          data={summary?.weekDaily ?? []}
          onViewDay={(date, label) => setDayDetail({ date, label })}
        />
      </Card>

      {/* Quick Actions */}
      <SectionHeader title="Mga Quick Action" />
      <View style={styles.quickGrid}>
        <QuickTile
          label="Add Benta"
          tone={palette.tones.emerald}
          icon={<ArrowDownCircle size={20} color={palette.tones.emerald.text} />}
          onPress={() => setQuickEntry("benta")}
        />
        <QuickTile
          label="Add Gastos"
          tone={palette.tones.rose}
          icon={<ArrowUpCircle size={20} color={palette.tones.rose.text} />}
          onPress={() => setQuickEntry("gastos")}
        />
        <QuickTile
          label="Add Utang"
          tone={palette.tones.orange}
          icon={<AlertTriangle size={20} color={palette.tones.orange.text} />}
          onPress={() => setAddUtangOpen(true)}
        />
        <QuickTile
          label="Scan Resibo"
          tone={palette.tones.amber}
          icon={<CalendarDays size={20} color={palette.tones.amber.text} />}
          onPress={() => router.push({ pathname: "/(tabs)/restock", params: { intent: "scan" } } as never)}
        />
      </View>

      {/* Pinakabagong Tala */}
      <SectionHeader title="Pinakabagong Tala" subtitle="Huling 5 tala ng benta at gastos" />
      {recent.length === 0 ? (
        <EmptyState
          icon={<Wallet size={26} color={palette.mutedForeground} />}
          title="Wala pang tala"
          subtitle="Magsimula gamit ang mga quick action sa itaas."
        />
      ) : (
        <View style={{ gap: 8 }}>
          {recent.map(({ kind, record }) => {
            const isSale = kind === "sale";
            return (
              <Card key={`${kind}-${record.id}`} style={styles.recentRow}>
                {isSale ? (
                  <ArrowDownCircle size={20} color={palette.tones.emerald.solid} />
                ) : (
                  <ArrowUpCircle size={20} color={palette.tones.rose.solid} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: palette.foreground }} numberOfLines={1}>
                    {`${record.category || (isSale ? "Benta" : "Gastos")}${record.note ? ` · ${record.note}` : ""}`}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.mutedForeground }}>
                    {formatDayLabel(record.date)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: "800",
                    color: isSale ? palette.tones.emerald.text : palette.tones.rose.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {isSale ? `+${peso(record.amount)}` : `-${peso(record.amount)}`}
                </Text>
                <Pressable
                  onPress={() => deleteRecord(kind, record.id, peso(record.amount))}
                  accessibilityRole="button"
                  accessibilityLabel="Burahin ang tala"
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 15 }}>🗑</Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}

      {/* Sheets */}
      <TalaanDrawer visible={talaanOpen} onClose={() => setTalaanOpen(false)} />
      <QuickEntrySheet
        visible={quickEntry !== null}
        onClose={() => setQuickEntry(null)}
        kind={quickEntry ?? "benta"}
      />
      <AddUtangSheet visible={addUtangOpen} onClose={() => setAddUtangOpen(false)} />
      <DaySheet
        visible={dayDetail !== null}
        onClose={() => setDayDetail(null)}
        date={dayDetail?.date ?? null}
        label={dayDetail?.label ?? ""}
      />
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  trend,
  trendIcon,
  trendColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendIcon?: React.ReactNode;
  trendColor?: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: palette.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 15.5, fontWeight: "800", color: palette.foreground, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {value}
      </Text>
      {trend ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          {trendIcon}
          <Text style={{ fontSize: 9.5, fontWeight: "700", color: trendColor }} numberOfLines={1}>
            {trend}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function QuickTile({
  label,
  tone,
  icon,
  onPress,
}: {
  label: string;
  tone: { soft: string; border: string; text: string };
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quickTile,
        { backgroundColor: tone.soft, borderColor: tone.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {icon}
      <Text style={{ fontSize: 12.5, fontWeight: "800", color: tone.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  eyebrow: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 },
  greeting: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 3,
  },
  statIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  allClear: { flexDirection: "row", alignItems: "center", gap: 10 },
  watchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTile: {
    flexGrow: 1,
    flexBasis: "47%",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 18,
  },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
});
