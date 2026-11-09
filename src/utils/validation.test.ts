import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "../data/catalog";
import { localDate, restore } from "./cart";
import { checkoutErrors, parseOrder } from "./validation";
import type { CartLine, CheckoutData } from "../types";
const box: CartLine = {
  id: "box",
  kind: "box",
  capacity: 6,
  selection: { raspberry: 6 },
  packaging: "classic",
  note: "С праздником!",
  quantity: 1,
};
const contact = (): CheckoutData => ({
  name: "Анна",
  phone: "79991234567",
  method: "pickup",
  address: "",
  date: localDate(1),
  interval: "10:00–13:00",
  comment: "",
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 9, 12));
});
afterEach(() => vi.useRealTimers());
describe("order contract", () => {
  it("accepts a complete box and preserves its message", () => {
    const order = parseOrder({ lines: [box], checkout: contact() }, products);
    expect(order?.lines[0].note).toBe("С праздником!");
  });
  it.each([
    null,
    [],
    {},
    { lines: null },
    { lines: 3 },
    { lines: [null] },
    { lines: [box], checkout: null },
  ])("rejects malformed body %j without throwing", (input) => {
    expect(parseOrder(input, products)).toBeNull();
  });
  it("rejects repeated IDs, incomplete boxes and nonnumeric quantities", () => {
    for (const lines of [
      [box, box],
      [{ ...box, quantity: "1" }],
      [{ ...box, selection: { raspberry: 5 } }],
    ])
      expect(parseOrder({ lines, checkout: contact() }, products)).toBeNull();
  });
  it("rejects missing or incorrectly typed contact fields", () => {
    for (const checkout of [
      { ...contact(), name: null },
      { ...contact(), address: [] },
      { ...contact(), comment: 3 },
      { ...contact(), method: "unknown" },
    ])
      expect(parseOrder({ lines: [box], checkout }, products)).toBeNull();
  });
  it("checks both the delivery threshold and the address", () => {
    const single: CartLine = {
      id: "s",
      kind: "single",
      capacity: 1,
      selection: { raspberry: 1 },
      packaging: "classic",
      note: "",
      quantity: 5,
    };
    const checkout = {
      ...contact(),
      method: "delivery" as const,
      address: "Улица Сладкая, 12",
    };
    expect(parseOrder({ lines: [single], checkout }, products)).toBeNull();
    expect(
      parseOrder({ lines: [{ ...single, quantity: 6 }], checkout }, products),
    ).not.toBeNull();
    expect(
      parseOrder(
        { lines: [box], checkout: { ...checkout, address: "" } },
        products,
      ),
    ).toBeNull();
  });
  it("rejects old dates, dates too far away, unknown intervals and excess text", () => {
    for (const checkout of [
      { ...contact(), date: localDate() },
      { ...contact(), date: localDate(15) },
      { ...contact(), interval: "09:00–10:00" },
      { ...contact(), comment: "x".repeat(301) },
    ])
      expect(parseOrder({ lines: [box], checkout }, products)).toBeNull();
    expect(checkoutErrors(contact(), [box])).toEqual({});
  });
  it("recovers valid saved lines around malformed entries", () => {
    const saved = { ...box, note: "" };
    expect(
      restore(
        JSON.stringify({ version: 1, lines: [null, saved, { bad: true }] }),
        products,
      ),
    ).toEqual([saved]);
  });
  it("normalizes equivalent saved variants without exceeding the quantity limit", () => {
    const saved = { ...box, note: "", quantity: 60 };
    const result = restore(
      JSON.stringify({ version: 1, lines: [saved, { ...saved, id: "other" }] }),
      products,
    );
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(99);
  });
  it("rejects impossible calendar dates even inside the booking window", () => {
    vi.setSystemTime(new Date(2026, 10, 27, 12));
    expect(
      parseOrder(
        { lines: [box], checkout: { ...contact(), date: "2026-11-31" } },
        products,
      ),
    ).toBeNull();
  });
});
