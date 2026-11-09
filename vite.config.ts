import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "demo-api",
              test: /node_modules\/(msw|@mswjs|@open-draft|@bundled-es-modules|@inquirer|graphql|headers-polyfill|is-node-process|outvariant|strict-event-emitter|until-async|yargs)/,
            },
            {
              name: "react",
              test: /node_modules\/(react|react-dom|scheduler)\//,
            },
          ],
        },
      },
    },
  },
});
