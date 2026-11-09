import type {
  CartLine,
  CheckoutData,
  OrderResponse,
  Product,
  ShopSettings,
} from "../types";
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error("Сервис временно недоступен. Попробуйте ещё раз.");
  return response.json();
}
export async function loadCatalog(): Promise<{
  products: Product[];
  settings: ShopSettings;
}> {
  const [p, s] = await Promise.all([
    request("products"),
    request("shop-settings"),
  ]);
  if (
    !Array.isArray(p) ||
    !p.every(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.name === "string" &&
        typeof x.description === "string" &&
        typeof x.ingredients === "string" &&
        typeof x.image === "string" &&
        typeof x.color === "string" &&
        Number.isInteger(x.price) &&
        x.price > 0,
    )
  )
    throw new Error("Не удалось прочитать каталог.");
  const t = s as ShopSettings;
  if (
    !t ||
    !Number.isInteger(t.deliveryFee) ||
    t.deliveryFee < 0 ||
    !Number.isInteger(t.freeDeliveryFrom) ||
    t.freeDeliveryFrom < 0 ||
    typeof t.city !== "string" ||
    typeof t.pickup !== "string"
  )
    throw new Error("Не удалось прочитать условия магазина.");
  return { products: p, settings: t };
}
export async function placeOrder(
  lines: CartLine[],
  checkout: CheckoutData,
): Promise<OrderResponse> {
  const r = (await request("orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, checkout }),
  })) as OrderResponse;
  if (
    !r ||
    typeof r.id !== "string" ||
    !Number.isInteger(r.total) ||
    r.total < 0
  )
    throw new Error("Не удалось подтвердить заказ. Повторите попытку.");
  return r;
}
