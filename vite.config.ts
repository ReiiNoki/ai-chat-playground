import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const ICON_SIZES = [16, 32, 48, 128, 512] as const;

function extensionAssetsPlugin(): Plugin {
  return {
    name: "emit-extension-assets",
    buildStart() {
      for (const fileName of ["manifest.json", "PRIVACY.md", "THIRD_PARTY_NOTICES.md"]) {
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(resolve(__dirname, fileName), "utf8"),
        });
      }

      for (const size of ICON_SIZES) {
        this.emitFile({
          type: "asset",
          fileName: `icons/icon-${size}.png`,
          source: readFileSync(resolve(__dirname, `src/assets/icons/icon-${size}.png`)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [extensionAssetsPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "sidepanel.html"),
        background: resolve(__dirname, "src/entries/background.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
