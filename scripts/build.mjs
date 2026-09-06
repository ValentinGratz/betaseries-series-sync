import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const DIST = "dist";

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Background service worker: MV3 allows `"type": "module"`, so we can
  // keep it as an ES module (smaller output, native dynamic import support).
  await build({
    entryPoints: ["src/background/service-worker.ts"],
    outfile: `${DIST}/src/background/service-worker.js`,
    bundle: true,
    format: "esm",
    target: "chrome110",
    sourcemap: true,
  });

  // Content scripts declared in manifest.json are classic (non-module)
  // scripts, so they must be self-contained IIFEs.
  const contentScripts = ["tf1plus", "m6plus", "francetv"];
  for (const platform of contentScripts) {
    await build({
      entryPoints: [`src/content/${platform}/content-script.ts`],
      outfile: `${DIST}/src/content/${platform}/content-script.js`,
      bundle: true,
      format: "iife",
      target: "chrome110",
      sourcemap: true,
    });
  }

  // Popup and options pages load their script as a classic <script> tag too.
  await build({
    entryPoints: ["popup/popup.ts"],
    outfile: `${DIST}/popup/popup.js`,
    bundle: true,
    format: "iife",
    target: "chrome110",
    sourcemap: true,
  });
  await build({
    entryPoints: ["options/options.ts"],
    outfile: `${DIST}/options/options.js`,
    bundle: true,
    format: "iife",
    target: "chrome110",
    sourcemap: true,
  });

  // Static assets.
  await cp("manifest.json", `${DIST}/manifest.json`);
  await cp("popup/popup.html", `${DIST}/popup/popup.html`);
  await cp("popup/popup.css", `${DIST}/popup/popup.css`);
  await cp("options/options.html", `${DIST}/options/options.html`);
  await cp("options/options.css", `${DIST}/options/options.css`);
  if (existsSync("icons")) {
    await cp("icons", `${DIST}/icons`, { recursive: true });
  }

  console.log("Build complete: dist/ is ready to load as an unpacked extension.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
