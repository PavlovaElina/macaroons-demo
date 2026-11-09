import { useRef, useState } from "react";
import type {
  CartLine,
  CheckoutData,
  OrderResponse,
  Product,
  ShopSettings,
} from "../types";
import {
  formatPhone,
  deliveryEligible,
  normalizePhone,
  localDate,
  money,
  shipping,
  subtotal,
} from "../utils/cart";
import { checkoutErrors } from "../utils/validation";
import { RECEIPT_INTERVALS } from "../data/shop";
import { placeOrder } from "../services/api";
export const freshCheckout = (): CheckoutData => ({
  name: "",
  phone: "",
  method: "pickup",
  address: "",
  date: localDate(1),
  interval: RECEIPT_INTERVALS[0],
  comment: "",
});
export function Checkout({
  lines,
  products,
  settings,
  data,
  setData,
  onSuccess,
  onBack,
  onBusy,
}: {
  lines: CartLine[];
  products: Product[];
  settings: ShopSettings;
  data: CheckoutData;
  setData: (d: CheckoutData) => void;
  onSuccess: (r: OrderResponse) => void;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const sum = subtotal(lines, products);
  const eligible = deliveryEligible(lines);
  const delivery = shipping(sum, data.method, settings);
  const change = (name: keyof CheckoutData, value: string) => {
    setData({ ...data, [name]: value });
    setErrors((e) => ({ ...e, [name]: "" }));
  };
  const field = (name: keyof CheckoutData) => ({
    id: name,
    name,
    value: data[name],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      change(
        name,
        name === "phone" ? formatPhone(e.target.value) : e.target.value,
      ),
    "aria-labelledby": `${name}-label`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const message = (name: string) =>
    errors[name] && (
      <small id={`${name}-error`} className="field-error">
        {errors[name]}
      </small>
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const next = checkoutErrors(data, lines);
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      onSuccess(
        await placeOrder(lines, { ...data, phone: normalizePhone(data.phone) }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось оформить заказ.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form ref={form} noValidate onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend className="sr-only">Данные заказа</legend>
        <div className="form-grid">
          <label htmlFor="name">
            <span id="name-label">Ваше имя</span>
            <input
              {...field("name")}
              autoComplete="given-name"
              maxLength={60}
              placeholder="Например, Анна"
            />
            {message("name")}
          </label>
          <label htmlFor="phone">
            <span id="phone-label">Телефон</span>
            <input
              {...field("phone")}
              type="tel"
              autoComplete="tel"
              placeholder="+7 (999) 123-45-67"
            />
            {message("phone")}
          </label>
        </div>
        <div
          className="segmented delivery-switch"
          role="group"
          aria-label="Способ получения"
        >
          <button
            type="button"
            aria-pressed={data.method === "pickup"}
            onClick={() => change("method", "pickup")}
          >
            Самовывоз
          </button>
          <button
            type="button"
            disabled={!eligible}
            aria-describedby={!eligible ? "delivery-restriction" : undefined}
            aria-pressed={data.method === "delivery"}
            onClick={() => change("method", "delivery")}
          >
            Доставка
          </button>
        </div>
        {!eligible && (
          <p id="delivery-restriction" className="info-note">
            Доставка от 1 коробки или 6 макарунов. Для текущего заказа доступен
            самовывоз.
          </p>
        )}
        {message("method")}
        {data.method === "pickup" ? (
          <p className="info-note">
            {settings.pickup}. Ежедневно с 10:00 до 19:00.
          </p>
        ) : (
          <label htmlFor="address">
            <span id="address-label">Адрес в городе {settings.city}</span>
            <input
              {...field("address")}
              autoComplete="street-address"
              placeholder="Улица, дом, квартира"
              maxLength={200}
            />
            <small>Укажите улицу, дом и квартиру для доставки.</small>
            {message("address")}
          </label>
        )}
        <div className="form-grid">
          <label htmlFor="date">
            <span id="date-label">Дата получения</span>
            <input
              {...field("date")}
              type="date"
              min={localDate(1)}
              max={localDate(14)}
            />
            {message("date")}
          </label>
          <label htmlFor="interval">
            <span id="interval-label">Время</span>
            <select {...field("interval")}>
              {RECEIPT_INTERVALS.map((interval) => (
                <option key={interval}>{interval}</option>
              ))}
            </select>
          </label>
        </div>
        <label htmlFor="comment">
          <span id="comment-label">Комментарий</span>{" "}
          <span className="muted">— необязательно</span>
          <textarea
            {...field("comment")}
            rows={2}
            maxLength={300}
            placeholder="Что нам учесть?"
          />
        </label>
      </fieldset>
      <div className="checkout-total">
        <span>
          Товары <b>{money(sum)}</b>
        </span>
        <span>
          {data.method === "delivery" ? "Доставка" : "Самовывоз"}{" "}
          <b>{delivery ? money(delivery) : "Бесплатно"}</b>
        </span>
        <span className="grand-total">
          Итого <b>{money(sum + delivery)}</b>
        </span>
      </div>
      <p className="muted">Оплата при получении.</p>
      {error && (
        <p role="alert" className="error">
          {error} Данные сохранены, можно повторить отправку.
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onBack}
        >
          ← К корзине
        </button>
        <button className="button" disabled={busy} type="submit">
          {busy ? "Оформляем…" : "Подтвердить заказ"}
        </button>
      </div>
    </form>
  );
}
