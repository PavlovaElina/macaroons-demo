import { describe, it, expect } from "vitest";
import { products, settings } from "../data/catalog";
import {
  count,
  allFlavors,
  restoreRemovedLine,
  deliveryEligible,
  formatPhone,
  normalizePhone,
  linePrice,
  restore,
  serialize,
  shipping,
  signature,
  subtotal,
  upsert,
  validPhone,
} from "./cart";
import type { CartLine } from "../types";
const box: CartLine = {
  id: "box-1",
  kind: "box",
  selection: { raspberry: 3, pistachio: 3 },
  capacity: 6,
  packaging: "classic",
  note: "С праздником!",
  quantity: 2,
};
describe("box and cart rules", () => {
  it("calculates integer prices including packaging and quantity", () => {
    expect(count(box.selection)).toBe(6);
    expect(linePrice(box, products)).toBe(84000);
    expect(subtotal([box], products)).toBe(168000);
    expect(linePrice({ ...box, packaging: "ribbon" }, products)).toBe(88000);
  });
  it("merges identical configurations independently of flavor order", () => {
    const a = { ...box, note: "" };
    const b = { ...a, id: "box-2", selection: { pistachio: 3, raspberry: 3 } };
    expect(signature(a)).toBe(signature(b));
    expect(upsert([a], b)[0].quantity).toBe(4);
  });
  it("keeps differently personalized boxes separate", () => {
    expect(
      upsert([box], { ...box, id: "other", note: "Спасибо" }),
    ).toHaveLength(2);
  });
  it("rejects merging over the limit without mutating inputs", () => {
    const a = { ...box, quantity: 99 };
    expect(() => upsert([a], box)).toThrow();
    expect(a.quantity).toBe(99);
  });
  it("replaces an edited line and merges it into a matching configuration", () => {
    const a = { ...box, id: "a", note: "a" };
    const b = { ...box, id: "b", note: "b" };
    const result = upsert([a, b], { ...a, note: "b" }, "a");
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(4);
  });
  it("restores a basket without personal messages", () => {
    expect(restore(serialize([box]), products)).toEqual([{ ...box, note: "" }]);
  });
  it("discards malformed, unknown and incomplete configurations", () => {
    for (const b of [
      { ...box, selection: { unknown: 6 } },
      { ...box, selection: { raspberry: 5 } },
      { ...box, quantity: -1 },
      { ...box, quantity: 1.5 },
      { ...box, selection: { raspberry: NaN } },
      { ...box, selection: { raspberry: 6 }, note: "private" },
    ])
      expect(
        restore(JSON.stringify({ version: 1, lines: [b] }), products),
      ).toEqual([]);
    expect(restore("{broken", products)).toEqual([]);
    expect(restore('{"version":7,"lines":[]}', products)).toEqual([]);
  });
  it("deduplicates persisted IDs", () => {
    const clean = { ...box, note: "" };
    expect(
      restore(JSON.stringify({ version: 1, lines: [clean, clean] }), products),
    ).toHaveLength(1);
  });
  it("applies free delivery at the threshold and pickup is free", () => {
    expect(shipping(249999, "delivery", settings)).toBe(35000);
    expect(shipping(250000, "delivery", settings)).toBe(0);
    expect(shipping(10, "pickup", settings)).toBe(0);
  });
  it("validates Russian phones, international and domestic formats", () => {
    expect(validPhone("+7 (999) 123-45-67")).toBe(true);
    expect(validPhone("+375 (29) 123-45-67")).toBe(false);
    expect(validPhone("+7 (999) 123-45")).toBe(false);
  });
  it("allows delivery only from a box or six individual macarons", () => {
    const single: CartLine = {
      id: "single",
      kind: "single",
      selection: { raspberry: 1 },
      capacity: 1,
      packaging: "classic",
      note: "",
      quantity: 5,
    };
    expect(deliveryEligible([single])).toBe(false);
    expect(deliveryEligible([{ ...single, quantity: 6 }])).toBe(true);
    expect(deliveryEligible([{ ...box, quantity: 1 }])).toBe(true);
    expect(deliveryEligible([])).toBe(false);
  });
  it("formats pasted Russian numbers and preserves partial typing", () => {
    expect(formatPhone("89991234567")).toBe("+7 (999) 123-45-67");
    expect(formatPhone("9991234567")).toBe("+7 (999) 123-45-67");
    expect(normalizePhone("8 (999) 123-45-67")).toBe("79991234567");
    expect(validPhone("8 (999) 123-45-67")).toBe(true);
    expect(formatPhone("+7")).toBe("+7");
  });
  it("fills all flavors without exceeding 6 or 12 slots", () => {
    const six = allFlavors(products, 6);
    const twelve = allFlavors(products, 12);
    expect(six).toEqual({ raspberry: 2, mango: 2, vanilla: 1, pistachio: 1 });
    expect(count(six)).toBe(6);
    expect(count(twelve)).toBe(12);
    expect(Object.values(twelve)).toEqual([3, 3, 3, 3]);
    expect(allFlavors([], 6)).toEqual({});
    expect(linePrice({ ...box, selection: six }, products)).toBe(80000);
  });
  it("restores removed boxes with packaging, note and quantity intact", () => {
    const other = { ...box, id: "other", note: "Другая открытка" };
    const restored = restoreRemovedLine([other], box, 0);
    expect(restored).toEqual([box, other]);
  });
  it("undo merges only the deleted amount and preserves later additions", () => {
    const existing = { ...box, note: "", quantity: 1 };
    const deleted = { ...existing, id: "deleted", quantity: 2 };
    expect(restoreRemovedLine([existing], deleted, 0)).toEqual([
      { ...existing, quantity: 3 },
    ]);
  });
  it("undo respects quantity limits and does not mutate the active basket", () => {
    const existing = { ...box, quantity: 99 };
    expect(() => restoreRemovedLine([existing], box, 0)).toThrow();
    expect(existing.quantity).toBe(99);
  });
});
