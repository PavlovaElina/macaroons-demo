import { useEffect, useRef, useState } from "react";
import { asset } from "./data/catalog";
import type {
  CartLine,
  Product,
  Selection,
  ShopSettings,
  OrderResponse,
} from "./types";
import {
  count,
  linePrice,
  deliveryEligible,
  pieceCount,
  money,
  restore,
  restoreRemovedLine,
  serialize,
  subtotal,
  upsert,
} from "./utils/cart";
import { loadCatalog } from "./services/api";
import { Icon } from "./components/Icon";
import { UndoRemoval, type RemovedItem } from "./components/UndoRemoval";
import { Dialog, Quantity } from "./components/Dialog";
import { Checkout, freshCheckout } from "./components/Checkout";
import { OrderSection, type OrderTab } from "./components/OrderSection";
import { setDemoMode, type DemoMode } from "./mocks/browser";
const KEY = "macaroons-cart-v1";
const labels: Record<string, string> = {
  raspberry: "Малина",
  mango: "Манго",
  vanilla: "Ваниль",
  pistachio: "Фисташка",
};
export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pricingProducts, setPricingProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reload, setReload] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const restored = useRef(false);
  const [storageError, setStorageError] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [conversion, setConversion] = useState<Selection>();
  const [orderTab, setOrderTab] = useState<OrderTab>("boxes");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState<RemovedItem[]>([]);
  const [undoError, setUndoError] = useState("");
  const [dialog, setDialog] = useState<
    "cart" | "checkout" | "product" | "success" | null
  >(null);
  const [product, setProduct] = useState<Product>();
  const [checkout, setCheckout] = useState(freshCheckout);
  const [order, setOrder] = useState<OrderResponse>();
  const [receipt, setReceipt] = useState<{
    lines: CartLine[];
    method: string;
  }>();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  const burger = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState(
    new URLSearchParams(location.search).get("demo") ?? "normal",
  );
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((r) => {
        if (!active) return;
        setProducts(r.products);
        if (r.products.length) setPricingProducts(r.products);
        setSettings(r.settings);
        setStatus("ready");
        if (!restored.current && r.products.length) {
          try {
            setCart(restore(localStorage.getItem(KEY), r.products));
          } catch {
            setStorageError(true);
          }
          restored.current = true;
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, serialize(cart));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [cart]);
  useEffect(() => {
    if (!menu) return;
    const el = menuRef.current!;
    const trigger = burger.current;
    const before = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = before;
      trigger?.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!removed.length) return;
    const next = Math.min(...removed.map((item) => item.expiresAt));
    const timer = setTimeout(
      () =>
        setRemoved((items) =>
          items.filter((item) => item.expiresAt > Date.now()),
        ),
      Math.max(0, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [removed]);
  function removeLine(line: CartLine) {
    const index = cart.findIndex((l) => l.id === line.id);
    if (index < 0) return;
    setRemoved((items) => [
      ...items,
      {
        token: crypto.randomUUID(),
        line,
        index,
        expiresAt: Date.now() + 15000,
      },
    ]);
    setCart((items) => items.filter((l) => l.id !== line.id));
    setNotice("");
    setUndoError("");
    if (editing === line.id) setEditing(undefined);
  }
  function undoRemoval(item: RemovedItem) {
    try {
      setCart(restoreRemovedLine(cart, item.line, item.index));
      setRemoved((items) => items.filter((i) => i.token !== item.token));
      setUndoError("");
      notify("Товар возвращён в корзину");
    } catch (e) {
      setUndoError((e as Error).message);
    }
  }
  const sum = subtotal(cart, pricingProducts);
  const totalCount = cart.reduce((a, l) => a + l.quantity, 0);
  const close = () => {
    if (submitting) return;
    setDialog(null);
    setCheckout(freshCheckout());
    setReceipt(undefined);
    setOrder(undefined);
  };
  const notify = (s: string) => setNotice(s);
  function changeSingle(p: Product, n: number) {
    if (!n) {
      const line = cart.find((l) => l.kind === "single" && l.selection[p.id]);
      if (line) removeLine(line);
      return;
    }
    setCart((prev) => {
      const existing = prev.find(
        (l) => l.kind === "single" && l.selection[p.id],
      );
      if (existing)
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: n } : l,
        );
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: "single",
          selection: { [p.id]: 1 },
          capacity: 1,
          packaging: "classic",
          note: "",
          quantity: n,
        },
      ];
    });
    notify(
      n
        ? `Макарун «${p.name}»: в корзине ${n} шт.`
        : `Макарун «${p.name}» удалён из корзины`,
    );
  }
  function saveBox(line: CartLine) {
    try {
      const remaining = conversion
        ? cart.flatMap((l) => {
            if (l.kind !== "single") return [l];
            const n =
              l.quantity - (conversion[Object.keys(l.selection)[0]] ?? 0);
            return n > 0 ? [{ ...l, quantity: n }] : [];
          })
        : cart;
      setCart(
        upsert(
          remaining,
          { ...line, id: editing ?? crypto.randomUUID() },
          editing,
        ),
      );
      setEditing(undefined);
      setConversion(undefined);
      notify(
        editing
          ? "Коробка обновлена"
          : "Подарочная коробка добавлена в корзину",
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  function goToOrder(tab: OrderTab = "boxes") {
    setOrderTab(tab);
    requestAnimationFrame(() => {
      document.getElementById("catalog")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      document.getElementById("builder-title")?.focus({ preventScroll: true });
    });
  }
  function editBox(l: CartLine) {
    close();
    setConversion(undefined);
    setEditing(l.id);
    goToOrder();
  }
  function convertSingles() {
    const selected: Selection = {};
    let slots = 12;
    for (const l of cart) {
      if (l.kind !== "single") continue;
      const id = Object.keys(l.selection)[0];
      const n = Math.min(l.quantity, slots);
      if (n) selected[id] = (selected[id] ?? 0) + n;
      slots -= n;
      if (!slots) break;
    }
    close();
    setEditing(undefined);
    setConversion(selected);
    goToOrder();
  }
  const description = (l: CartLine) =>
    Object.entries(l.selection)
      .map(
        ([id, n]) =>
          `${pricingProducts.find((p) => p.id === id)?.name ?? labels[id] ?? id} × ${n}`,
      )
      .join(" · ");
  const lineName = (l: CartLine) =>
    l.kind === "box"
      ? `Коробка на ${l.capacity} макарунов`
      : `Макарун «${pricingProducts.find((p) => p.id === Object.keys(l.selection)[0])?.name ?? ""}»`;
  function changeMode(value: string) {
    setMode(value);
    setDemoMode(value as DemoMode);
    setStatus("loading");
    setReload((n) => n + 1);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <div className="demo-bar" role="region" aria-label="Об учебном проекте">
        Портфолио-проект <span>•</span> Учебная кондитерская, без настоящих
        заказов
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#" className="wordmark">
            macaroons<span>маленькие радости</span>
          </a>
          <nav className="desktop-nav" aria-label="Главная навигация">
            <a href="#catalog" onClick={() => goToOrder()}>
              Выбрать макаруны
            </a>
            <a href="#about">О макарунах</a>
            <a href="#delivery">Получение</a>
          </nav>
          <div className="header-actions">
            <button className="cart-button" onClick={() => setDialog("cart")}>
              Корзина <span>{totalCount}</span>
            </button>
            <button
              ref={burger}
              className="burger icon-button"
              aria-label="Открыть меню"
              aria-expanded={menu}
              aria-controls="mobile-menu"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
      {menu && (
        <dialog
          ref={menuRef}
          id="mobile-menu"
          aria-label="Меню"
          className="mobile-menu"
          onCancel={(e) => {
            e.preventDefault();
            setMenu(false);
          }}
        >
          <button
            className="icon-button"
            aria-label="Закрыть меню"
            onClick={() => setMenu(false)}
          >
            <Icon name="close" />
          </button>
          <nav aria-label="Мобильная навигация">
            {[
              ["catalog", "Выбрать макаруны"],
              ["about", "О макарунах"],
              ["delivery", "Получение"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => {
                  setMenu(false);
                  if (id === "catalog") goToOrder();
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </dialog>
      )}
      <main id="main">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">
                Маленький десерт. Большой повод улыбнуться.
              </p>
              <h1>
                Счастье бывает
                <br />
                со вкусом <em>макаруна.</em>
              </h1>
              <p className="hero-description">
                Нежная начинка, тонкая корочка и ваши любимые вкусы. Для себя,
                близких и просто хорошего дня.
              </p>
              <div className="hero-actions">
                <a
                  className="button"
                  href="#catalog"
                  onClick={() => goToOrder()}
                >
                  Выбрать свой вкус <span>↗</span>
                </a>
              </div>
              <p className="hero-footnote">
                4 любимых вкуса <span>✦</span> Коробочки на 6 и 12 штук
              </p>
            </div>
            <div className="hero-art">
              <div className="hero-ring" />
              <img
                src={asset("hero-macarons.webp")}
                alt="Подарочная коробка с разноцветными макарунами"
                width="529"
                height="438"
                fetchPriority="high"
              />
              <div className="round-label">
                Собрано
                <br />
                <i>с нежностью</i>
                <span>✦</span>
              </div>
            </div>
          </div>
        </section>
        <OrderSection
          key={editing ?? (conversion ? "conversion" : "new")}
          products={products}
          cartTotal={sum}
          status={status}
          cart={cart}
          tab={orderTab}
          onTab={setOrderTab}
          onRetry={() => {
            setStatus("loading");
            setReload((n) => n + 1);
          }}
          onDetails={(p) => {
            setProduct(p);
            setDialog("product");
          }}
          onSingleChange={changeSingle}
          onSave={saveBox}
          onCancel={() => {
            setEditing(undefined);
            setConversion(undefined);
          }}
          initial={
            editing
              ? cart.find((l) => l.id === editing)
              : conversion
                ? {
                    id: "conversion",
                    kind: "box",
                    selection: conversion,
                    capacity: count(conversion) <= 6 ? 6 : 12,
                    packaging: "classic",
                    note: "",
                    quantity: 1,
                  }
                : undefined
          }
          converting={!!conversion}
          onConvert={convertSingles}
          onCart={() => setDialog("cart")}
        />
        <section id="about" className="about section">
          <div className="container about-grid">
            <div className="about-art">
              <span className="eyebrow">Хруст снаружи. Нежность внутри.</span>
              <img
                src={asset("macaron-closeup.webp")}
                alt="Макарун крупным планом"
                width="520"
                height="314"
                loading="lazy"
              />
            </div>
            <div>
              <p className="eyebrow">Чуть больше, чем десерт</p>
              <h2>
                Для моментов,
                <br />
                которые хочется
                <br />
                <em>сделать слаще.</em>
              </h2>
              <p className="about-text">
                Утренний кофе, встреча с подругой или маленькое «спасибо».
                Необязательно ждать особого повода, чтобы подарить немного
                радости.
              </p>
              <div className="about-details">
                <div>
                  <span>01</span>
                  <h3>Ваше сочетание</h3>
                  <p>Один любимый вкус или все четыре — решаете вы.</p>
                </div>
                <div>
                  <span>02</span>
                  <h3>Личный подарок</h3>
                  <p>
                    Лента и открытка с вашими словами сделают его особенным.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="delivery" className="section delivery">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">До встречи за сладким</p>
                <h2>
                  Забрать самим
                  <br />
                  или ждать в гости?
                </h2>
              </div>
              <p>Выберите удобный способ получения при оформлении.</p>
            </div>
            <div className="delivery-grid">
              <article>
                <span className="delivery-icon">↗</span>
                <h3>Загляните за коробочкой</h3>
                <p>{settings?.pickup ?? "Москва, ул. Сладкая, 12"}</p>
                <p>
                  Ежедневно, 10:00–19:00.
                  <br />
                  Самовывоз — бесплатно.
                </p>
              </article>
              <article>
                <span className="delivery-icon">⌁</span>
                <h3>Привезём по Москве</h3>
                <p>
                  Доставка от 1 коробки или 6 макарунов —{" "}
                  {money(settings?.deliveryFee ?? 35000)}, бесплатно от{" "}
                  {money(settings?.freeDeliveryFrom ?? 250000)}. Адрес
                  указывается вручную.
                </p>
                <p>
                  Выберите дату от завтра и один из трёх интервалов при
                  оформлении.
                </p>
              </article>
            </div>
            <div className="faq">
              <h3>Пара ответов перед заказом</h3>
              {[
                [
                  "Можно выбрать разные вкусы?",
                  "Да. В коробочке на 6 или 12 штук можно сочетать любые из четырёх вкусов в любом количестве в пределах выбранного размера.",
                ],
                [
                  "Можно заказать несколько коробочек?",
                  "Да. Добавьте несколько разных наборов или увеличьте количество одинаковых коробочек в корзине.",
                ],
                [
                  "Как хранить макаруны?",
                  "Храните в холодильнике и достаньте за 15 минут до подачи. Точный срок хранения указан на упаковке.",
                ],
                [
                  "Можно добавить открытку?",
                  "Да. Напишите свои пожелания при сборке коробочки — открытка бесплатная. Можно добавить до 200 символов.",
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container footer-top">
          <a className="wordmark" href="#">
            macaroons<span>маленькие радости</span>
          </a>
          <p>
            Пусть сегодня будет
            <br />
            что-нибудь хорошее.
          </p>
          <a
            className="footer-link"
            href="#catalog"
            onClick={() => goToOrder()}
          >
            Собрать коробочку ↗
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Macaroons</span>
          <span>Маленькие радости каждый день</span>
        </div>
        {new URLSearchParams(location.search).get("tools") === "1" && (
          <div className="container demo-controls">
            <label htmlFor="demo-mode">Демонстрация состояний API</label>
            <select
              id="demo-mode"
              value={mode}
              onChange={(e) => changeMode(e.target.value)}
            >
              <option value="normal">Обычный режим</option>
              <option value="slow">Медленная загрузка</option>
              <option value="catalog-error">Ошибка каталога</option>
              <option value="empty">Пустой каталог</option>
              <option value="order-error">Ошибка оформления</option>
            </select>
          </div>
        )}
      </footer>
      <div
        className={`toast ${notice && !removed.length ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
      {!dialog && (
        <UndoRemoval
          items={removed}
          onUndo={undoRemoval}
          name={lineName}
          error={undoError}
          floating
        />
      )}
      {storageError && (
        <p className="storage-note" role="status">
          Хранилище недоступно: корзина работает до перезагрузки.
        </p>
      )}
      {dialog === "product" && product && (
        <Dialog title={`Макарун «${product.name}»`} onClose={close}>
          <div className="product-detail" style={{ background: product.color }}>
            <img
              src={asset(product.image)}
              alt={product.name}
              width="195"
              height="124"
            />
          </div>
          <p>{product.description}</p>
          <h3>Состав</h3>
          <p>{product.ingredients}</p>
          <p className="info-note">Содержит орехи, яйца и молочные продукты.</p>
          <div className="dialog-actions">
            <b>{money(product.price)} / шт.</b>
            <button
              className="button"
              onClick={() => {
                close();
                goToOrder(orderTab);
              }}
            >
              К выбору количества
            </button>
          </div>
        </Dialog>
      )}
      {dialog === "cart" && (
        <Dialog
          title={`Ваша корзинка${totalCount ? ` · ${totalCount}` : ""}`}
          onClose={close}
          wide
        >
          <UndoRemoval
            items={removed}
            onUndo={undoRemoval}
            name={lineName}
            error={undoError}
          />
          {!cart.length ? (
            <div className="empty-state">
              <span className="empty-symbol">✦</span>
              <h3>Здесь пока тихо и несладко</h3>
              <p>Выберите любимый вкус или соберите коробочку.</p>
              <button
                className="button"
                onClick={() => {
                  close();
                  location.hash = "catalog";
                }}
              >
                К макарунам ↗
              </button>
            </div>
          ) : (
            <>
              <div className="cart-lines">
                {cart.map((l) => (
                  <article className="cart-line" key={l.id}>
                    <div className="cart-image">
                      <img
                        src={asset(
                          products.find(
                            (p) => p.id === Object.keys(l.selection)[0],
                          )?.image ?? "raspberry.webp",
                        )}
                        alt=""
                        width="100"
                        height="70"
                      />
                    </div>
                    <div className="cart-info">
                      <h3>{lineName(l)}</h3>
                      <p>{description(l)}</p>
                      {l.kind === "box" && (
                        <>
                          <small>
                            {l.packaging === "ribbon"
                              ? "С лентой"
                              : "Классическая упаковка"}
                            {l.note ? ` · Открытка: ${l.note}` : ""}
                          </small>
                          <button
                            className="text-button"
                            onClick={() => editBox(l)}
                          >
                            Изменить состав
                          </button>
                        </>
                      )}
                      <button
                        className="remove-button"
                        onClick={() => removeLine(l)}
                        aria-label={`Удалить: ${lineName(l)}`}
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="cart-line-end">
                      <b>{money(linePrice(l, pricingProducts) * l.quantity)}</b>
                      <Quantity
                        label={lineName(l)}
                        value={l.quantity}
                        onChange={(n) => {
                          if (n)
                            setCart(
                              cart.map((x) =>
                                x.id === l.id ? { ...x, quantity: n } : x,
                              ),
                            );
                          else removeLine(l);
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
              <div className="cart-summary">
                <span>
                  Товары <b>{money(sum)}</b>
                </span>
                <p>
                  {pieceCount(cart)} макарунов всего.{" "}
                  {deliveryEligible(cart)
                    ? "Доставка доступна."
                    : "Для доставки нужна коробочка или минимум 6 макарунов. Сейчас доступен самовывоз."}
                </p>
                {cart.some((l) => l.kind === "single") && (
                  <button className="text-button" onClick={convertSingles}>
                    Перенести поштучные макаруны в коробку
                  </button>
                )}
                <p>
                  {sum < (settings?.freeDeliveryFrom ?? 250000)
                    ? `До бесплатной доставки ещё ${money((settings?.freeDeliveryFrom ?? 250000) - sum)}`
                    : "Для этой корзины доставка бесплатная"}
                </p>
              </div>
              <div className="dialog-actions">
                <button className="text-button" onClick={close}>
                  Продолжить выбор
                </button>
                <button
                  className="button"
                  disabled={status !== "ready" || !products.length || !settings}
                  onClick={() => {
                    if (!deliveryEligible(cart))
                      setCheckout((c) => ({ ...c, method: "pickup" }));
                    setDialog("checkout");
                  }}
                >
                  К оформлению ↗
                </button>
              </div>
              {status !== "ready" && (
                <p className="info-note">
                  Для оформления дождитесь загрузки каталога.
                </p>
              )}
            </>
          )}
        </Dialog>
      )}
      {dialog === "checkout" && settings && (
        <Dialog title="Почти готово" onClose={close} wide>
          <Checkout
            lines={cart}
            products={pricingProducts}
            settings={settings}
            data={checkout}
            setData={setCheckout}
            onBusy={setSubmitting}
            onBack={() => setDialog("cart")}
            onSuccess={(r) => {
              setReceipt({ lines: cart, method: checkout.method });
              setOrder(r);
              setCart([]);
              setRemoved([]);
              setEditing(undefined);
              setConversion(undefined);
              setDialog("success");
            }}
          />
        </Dialog>
      )}
      {dialog === "success" && order && (
        <Dialog title="Коробочка радости готова!" onClose={close}>
          <div className="success-mark">✓</div>
          <p>
            Заказ <strong>{order.id}</strong> успешно оформлен.
          </p>
          <div className="receipt">
            {receipt?.lines.map((l) => (
              <p key={l.id}>
                <b>
                  {lineName(l)} × {l.quantity}
                </b>
                <br />
                {description(l)}
                {l.note && (
                  <>
                    <br />
                    Открытка: {l.note}
                  </>
                )}
              </p>
            ))}
            <p>
              {receipt?.method === "delivery" ? "Доставка" : "Самовывоз"} ·{" "}
              {checkout.date} · {checkout.interval}
            </p>
            <p>
              <b>Итого: {money(order.total)}</b>
            </p>
          </div>
          <p className="muted">
            Личные данные не сохраняются после закрытия окна.
          </p>
          <button className="button full" onClick={close}>
            Спасибо, всё понятно
          </button>
        </Dialog>
      )}
    </>
  );
}
