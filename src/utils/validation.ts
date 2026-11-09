import type { CartLine, CheckoutData, Product } from "../types";
import { deliveryEligible, localDate, validPhone, validCartLine } from "./cart";
import { isRecord } from "./guards";
import { RECEIPT_INTERVALS } from "../data/shop";
export function checkoutErrors(
  data: CheckoutData,
  lines: CartLine[],
): Partial<Record<keyof CheckoutData, string>> {
  const errors: Partial<Record<keyof CheckoutData, string>> = {};
  if (data.name.trim().length < 2 || data.name.trim().length > 60)
    errors.name = "Введите имя — минимум 2 символа.";
  if (!validPhone(data.phone))
    errors.phone = "Введите российский номер: +7 (999) 123-45-67.";
  if (!["pickup", "delivery"].includes(data.method))
    errors.method = "Выберите способ получения.";
  if (data.method === "delivery" && !deliveryEligible(lines))
    errors.method =
      "Доставка доступна от коробки или 6 макарунов. Выберите самовывоз.";
  if (
    data.method === "delivery" &&
    (data.address.trim().length < 8 || data.address.length > 200)
  )
    errors.address = "Укажите улицу, дом и квартиру.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !Number.isFinite(Date.parse(`${data.date}T00:00:00Z`)) ||
    new Date(`${data.date}T00:00:00Z`).toISOString().slice(0, 10) !==
      data.date ||
    data.date < localDate(1) ||
    data.date > localDate(14)
  )
    errors.date = "Выберите дату от завтра до двух недель вперёд.";
  if (!RECEIPT_INTERVALS.some((interval) => interval === data.interval))
    errors.interval = "Выберите время получения.";
  if (data.comment.length > 300)
    errors.comment = "Комментарий — не больше 300 символов.";
  return errors;
}
export function parseOrder(
  value: unknown,
  products: Product[],
): { lines: CartLine[]; checkout: CheckoutData } | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.lines) ||
    !value.lines.length ||
    !isRecord(value.checkout)
  )
    return null;
  const lines: CartLine[] = [];
  const ids = new Set<string>();
  for (const line of value.lines) {
    if (!validCartLine(line, products, true) || ids.has(line.id)) return null;
    lines.push(line);
    ids.add(line.id);
  }
  const c = value.checkout;
  if (
    ![
      "name",
      "phone",
      "method",
      "address",
      "date",
      "interval",
      "comment",
    ].every((key) => typeof c[key] === "string")
  )
    return null;
  const checkout = c as CheckoutData;
  if (Object.keys(checkoutErrors(checkout, lines)).length) return null;
  return { lines, checkout };
}
