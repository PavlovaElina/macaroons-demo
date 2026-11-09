import { useEffect, useRef, useState } from "react";
import type { CartLine, Product, Selection } from "../types";
import { asset } from "../data/catalog";
import { allFlavors, count, linePrice, money } from "../utils/cart";
import { PACKAGING_PRICES } from "../data/shop";
import { Quantity } from "./Dialog";
export type OrderTab = "boxes" | "singles";
type Props = {
  products: Product[];
  status: "loading" | "ready" | "error";
  cart: CartLine[];
  tab: OrderTab;
  onTab: (tab: OrderTab) => void;
  onRetry: () => void;
  onDetails: (p: Product) => void;
  onSingleChange: (p: Product, n: number) => void;
  onSave: (line: CartLine) => boolean;
  onCancel: () => void;
  initial?: CartLine;
  converting: boolean;
  onConvert: () => void;
  onCart: () => void;
  cartTotal: number;
};
export function OrderSection({
  products,
  status,
  cart,
  tab,
  onTab,
  onRetry,
  onDetails,
  onSingleChange,
  onSave,
  onCancel,
  initial,
  converting,
  onConvert,
  onCart,
  cartTotal,
}: Props) {
  const [capacity, setCapacity] = useState(initial?.capacity ?? 6);
  const [selection, setSelection] = useState<Selection>(
    initial?.selection ?? {},
  );
  const [packaging, setPackaging] = useState<"classic" | "ribbon">(
    initial?.packaging ?? "classic",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [pendingPreset, setPendingPreset] = useState<6 | 12>();
  const [inCatalog, setInCatalog] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) =>
      setInCatalog(entry.isIntersecting),
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setSummaryVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    if (summaryRef.current) observer.observe(summaryRef.current);
    return () => observer.disconnect();
  }, [status, tab]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = count(selection);
  const singles = cart
    .filter((l) => l.kind === "single")
    .reduce((n, l) => n + l.quantity, 0);
  const draft: CartLine = {
    id: initial?.id ?? "draft",
    kind: "box",
    capacity,
    selection,
    packaging,
    note: note.trim(),
    quantity: initial?.quantity ?? 1,
  };
  const singleCount = (id: string) =>
    cart
      .filter((l) => l.kind === "single" && l.selection[id])
      .reduce((n, l) => n + l.quantity, 0);
  function changeFlavor(id: string, n: number) {
    setSelection((prev) => {
      const next = { ...prev };
      if (n) next[id] = n;
      else delete next[id];
      return next;
    });
    setError("");
  }
  function applyPreset(size: 6 | 12) {
    setCapacity(size);
    setSelection(allFlavors(products, size));
    setError("");
    setPendingPreset(undefined);
  }
  function choosePreset(size: 6 | 12) {
    if (chosen > 0) {
      setPendingPreset(size);
      return;
    }
    applyPreset(size);
  }
  function reset() {
    setSelection({});
    setNote("");
    setError("");
    setPendingPreset(undefined);
    onCancel();
  }
  function save() {
    if (chosen !== capacity) return;
    if (onSave(draft)) {
      setSelection({});
      setNote("");
      setError("");
      setPendingPreset(undefined);
    }
  }
  return (
    <section
      ref={sectionRef}
      id="catalog"
      className="section catalog order-section"
    >
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Выбор в одном месте</p>
            <h2 id="builder-title" tabIndex={-1}>
              Ваши любимые макаруны
            </h2>
          </div>
          <p>
            Соберите коробочку в подарок или выберите несколько штук к кофе.
          </p>
        </div>
        <div className="order-tabs" role="tablist" aria-label="Формат заказа">
          {(["boxes", "singles"] as const).map((value, i) => (
            <button
              key={value}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`tab-${value}`}
              role="tab"
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => onTab(value)}
              onKeyDown={(e) => {
                let next: number;
                if (e.key === "ArrowRight" || e.key === "ArrowLeft")
                  next = 1 - i;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = 1;
                else return;
                e.preventDefault();
                onTab(next === 0 ? "boxes" : "singles");
                tabs.current[next]?.focus();
              }}
            >
              <span>{value === "boxes" ? "Коробочки" : "Поштучно"}</span>
              <small>
                {value === "boxes"
                  ? "6 или 12 штук · для себя и в подарок"
                  : "От 1 штуки · доставка от 6 или с коробкой"}
              </small>
            </button>
          ))}
        </div>
        {status === "loading" ? (
          <div
            className="products-grid"
            role="status"
            aria-label="Загрузка каталога"
            aria-busy="true"
          >
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" />
            ))}
            <span className="sr-only">Загружаем вкусы…</span>
          </div>
        ) : status === "error" ? (
          <div className="empty-state" role="alert">
            <h3>Не удалось загрузить вкусы</h3>
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button className="button" onClick={onRetry}>
              Повторить загрузку
            </button>
          </div>
        ) : !products.length ? (
          <div className="empty-state">
            <h3>Витрина пока пуста</h3>
            <p>Попробуйте заглянуть позже.</p>
          </div>
        ) : (
          <>
            <div
              id="panel-boxes"
              role="tabpanel"
              aria-labelledby="tab-boxes"
              hidden={tab !== "boxes"}
              tabIndex={0}
            >
              <div className="ready-sets">
                <div className="ready-sets-heading">
                  <h3>Готовые наборы «Все вкусы»</h3>
                  <p>
                    Соберите за одно нажатие, а затем измените состав по
                    желанию.
                  </p>
                </div>
                <div className="ready-sets-options">
                  {([6, 12] as const).map((size) => (
                    <button
                      type="button"
                      className="ready-set-button"
                      key={size}
                      onClick={() => choosePreset(size)}
                    >
                      <span className="preset-dots" aria-hidden="true">
                        {products.map((p) => (
                          <i key={p.id} style={{ background: p.color }} />
                        ))}
                      </span>
                      <span>
                        <b>Все вкусы · {size} шт.</b>
                        <small>
                          {size === 6
                            ? "Малина и манго — по 2, ваниль и фисташка — по 1"
                            : "По 3 макаруна каждого вкуса"}
                        </small>
                      </span>
                      <strong>
                        {money(
                          linePrice(
                            {
                              ...draft,
                              capacity: size,
                              selection: allFlavors(products, size),
                            },
                            products,
                          ),
                        )}
                      </strong>
                    </button>
                  ))}
                </div>
                {pendingPreset && (
                  <div
                    className="preset-confirm"
                    role="group"
                    aria-label="Замена состава"
                  >
                    <p>
                      Заменить текущий состав набором «Все вкусы» на{" "}
                      {pendingPreset} штук? Упаковка и открытка сохранятся.
                    </p>
                    <div>
                      <button
                        className="small-button"
                        onClick={() => applyPreset(pendingPreset)}
                      >
                        Заменить состав
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setPendingPreset(undefined)}
                      >
                        Оставить мой выбор
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="order-context">
                <div>
                  <h3>
                    {initial && !converting
                      ? "Редактируем коробочку"
                      : "Соберите свою коробочку"}
                  </h3>
                  <p>
                    {converting
                      ? "Перенесли до 12 выбранных макарунов. Поштучные позиции заменятся коробкой только после сохранения; остальные останутся в корзине."
                      : "Выберите размер и вкусы. Упаковка включена в итог; открытка — бесплатно."}
                  </p>
                </div>
                <div
                  className="segmented"
                  role="group"
                  aria-label="Размер коробки"
                >
                  {[6, 12].map((n) => (
                    <button
                      key={n}
                      aria-pressed={capacity === n}
                      onClick={() => {
                        if (chosen > n) {
                          setError(
                            `Сначала уберите ${chosen - n} шт., чтобы перейти на коробку ${n}.`,
                          );
                          return;
                        }
                        setCapacity(n);
                        setError("");
                      }}
                    >
                      {n} макарунов
                    </button>
                  ))}
                </div>
              </div>
              <div className="order-layout">
                <div>
                  <div className="products-grid box-products">
                    {products.map((p, i) => (
                      <article
                        className={`product-card ${selection[p.id] ? "is-selected" : ""}`}
                        key={p.id}
                      >
                        <div
                          className="product-visual"
                          style={{ background: p.color }}
                        >
                          <span className="product-index">0{i + 1}</span>
                          <button
                            className="product-image-button"
                            aria-label={`Подробнее: ${p.name}`}
                            onClick={() => onDetails(p)}
                          >
                            <img
                              src={asset(p.image)}
                              alt={`Макарун со вкусом ${p.name.toLowerCase()}`}
                              width="195"
                              height="124"
                              loading="lazy"
                            />
                          </button>
                          <span className="flavor-tag">
                            {selection[p.id]
                              ? `В коробке: ${selection[p.id]} шт.`
                              : "Выберите количество"}
                          </span>
                        </div>
                        <div className="product-copy">
                          <button
                            className="product-title"
                            onClick={() => onDetails(p)}
                          >
                            <h3>{p.name}</h3>
                            <span aria-hidden="true">↗</span>
                          </button>
                          <p>{p.description}</p>
                          <span className="card-cart-count">
                            В коробках в корзине:{" "}
                            {cart
                              .filter((l) => l.kind === "box")
                              .reduce(
                                (n, l) =>
                                  n + (l.selection[p.id] ?? 0) * l.quantity,
                                0,
                              )}{" "}
                            шт.
                          </span>
                          <div className="product-bottom">
                            <span>
                              <b>{money(p.price)}</b>
                              <small>за 1 штуку</small>
                            </span>
                            <Quantity
                              label={p.name}
                              value={selection[p.id] ?? 0}
                              max={(selection[p.id] ?? 0) + capacity - chosen}
                              onChange={(n) => changeFlavor(p.id, n)}
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="catalog-note">
                    Содержит орехи, яйца и молочные продукты.
                  </p>
                </div>
                <aside
                  ref={summaryRef}
                  id="box-summary"
                  className="box-summary"
                  aria-label="Ваша коробочка"
                >
                  <div className="box-topline">
                    <h3>Ваша коробочка</h3>
                    <span>
                      {chosen} / {capacity}
                    </span>
                  </div>
                  <div
                    className="box-tray"
                    role="group"
                    aria-label={`В коробке ${chosen} из ${capacity}`}
                  >
                    {Array.from({ length: capacity }, (_, i) => {
                      const ids = Object.entries(selection).flatMap(([id, n]) =>
                        Array<string>(n).fill(id),
                      );
                      const p = products.find((p) => p.id === ids[i]);
                      return (
                        <div
                          className={p ? "box-slot filled" : "box-slot"}
                          key={i}
                        >
                          {p ? (
                            <img
                              src={asset(p.image)}
                              alt={p.name}
                              width="120"
                              height="80"
                            />
                          ) : (
                            <span aria-hidden="true">✦</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Заполненность коробки"
                    aria-valuenow={chosen}
                    aria-valuemin={0}
                    aria-valuemax={capacity}
                  >
                    <span style={{ width: `${(chosen / capacity) * 100}%` }} />
                  </div>
                  <p className="remaining" aria-live="polite">
                    {chosen === capacity
                      ? "Готово! Коробочка собрана."
                      : `Осталось выбрать ${capacity - chosen} шт.`}
                  </p>
                  <label className="ribbon-option">
                    <input
                      type="checkbox"
                      checked={packaging === "ribbon"}
                      onChange={(e) =>
                        setPackaging(e.target.checked ? "ribbon" : "classic")
                      }
                    />
                    Праздничная лента{" "}
                    <span>
                      +
                      {money(
                        PACKAGING_PRICES.ribbon - PACKAGING_PRICES.classic,
                      )}
                    </span>
                  </label>
                  <label className="note-label" htmlFor="gift-note">
                    Текст открытки <span className="muted">— бесплатно</span>
                    <textarea
                      id="gift-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={200}
                      placeholder="Пара тёплых слов…"
                    />
                  </label>
                  <div className="builder-total">
                    <span>
                      За коробочку
                      <small>
                        В том числе упаковка{" "}
                        {money(PACKAGING_PRICES[packaging])}
                      </small>
                    </span>
                    <b>{money(linePrice(draft, products))}</b>
                  </div>
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="button full"
                    disabled={chosen !== capacity}
                    onClick={save}
                  >
                    {initial && !converting
                      ? "Сохранить изменения"
                      : "Добавить коробочку"}{" "}
                    <span>↗</span>
                  </button>
                  <button className="text-button reset-button" onClick={reset}>
                    {initial ? "Отменить редактирование" : "Очистить выбор"}
                  </button>
                  {initial && initial.quantity > 1 && (
                    <p className="muted">
                      Изменения применятся ко всем {initial.quantity} коробкам
                      этой позиции.
                    </p>
                  )}
                  <p className="summary-note">
                    Открытка не сохраняется после перезагрузки.
                  </p>
                </aside>
              </div>
            </div>
            <div
              id="panel-singles"
              role="tabpanel"
              aria-labelledby="tab-singles"
              hidden={tab !== "singles"}
              tabIndex={0}
            >
              <div className="order-context">
                <div>
                  <h3>Пара макарунов — тоже повод для радости</h3>
                  <p>
                    Добавляйте к коробочке или закажите отдельно. Доставка — от
                    коробки или 6 штук; меньше — только самовывоз.
                  </p>
                </div>
              </div>
              <div className="products-grid">
                {products.map((p, i) => {
                  const quantity = singleCount(p.id);
                  return (
                    <article
                      key={p.id}
                      className={`product-card ${quantity ? "is-selected" : ""}`}
                    >
                      <div
                        className="product-visual"
                        style={{ background: p.color }}
                      >
                        <span className="product-index">0{i + 1}</span>
                        <button
                          className="product-image-button"
                          aria-label={`Подробнее: ${p.name}`}
                          onClick={() => onDetails(p)}
                        >
                          <img
                            src={asset(p.image)}
                            alt={`Макарун со вкусом ${p.name.toLowerCase()}`}
                            width="195"
                            height="124"
                            loading="lazy"
                          />
                        </button>
                        <span className="flavor-tag">
                          {quantity ? `В корзине: ${quantity} шт.` : "Поштучно"}
                        </span>
                      </div>
                      <div className="product-copy">
                        <button
                          className="product-title"
                          onClick={() => onDetails(p)}
                        >
                          <h3>{p.name}</h3>
                          <span aria-hidden="true">↗</span>
                        </button>
                        <p>{p.description}</p>
                        <div className="product-bottom">
                          <span>
                            <b>{money(p.price)}</b>
                            <small>за 1 штуку</small>
                          </span>
                          {quantity ? (
                            <Quantity
                              label={`В корзине: ${p.name}`}
                              value={quantity}
                              onChange={(n) => onSingleChange(p, n)}
                            />
                          ) : (
                            <button
                              className="small-button"
                              aria-label={`В корзину +: ${p.name}`}
                              onClick={() => onSingleChange(p, 1)}
                            >
                              В корзину <span>+</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="singles-summary">
                <div>
                  <b>
                    {singles
                      ? `Поштучно в корзине: ${singles} шт.`
                      : "Выберите любимые вкусы"}
                  </b>
                  <p>
                    {singles >= 6
                      ? "Уже хватит на коробочку. Перенесём выбранные вкусы в удобную упаковку?"
                      : "Счётчики показывают отдельные макаруны; состав коробок учитывается отдельно."}
                  </p>
                </div>
                {singles >= 6 && (
                  <button className="button secondary" onClick={onConvert}>
                    Перенести в коробку
                  </button>
                )}
                <button className="button" onClick={onCart}>
                  Открыть корзину
                </button>
              </div>
            </div>
          </>
        )}
        {cart.length > 0 && (
          <div className="order-cart-strip">
            <div>
              <b>В корзине: {money(cartTotal)}</b>
              <p>
                {cart
                  .filter((l) => l.kind === "box")
                  .reduce((n, l) => n + l.quantity, 0)}{" "}
                коробок · {singles} макарунов поштучно
              </p>
            </div>
            <button className="button" onClick={onCart}>
              Перейти в корзину ↗
            </button>
          </div>
        )}
        {tab === "boxes" &&
          chosen > 0 &&
          inCatalog &&
          !summaryVisible &&
          status === "ready" &&
          products.length > 0 && (
            <button
              className="mobile-box-progress"
              onClick={() => {
                summaryRef.current?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                  block: "start",
                });
              }}
              aria-label="Перейти к итогам коробочки"
            >
              <span>
                {chosen} / {capacity} шт. · {money(linePrice(draft, products))}
              </span>
              <b>{chosen === capacity ? "Добавить →" : "К коробочке →"}</b>
            </button>
          )}
      </div>
    </section>
  );
}
