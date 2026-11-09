import { setupWorker } from "msw/browser";
import { http, HttpResponse, delay } from "msw";
import { products, settings } from "../data/catalog";
import { shipping, subtotal } from "../utils/cart";
import { parseOrder } from "../utils/validation";
export type DemoMode =
  "normal" | "catalog-error" | "empty" | "order-error" | "slow";
let mode: DemoMode = (new URLSearchParams(location.search).get("demo") ??
  "normal") as DemoMode;
export const setDemoMode = (next: DemoMode) => {
  mode = next;
};
const endpoint = (name: string) =>
  new URL(`${import.meta.env.BASE_URL}api/${name}`, document.baseURI).href;
export const worker = setupWorker(
  http.get(endpoint("products"), async () => {
    await delay(mode === "slow" ? 2500 : 350);
    if (mode === "catalog-error")
      return new HttpResponse(null, { status: 503 });
    return HttpResponse.json(mode === "empty" ? [] : products);
  }),
  http.get(endpoint("shop-settings"), () => HttpResponse.json(settings)),
  http.post(endpoint("orders"), async ({ request }) => {
    await delay(800);
    if (mode === "order-error") return new HttpResponse(null, { status: 503 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }
    const parsed = parseOrder(body, products);
    if (!parsed)
      return HttpResponse.json(
        { error: "Проверьте данные заказа" },
        { status: 400 },
      );
    const sum = subtotal(parsed.lines, products);
    return HttpResponse.json({
      id: `MC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      total: sum + shipping(sum, parsed.checkout.method, settings),
    });
  }),
);
