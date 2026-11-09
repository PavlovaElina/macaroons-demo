#!/bin/zsh
set -e
cd "${0:A:h}/.."
if [[ -x "$PWD/.tools/node/bin/node" ]]; then
  export PATH="$PWD/.tools/node/bin:$PATH"
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Для запуска нужны Node.js 24 или новее и npm: https://nodejs.org/'
  read -r '?Нажмите Enter, чтобы закрыть окно.'
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
npm run dev -- --strictPort --open
