/** Disposable real-Sheet regression. Run after chat-ui build with PLAYWRIGHT_MODULE if needed. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = resolve(".tmp/sheet-layering");
await mkdir(output, { recursive: true });
await build({ entryPoints: ["copilotz-chat-ui/tests/fixtures/sheet-layering.jsx"], bundle: true, outfile: `${output}/fixture.js`, platform: "browser", format: "iife", jsx: "automatic" });
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://fixture").pathname;
    const file = pathname === "/fixture.js" ? `${output}/fixture.js` : pathname === "/styles.css" ? resolve("copilotz-chat-ui/dist/styles.css") : null;
    response.setHeader("Content-Type", pathname.endsWith(".js") ? "application/javascript" : pathname.endsWith(".css") ? "text/css" : "text/html");
    response.end(file ? await readFile(file) : html);
  } catch (error) { response.statusCode = 500; response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 390, 1100]) for (const side of ["left", "right"]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}?side=${side}`);
    const sheet = page.locator('[data-slot="sheet-content"]');
    const ready = () => page.waitForFunction(() => {
      const sheet = document.querySelector('[data-slot="sheet-content"]');
      const inside = document.getElementById("inside");
      if (!sheet || sheet.dataset.state !== "open" || sheet.getAnimations().some(a => a.playState === "running") || !inside) return false;
      const r = inside.getBoundingClientRect();
      return !!r.width && !!r.height && inside.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }, null, { timeout: 10000 });
    const layering = async () => {
      await ready();
      const state = await sheet.evaluate(node => ({content: Number(getComputedStyle(node).zIndex), overlay: Number(getComputedStyle(document.querySelector('[data-slot="sheet-overlay"]')).zIndex)}));
      assert.ok(state.content > state.overlay, JSON.stringify(state));
    };
    await page.getByRole("button", { name: "Open Sheet", exact: true }).click(); await layering();
    assert.equal(await page.getByRole("dialog", { name: "Layer regression" }).count(), 1);
    for (let n = 0; n < 3; n++) {
      await page.evaluate(() => window.sheetFixture.close());
      // Reopen before the Content exit finishes, as in the full invalidation sequence.
      await page.waitForTimeout(250);
      await page.evaluate(() => window.sheetFixture.open()); await layering();
      await page.locator("#inside").click();
      assert.equal(await page.evaluate(() => window.sheetFixture.insideCount), n + 1);
    }
    for (let n = 0; n < 6; n++) {
      await page.keyboard.press("Tab");
      assert.ok(await sheet.evaluate(node => node.contains(document.activeElement)), "focus stays inside modal Sheet");
    }
    await page.getByRole("button", { name: "Open nested dialog", exact: true }).click();
    const nested = page.getByRole("dialog", { name: "Nested regression" });
    await nested.waitFor({ state: "visible" });
    await page.locator("#nested-action").click();
    assert.ok(await nested.evaluate(node => node.contains(document.activeElement)), "nested dialog stays actionable above Sheet");
    await page.keyboard.press("Escape"); await nested.waitFor({ state: "hidden" }); await layering();
    const x = side === "left" ? width - 5 : 5;
    assert.equal(await page.evaluate(({x}) => document.elementFromPoint(x, 500)?.dataset.slot, {x}), "sheet-overlay", "outside area remains intercepted by overlay");
    await page.mouse.click(x, 500); await sheet.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => window.sheetFixture.outsideCount), 0, "outside click never reaches underlying action");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "trigger", "closing returns focus to trigger");
    await page.locator("#trigger").click(); await layering();
    await page.keyboard.press("Escape"); await sheet.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.id), "trigger");
    assert.deepEqual(errors, []);
    console.log(`PASS Sheet ${width}/${side}: rapid reopen, stacking, inside action, outside interception, focus trap/return, nested dialog, Escape`);
    await context.close();
  }
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
