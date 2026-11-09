import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Малина", exact: true }),
  ).toBeVisible();
}
async function fillBox(page: Page, flavor = "Малина", n = 6) {
  for (let i = 0; i < n; i++)
    await page
      .getByRole("button", { name: `Увеличить: ${flavor}`, exact: true })
      .click();
}
async function singles(page: Page) {
  await page.getByRole("tab", { name: /Поштучно/ }).click();
}
async function openCart(page: Page) {
  await page.getByRole("button", { name: /^Корзина/ }).click();
}
async function form(page: Page) {
  await page.getByRole("button", { name: "К оформлению" }).click();
  await page.getByLabel("Ваше имя").fill("Анна");
  await page.getByLabel("Телефон", { exact: true }).fill("89991234567");
}

test("box purchase, Russian currency, phone and checkout", async ({ page }) => {
  await ready(page);
  await expect(page.getByRole("tab", { name: /Коробочки/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await fillBox(page);
  await page.getByLabel("Текст открытки").fill("Для тебя!");
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await expect(
    page.getByRole("heading", { name: "Коробка на 6 макарунов" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("780 ₽", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "К оформлению" }).click();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByText("Введите имя — минимум 2 символа."),
  ).toBeVisible();
  await page.getByLabel("Ваше имя").fill("Анна");
  await page.getByLabel("Телефон", { exact: true }).fill("89991234567");
  await expect(page.getByLabel("Телефон", { exact: true })).toHaveValue(
    "+7 (999) 123-45-67",
  );
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Коробочка радости готова!" }),
  ).toBeVisible();
  await expect(page.getByText(/MC-/)).toBeVisible();
  await page.getByRole("button", { name: "Спасибо, всё понятно" }).click();
  await openCart(page);
  await expect(page.getByText("Здесь пока тихо и несладко")).toBeVisible();
});
test("single card counters sync with basket, zero restores add button, saved values return", async ({
  page,
}) => {
  await ready(page);
  await singles(page);
  await page
    .getByRole("button", { name: "В корзину +: Манго", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Увеличить: В корзине: Манго", exact: true })
    .click();
  await expect(
    page.getByText("В корзине: 2 шт.", { exact: true }),
  ).toBeVisible();
  await openCart(page);
  await page
    .getByRole("button", { name: "Увеличить: Макарун «Манго»" })
    .click();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await expect(
    page.getByText("В корзине: 3 шт.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await singles(page);
  await expect(
    page.getByText("В корзине: 3 шт.", { exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Уменьшить: В корзине: Манго", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "В корзину +: Манго" }),
  ).toBeVisible();
});
test("delivery unavailable for five, available at six and API enforces threshold", async ({
  page,
}) => {
  await ready(page);
  await singles(page);
  await page.getByRole("button", { name: "В корзину +: Манго" }).click();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Увеличить: В корзине: Манго" })
      .click();
  await openCart(page);
  await form(page);
  await expect(
    page.getByRole("button", { name: "Доставка", exact: true }),
  ).toBeDisabled();
  const rejected = await page.evaluate(async () => {
    const raw = JSON.parse(localStorage.getItem("macaroons-cart-v1")!);
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return (
      await fetch("./api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: raw.lines,
          checkout: {
            name: "Анна",
            phone: "79991234567",
            method: "delivery",
            address: "Учебная улица, 10",
            date: day,
            interval: "10:00–13:00",
            comment: "",
          },
        }),
      })
    ).status;
  });
  expect(rejected).toBe(400);
  await page.getByRole("button", { name: "К корзине" }).click();
  await page
    .getByRole("button", { name: "Увеличить: Макарун «Манго»" })
    .click();
  await page.getByRole("button", { name: "К оформлению" }).click();
  await expect(
    page.getByRole("button", { name: "Доставка", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Доставка", exact: true }).click();
  await page.getByLabel("Адрес в городе Москва").fill("Учебная улица, дом 10");
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(page.getByText("Итого: 1 070 ₽")).toBeVisible();
});
test("converting individual items is reversible and creates a single box without duplicates", async ({
  page,
}) => {
  await ready(page);
  await singles(page);
  await page.getByRole("button", { name: "В корзину +: Малина" }).click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Увеличить: В корзине: Малина" })
      .click();
  await page
    .getByRole("button", { name: "Перенести в коробку", exact: true })
    .click();
  await expect(page.getByText("Готово! Коробочка собрана.")).toBeVisible();
  await page.getByRole("button", { name: "Отменить редактирование" }).click();
  await singles(page);
  await expect(
    page.getByText("В корзине: 6 шт.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Перенести в коробку", exact: true })
    .click();
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await expect(
    page.getByRole("heading", { name: "Коробка на 6 макарунов" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Макарун «Малина»" }),
  ).toHaveCount(0);
});
test("box drafts survive tabs, editing saves and private note does not persist", async ({
  page,
}) => {
  await ready(page);
  await fillBox(page);
  await singles(page);
  await page.getByRole("tab", { name: /Коробочки/ }).click();
  await expect(page.getByText("Готово! Коробочка собрана.")).toBeVisible();
  await page.getByLabel("Текст открытки").fill("Секрет");
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await page.getByRole("button", { name: "Изменить состав" }).click();
  await expect(page.getByLabel("Текст открытки")).toHaveValue("Секрет");
  await page
    .getByRole("button", { name: "Уменьшить: Малина", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Увеличить: Манго", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.reload();
  await openCart(page);
  await expect(page.getByText("Малина × 5 · Манго × 1")).toBeVisible();
  await expect(page.getByText("Секрет")).toHaveCount(0);
});
test("twelve-piece box limits, checkout accessibility and reduced motion", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "12 макарунов", exact: true }).click();
  await fillBox(page, "Фисташка", 12);
  await expect(
    page.getByRole("button", { name: "Увеличить: Фисташка", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "6 макарунов", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Сначала уберите 6 шт.");
  await page.getByLabel("Праздничная лента").check();
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await expect(
    page.getByRole("dialog").getByText("1 780 ₽", { exact: true }).first(),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "К оформлению" }).click();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".hero-ring")
      .evaluate((el) => getComputedStyle(el, "::before").animationName),
  ).toBe("none");
});
test("errors and empty catalog preserve cart, submission errors preserve form", async ({
  page,
}) => {
  await page.goto("/?tools=1");
  await expect(
    page.getByRole("heading", { name: "Малина", exact: true }),
  ).toBeVisible();
  await singles(page);
  await page.getByRole("button", { name: "В корзину +: Ваниль" }).click();
  await page
    .getByLabel("Демонстрация состояний API")
    .selectOption("catalog-error");
  await expect(page.getByText("Не удалось загрузить вкусы")).toBeVisible();
  await page.getByLabel("Демонстрация состояний API").selectOption("empty");
  await expect(page.getByText("Витрина пока пуста")).toBeVisible();
  await openCart(page);
  await expect(
    page.getByRole("dialog").getByText("120 ₽", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "К оформлению" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page
    .getByLabel("Демонстрация состояний API")
    .selectOption("order-error");
  await expect(
    page.getByRole("heading", { name: "Ваниль", exact: true }),
  ).toBeVisible();
  await openCart(page);
  await form(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(page.getByRole("alert")).toContainText("Данные сохранены");
  await expect(page.getByLabel("Ваше имя")).toHaveValue("Анна");
});
test("tabs keyboard, mobile menu, page accessibility and card hover", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: /Коробочки/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Поштучно/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /Поштучно/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: /Коробочки/ })).toBeFocused();
  if (isMobile) {
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Открыть меню" }),
    ).toBeFocused();
  } else {
    const card = page.locator("#panel-boxes .product-card").first();
    await card.locator(".product-copy>p").hover();
    await page.waitForTimeout(400);
    expect(
      await card.evaluate((el) => getComputedStyle(el).transform),
    ).not.toBe("none");
    expect(
      await card
        .locator("img")
        .evaluate((el) => getComputedStyle(el).transform),
    ).not.toBe("none");
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await singles(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await openCart(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Корзина/ })).toBeFocused();
});

test("ready sets fill all flavors, protect an existing draft and preserve personalization", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: /^Все вкусы · 6 шт\./ }).click();
  await expect(page.getByText("Готово! Коробочка собрана.")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "В коробке 6 из 6" }).getByRole("img"),
  ).toHaveCount(6);
  await page.getByLabel("Текст открытки").fill("Для тебя");
  await page.getByLabel("Праздничная лента").check();
  await page.getByRole("button", { name: /^Все вкусы · 12 шт\./ }).click();
  await expect(
    page.getByRole("group", { name: "Замена состава" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Оставить мой выбор" }).click();
  await expect(
    page.getByRole("button", { name: "6 макарунов", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Все вкусы · 12 шт\./ }).click();
  await page.getByRole("button", { name: "Заменить состав" }).click();
  await expect(page.getByLabel("Текст открытки")).toHaveValue("Для тебя");
  await expect(page.getByLabel("Праздничная лента")).toBeChecked();
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await expect(
    page.getByText("Малина × 3 · Манго × 3 · Ваниль × 3 · Фисташка × 3"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("1 600 ₽", { exact: true }).first(),
  ).toBeVisible();
});
test("accidental box removal can be undone from an empty basket with all details", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: /^Все вкусы · 6 шт\./ }).click();
  await page.getByLabel("Текст открытки").fill("Секретная открытка");
  await page.getByLabel("Праздничная лента").check();
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await page
    .getByRole("button", { name: "Увеличить: Коробка на 6 макарунов" })
    .click();
  await page
    .getByRole("button", { name: "Удалить: Коробка на 6 макарунов" })
    .click();
  await expect(page.getByText("Здесь пока тихо и несладко")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Вернуть: Коробка на 6 макарунов" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Вернуть: Коробка на 6 макарунов" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Коробка на 6 макарунов" }),
  ).toBeVisible();
  await expect(
    page.getByText("С лентой · Открытка: Секретная открытка"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("1 680 ₽", { exact: true }).first(),
  ).toBeVisible();
});
test("undo from zero counter preserves later additions and several deletions are independent", async ({
  page,
}) => {
  await ready(page);
  await singles(page);
  await page.getByRole("button", { name: "В корзину +: Манго" }).click();
  await page
    .getByRole("button", { name: "Увеличить: В корзине: Манго" })
    .click();
  await openCart(page);
  await page.getByRole("button", { name: "Удалить: Макарун «Манго»" }).click();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.getByRole("button", { name: "В корзину +: Манго" }).click();
  await page.getByRole("button", { name: "Вернуть: Макарун «Манго»" }).click();
  await expect(
    page.getByText("В корзине: 3 шт.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "В корзину +: Малина" }).click();
  await openCart(page);
  await page.getByRole("button", { name: "Удалить: Макарун «Манго»" }).click();
  await page.getByRole("button", { name: "Удалить: Макарун «Малина»" }).click();
  await page.getByRole("button", { name: "Вернуть: Макарун «Манго»" }).click();
  await page.getByRole("button", { name: "Вернуть: Макарун «Малина»" }).click();
  await expect(
    page.getByRole("heading", { name: "Макарун «Манго»" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Макарун «Малина»" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Уменьшить: Макарун «Малина»" })
    .click();
  await page.getByRole("button", { name: "Вернуть: Макарун «Малина»" }).click();
  await expect(
    page.getByRole("heading", { name: "Макарун «Малина»" }),
  ).toBeVisible();
});
test("light header, centered SVG controls and only one project notice", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  expect(
    await page
      .locator(".site-header")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(247, 233, 229)");
  const content = await page.locator("body").innerText();
  expect(content.match(/учебн/gi)).toHaveLength(1);
  await expect(page.getByLabel("Демонстрация состояний API")).toHaveCount(0);
  expect(
    await page
      .locator(".hero-ring")
      .evaluate((el) => getComputedStyle(el, "::before").borderTopWidth),
  ).toBe("2px");
  const aligned = async () =>
    expect(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
          .filter(
            (b) =>
              b.querySelector(":scope > .ui-icon") &&
              b.getBoundingClientRect().width > 0,
          )
          .every((b) => {
            const r = b.getBoundingClientRect(),
              s = b.querySelector(".ui-icon")!.getBoundingClientRect();
            return (
              Math.abs((r.left + r.right - s.left - s.right) / 2) < 1 &&
              Math.abs((r.top + r.bottom - s.top - s.bottom) / 2) < 1
            );
          }),
      ),
    ).toBe(true);
  await aligned();
  await page.getByRole("button", { name: /^Все вкусы · 6 шт\./ }).click();
  await page.getByRole("button", { name: "Добавить коробочку" }).click();
  await openCart(page);
  await aligned();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  if (isMobile) {
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await aligned();
    await expect(page.getByRole("dialog", { name: "Меню" })).toBeVisible();
    await page.getByRole("button", { name: "Закрыть меню" }).click();
  }
  await page.getByRole("button", { name: "Подробнее: Малина" }).click();
  await expect(
    page.getByRole("heading", { name: "Состав", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText(
    /учебн|демонстрацион|вымышленн/i,
  );
});

test("malformed order requests return 400 without crashing the mock service", async ({
  page,
}) => {
  await ready(page);
  const statuses = await page.evaluate(async () => {
    const payloads = [
      "{broken",
      "null",
      "[]",
      '{"lines":3,"checkout":{}}',
      '{"lines":[null],"checkout":{}}',
    ];
    const results = [];
    for (const body of payloads) {
      const response = await fetch("./api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      results.push(response.status);
    }
    return results;
  });
  expect(statuses).toEqual([400, 400, 400, 400, 400]);
});
