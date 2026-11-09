import type { CartLine, Product, Selection, ShopSettings } from "../types";
import { PACKAGING_PRICES } from "../data/shop";
import { isRecord } from "./guards";
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n / 100);
export const count = (s: Selection) =>
  Object.values(s).reduce((a, b) => a + b, 0);
export function validSelection(
  s: unknown,
  products: Product[],
): s is Selection {
  return (
    !!s &&
    typeof s === "object" &&
    !Array.isArray(s) &&
    Object.keys(s).length > 0 &&
    Object.entries(s).every(
      ([id, n]) =>
        products.some((p) => p.id === id) &&
        Number.isInteger(n) &&
        n > 0 &&
        n <= 99,
    )
  );
}
export function validCartLine(
  value: unknown,
  products: Product[],
  allowNote = false,
): value is CartLine {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    !validSelection(value.selection, products) ||
    !Number.isInteger(value.quantity) ||
    Number(value.quantity) < 1 ||
    Number(value.quantity) > 99 ||
    !["classic", "ribbon"].includes(String(value.packaging)) ||
    typeof value.note !== "string" ||
    (allowNote ? value.note.length > 200 : value.note !== "")
  )
    return false;
  return (
    (value.kind === "single" &&
      value.capacity === 1 &&
      count(value.selection) === 1 &&
      value.packaging === "classic" &&
      value.note === "") ||
    (value.kind === "box" &&
      [6, 12].includes(Number(value.capacity)) &&
      typeof value.capacity === "number" &&
      count(value.selection) === value.capacity)
  );
}

export const linePrice = (line: CartLine, products: Product[]) =>
  Object.entries(line.selection).reduce(
    (sum, [id, n]) => sum + (products.find((p) => p.id === id)?.price ?? 0) * n,
    0,
  ) + (line.kind === "box" ? PACKAGING_PRICES[line.packaging] : 0);
export const subtotal = (lines: CartLine[], p: Product[]) =>
  lines.reduce((sum, l) => sum + linePrice(l, p) * l.quantity, 0);
export const shipping = (sum: number, method: string, s: ShopSettings) =>
  method === "delivery" && sum < s.freeDeliveryFrom ? s.deliveryFee : 0;
export const signature = (l: CartLine) =>
  JSON.stringify([
    l.kind,
    l.capacity,
    l.packaging,
    l.note,
    Object.entries(l.selection).sort(([a], [b]) => a.localeCompare(b)),
  ]);
export function upsert(
  lines: CartLine[],
  line: CartLine,
  editing?: string,
): CartLine[] {
  const other = lines.filter((l) => l.id !== editing);
  const match = other.find((l) => signature(l) === signature(line));
  if (match && match.quantity + line.quantity > 99)
    throw new Error("В одной позиции может быть не больше 99 штук.");
  return match
    ? other.map((l) =>
        l.id === match.id ? { ...l, quantity: l.quantity + line.quantity } : l,
      )
    : [...other, line];
}
export function restore(raw: string | null, p: Product[]): CartLine[] {
  try {
    const data = JSON.parse(raw ?? "null");
    if (data?.version !== 1 || !Array.isArray(data.lines)) return [];
    const ids = new Set<string>();
    const restored: CartLine[] = [];
    for (const line of data.lines) {
      if (!validCartLine(line, p) || ids.has(line.id)) continue;
      ids.add(line.id);
      const matching = restored.find(
        (item) => signature(item) === signature(line),
      );
      if (matching) {
        const available = 99 - matching.quantity;
        matching.quantity += Math.min(available, line.quantity);
      } else restored.push({ ...line, selection: { ...line.selection } });
    }
    return restored;
  } catch {
    return [];
  }
}
export const serialize = (lines: CartLine[]) =>
  JSON.stringify({ version: 1, lines: lines.map((l) => ({ ...l, note: "" })) });
export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const pieceCount = (lines: CartLine[]) =>
  lines.reduce((n, l) => n + count(l.selection) * l.quantity, 0);
export const deliveryEligible = (lines: CartLine[]) =>
  lines.some((l) => l.kind === "box") || pieceCount(lines) >= 6;
export function normalizePhone(s: string) {
  let d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  else if (d.length === 10) d = "7" + d;
  return d;
}
export const validPhone = (s: string) =>
  /^7[3489]\d{9}$/.test(normalizePhone(s));
export function formatPhone(s: string) {
  let d = s.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  else if (d.length === 10 && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  if (!d) return "";
  if (!d.startsWith("7")) return s.slice(0, 18);
  return (
    "+7" +
    (d.length > 1 ? " (" + d.slice(1, 4) : "") +
    (d.length >= 4 ? ") " : "") +
    d.slice(4, 7) +
    (d.length > 7 ? "-" + d.slice(7, 9) : "") +
    (d.length > 9 ? "-" + d.slice(9, 11) : "")
  );
}

export function allFlavors(products: Product[], capacity: 6 | 12): Selection {
  if (!products.length) return {};
  return Object.fromEntries(
    products
      .map((p, i) => [
        p.id,
        Math.floor(capacity / products.length) +
          (i < capacity % products.length ? 1 : 0),
      ])
      .filter(([, n]) => Number(n) > 0),
  );
}
export function restoreRemovedLine(
  lines: CartLine[],
  line: CartLine,
  index: number,
): CartLine[] {
  const merged = lines.some((l) => signature(l) === signature(line));
  const next = upsert(lines, line);
  if (merged) return next;
  const restored = next.pop()!;
  next.splice(Math.min(index, next.length), 0, restored);
  return next;
}
