import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { worker } from "./mocks/browser";
import "./styles.css";
worker
  .start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: "bypass",
    quiet: true,
  })
  .then(() =>
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch(() => {
    document.getElementById("root")!.innerHTML =
      '<main style="padding:40px;font-family:sans-serif"><h1>Не удалось загрузить сайт</h1><p>Откройте сайт через localhost или HTTPS и обновите страницу. Для загрузки каталога требуется Service Worker.</p><button onclick="location.reload()">Повторить</button></main>';
  });
