/**
 * Copy-pasteable customer texts — payment reminder + closing recap.
 * Templates must match the web prototype verbatim.
 */

import { peso, dueInfo, manilaDateStr } from "./format";

export interface ReminderCustomer {
  name: string;
}

export function buildPaymentReminder(
  customer: ReminderCustomer,
  balance: number,
  dueDateIso: string | null
): string {
  const due = dueInfo(dueDateIso);
  let duePart = "";
  if (due?.tone === "late") {
    duePart = " Nakalipas na po ang sinabing due date.";
  } else if (due?.tone === "today") {
    duePart = " Ata po due ngayong araw.";
  }
  return `Hi ${customer.name}! Paalala lang po: may ${peso(balance)} po kayong natitirang utang sa tindahan.${duePart} Kapag may pera na po, bayad na lang. Salamat po!`;
}

export interface RecapInput {
  benta: number;
  gastos: number;
  net: number;
  utangOutstanding: number;
  utangCustomerCount: number;
  paubosUbosCount: number;
  restockListCount: number;
  restockListTotal: number;
  bestDayLabel?: string | null;
  bestDayBenta?: number | null;
  now?: Date;
}

export function buildRecapText(input: RecapInput): string {
  const date = manilaDateStr(input.now ?? new Date());
  const lines = [
    `Recap ng tindahan — ${date}`,
    `Benta: ${peso(input.benta)}`,
    `Gastos: ${peso(input.gastos)}`,
    `Net: ${pesoSigned2(input.net)}`,
  ];
  if (input.utangOutstanding > 0) {
    lines.push(`Utang: ${peso(input.utangOutstanding)} (${input.utangCustomerCount} suki)`);
  }
  if (input.paubosUbosCount > 0) {
    lines.push(`Panindang paubos/ubos: ${input.paubosUbosCount}`);
  }
  if (input.restockListCount > 0) {
    lines.push(`Restock list: ${input.restockListCount} items (${peso(input.restockListTotal)})`);
  }
  if (input.bestDayLabel && input.bestDayBenta != null) {
    lines.push(`Pinakamalakas na araw nitong linggo: ${input.bestDayLabel} (${peso(input.bestDayBenta)} benta)`);
  }
  return lines.join("\n");
}

function pesoSigned2(n: number): string {
  return n >= 0 ? peso(n) : `-${peso(Math.abs(n))}`;
}
