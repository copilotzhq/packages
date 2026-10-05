/** Disposable real-component Chromium fixture; not live backend/device acceptance. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = resolve(".tmp/mobile-browser");
await mkdir(output, { recursive: true });
await build({ entryPoints: ["copilotz-chat-ui/tests/fixtures/mobile-space-ux.jsx"], bundle: true, outfile: `${output}/fixture.js`, platform: "browser", format: "iife", jsx: "automatic" });
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>html,body,#root{height:100%;margin:0}body{overflow:hidden}#root{display:flex;min-width:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://fixture").pathname;
    const file = pathname === "/fixture.js" ? `${output}/fixture.js` : pathname === "/styles.css" ? resolve("copilotz-chat-ui/dist/styles.css") : null;
    response.setHeader("Content-Type", pathname.endsWith(".js") ? "application/javascript" : pathname.endsWith(".css") ? "text/css" : "text/html");
    response.end(file ? await readFile(file) : html);
  } catch (error) { response.statusCode = 500; response.end(String(error)); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
const checks = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const center = async (locator) => {
  const box = await locator.boundingBox();
  assert.ok(box, "target has geometry");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    const handle = page.locator('[data-touch-drag-handle="thread-0"]');
    await handle.waitFor({ state: "visible" });
    await delay(350);
    const cdp = await context.newCDPSession(page);
    const touch = (type, point) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
    const row = (id) => page.locator('[data-sidebar="menu-button"]').filter({ has: page.getByText(`Conversation ${id}`, { exact: true }) });
    await row(1).click();
    assert.equal(await page.evaluate(() => window.fixture.selected), "thread-1");
    assert.deepEqual(await page.evaluate(() => window.moves), []);
    const content = page.locator('[data-sidebar="content"]').last();
    const bounds = await content.boundingBox();
    await touch("touchStart", { x: bounds.x + 75, y: bounds.y + bounds.height * 0.75 });
    for (let step = 1; step <= 6; step++) {
      await touch("touchMove", { x: bounds.x + 75, y: bounds.y + bounds.height * 0.75 - step * 25 });
      await delay(30);
    }
    await touch("touchEnd");
    await delay(180);
    assert.ok(await content.evaluate((node) => node.scrollTop) > 20, "ordinary row touch scrolls");
    assert.equal(await page.locator('[data-touch-space-destinations]').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.moves), []);
    await content.evaluate((node) => { node.scrollTop = 0; });
    await row(0).click();
    const start = async () => {
      await content.evaluate((node) => { node.scrollTop = 0; });
      await delay(300);
      const point = await center(handle);
      await touch("touchStart", point);
      await touch("touchMove", { x: point.x - 10, y: point.y + 12 });
      await page.locator('[data-touch-space-destinations]').waitFor({ state: "visible" });
      await delay(80);
    };
    const drop = async (id) => {
      const point = await center(page.locator(`[data-touch-space-target="${id}"]`));
      await touch("touchMove", point);
      await delay(80);
      await touch("touchEnd");
      await delay(180);
    };
    await start();
    assert.equal(await page.locator('[data-touch-space-target="source"]').count(), 0);
    assert.equal(await page.locator('[data-touch-space-target="archived"]').count(), 0);
    const target = page.locator('[data-touch-space-target="space-2"]');
    await touch("touchMove", await center(target));
    await delay(100);
    assert.ok((await target.getAttribute("class")).includes("border-sidebar-ring"));
    assert.ok(await page.locator("[data-touch-space-destinations]").getByText("Release to move to Destination 2", { exact: true }).isVisible());
    await touch("touchEnd");
    await delay(180);
    assert.deepEqual(await page.evaluate(() => window.moves), [{ threadId: "thread-0", spaceId: "space-2" }]);
    assert.equal(await page.evaluate(() => window.fixture.threads[0].spaceId), "space-2");
    assert.equal(await page.evaluate(() => window.fixture.selected), "thread-0");
    assert.equal(await page.evaluate(() => window.fixture.spaceOpened), null);
    assert.equal(await page.getByRole("dialog", { name: "Select Space" }).count(), 0);
    await handle.dispatchEvent("pointerup", { pointerId: await page.evaluate(() => window.lastTouchPointer), pointerType: "touch", clientX: 100, clientY: 400 });
    assert.equal((await page.evaluate(() => window.moves)).length, 1);
    for (const cancellation of ["pointercancel", "outside", "Escape", "blur", "capture"]) {
      console.log(`TEST cancellation ${width}: ${cancellation}`);
      await page.evaluate(() => window.fixture.reset());
      await start();
      if (cancellation === "outside") await touch("touchMove", { x: width - 1, y: 2 });
      else if (cancellation === "Escape") await page.keyboard.press("Escape");
      else if (cancellation === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      else if (cancellation === "capture") await handle.evaluate((node) => node.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: window.lastTouchPointer })));
      if (cancellation === "pointercancel") await touch("touchCancel");
      else await touch("touchEnd");
      await delay(160);
      assert.deepEqual(await page.evaluate(() => window.moves), [], cancellation);
      assert.equal(await page.locator('[data-touch-space-destinations]').count(), 0);
    }
    for (const invalidation of ["removeTarget", "archiveTarget", "changeSource", "disableDrag", "removeSource", "secondPointer", "close"]) {
      console.log(`TEST invalidation ${width}: ${invalidation}`);
      await page.evaluate(() => { window.fixture.reset(); window.fixture.resetSpaces(); window.fixture.enableDrag(); window.fixture.open(); });
      await start();
      await touch("touchMove", await center(page.locator('[data-touch-space-target="space-2"]')));
      if (invalidation === "secondPointer") await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 999, pointerType: "touch" })));
      else await page.evaluate((action) => window.fixture[action](), invalidation);
      await delay(100);
      await touch("touchEnd");
      await delay(150);
      assert.deepEqual(await page.evaluate(() => window.moves), [], invalidation);
      assert.equal(await page.locator('[data-touch-space-destinations]').count(), 0);
    }
    await page.evaluate(() => { window.fixture.reset(); window.fixture.resetSpaces(); window.fixture.enableDrag(); window.fixture.open(); });
    for (const failure of ["false", "throw"]) {
      await page.evaluate((value) => { window.moveFailure = value; window.fixture.reset(); }, failure);
      await start(); await drop("space-2");
      assert.equal(await page.evaluate(() => window.fixture.threads[0].spaceId), "source");
      assert.equal((await page.evaluate(() => window.moves)).length, 1);
      assert.ok(await page.getByRole("alert").innerText());
      assert.equal(await handle.isDisabled(), false);
    }
    await page.evaluate(() => { window.moveFailure = null; window.fixture.reset(); });
    await start();
    const viewport = page.getByLabel("Move conversation destinations");
    const edge = await viewport.boundingBox();
    await touch("touchMove", { x: edge.x + 80, y: edge.y + edge.height - 2 });
    // RAF elapsed is deliberately capped. A slow CI compositor takes longer
    // than a physical display; assert actual movement with a bounded wait.
    await page.waitForFunction(() => document.querySelector('[aria-label="Move conversation destinations"]').scrollTop > 450, null, { timeout: 10000 });
    const down = await viewport.evaluate((node) => node.scrollTop);
    assert.ok(down > 450, "bottom hold scrolls");
    const topEdge = await viewport.boundingBox();
    await touch("touchMove", { x: topEdge.x + 80, y: topEdge.y + 2 });
    await page.waitForFunction((previous) => document.querySelector('[aria-label="Move conversation destinations"]').scrollTop < previous - 30, down, { timeout: 10000 });
    assert.ok(await viewport.evaluate((node) => node.scrollTop) < down, "top hold reverses scroll");
    const bottomEdge = await viewport.boundingBox();
    await touch("touchMove", { x: bottomEdge.x + 80, y: bottomEdge.y + bottomEdge.height - 2 });
    await page.waitForFunction(() => {
      const node = document.querySelector('[aria-label="Move conversation destinations"]');
      return node.scrollTop >= node.scrollHeight - node.clientHeight - 2;
    }, null, { timeout: 10000 });
    const last = await page.locator('[data-touch-space-target="space-30"]').boundingBox();
    const finalViewport = await viewport.boundingBox();
    assert.ok(last.y >= finalViewport.y && last.y + last.height <= finalViewport.y + finalViewport.height + 1, "offscreen target scrolled fully into viewport");
    await drop("space-30");
    assert.deepEqual(await page.evaluate(() => window.moves), [{ threadId: "thread-0", spaceId: "space-30" }]);
    await page.touchscreen.tap(...Object.values(await center(handle)));
    await page.getByRole("dialog", { name: "Select Space" }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await delay(250);
    await handle.focus(); await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Select Space" }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await delay(250);
    await handle.locator('..').locator('[data-sidebar="menu-action"]').click();
    await page.getByRole("menuitem", { name: "Move to Space", exact: true }).click();
    await page.getByRole("dialog", { name: "Select Space" }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${output}/sidebar-${width}.png` });
    assert.deepEqual(errors, []);
    checks.push(`touch-${width}`);
    console.log(`PASS touch ${width}: ordinary tap/scroll, valid/duplicate release, cancellation/invalidation, false/throw retry, edge scroll/offscreen, picker, active conversation/no navigation`);
    await context.close();
  }
  for (const width of [320, 390, 1100]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${url}?mode=nav`);
    const nav = page.getByRole("tablist", { name: "Space sections" });
    const visible = async () => {
      await delay(200);
      const geometry = await nav.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const selected = node.querySelector('[aria-selected="true"]').getBoundingClientRect();
        const control = node.parentElement.querySelector('[data-space-sections-overflow]')?.getBoundingClientRect();
        return { left: box.left, right: box.right, selectedLeft: selected.left, selectedRight: selected.right, controlLeft: control?.left, bodyWidth: document.body.scrollWidth, viewport: innerWidth };
      });
      assert.ok(geometry.selectedLeft >= geometry.left - 1 && geometry.selectedRight <= geometry.right + 1, JSON.stringify(geometry));
      if (geometry.controlLeft !== undefined) assert.ok(geometry.right <= geometry.controlLeft + 1, "strip excludes control");
      assert.ok(geometry.bodyWidth <= geometry.viewport + 1, "no body horizontal overflow");
    };
    await visible();
    const more = page.getByRole("button", { name: "Show more Space sections", exact: true });
    if (await more.isVisible()) {
      const before = await nav.evaluate((node) => node.scrollLeft);
      await more.click(); await delay(500);
      assert.ok(await nav.evaluate((node) => node.scrollLeft) > before, "overflow button scrolls");
    }
    await page.getByRole("tab", { name: "Kanbans", exact: true }).focus();
    for (const key of ["ArrowRight", "End", "Home"]) {
      await page.keyboard.press(key); await visible();
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
    await visible();
    await page.setViewportSize({ width: width - 1, height: 844 }); await visible();
    if (width < 640) assert.ok(await nav.evaluate((node) => parseFloat(getComputedStyle(node.parentElement).paddingBottom)) >= 8);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; window.fixture.compact(); });
    await delay(200);
    assert.equal(await page.locator('[data-space-sections-overflow]').count(), 0, "reservation disappears with short content");
    await page.evaluate(() => window.fixture.expand());
    await visible();
    await page.screenshot({ path: `${output}/nav-${width}.png` });
    assert.deepEqual(errors, []);
    checks.push(`nav-${width}`);
    console.log(`PASS nav ${width}: selected/keyboard, separate overflow control, enlarged text/resize, dynamic content, base safe-area spacing`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1100, height: 844 } });
  const page = await context.newPage();
  await page.goto(url);
  assert.equal(await page.locator('[data-touch-drag-handle="thread-0"]').isVisible(), false);
  await page.getByRole("button", { name: "Spaces", exact: true }).click();
  await page.getByRole("button", { name: "Expand Original Space conversations", exact: true }).click();
  const row = page.locator('[data-sidebar="menu-button"]').filter({ has: page.getByText("Conversation 0", { exact: true }) });
  await row.waitFor({ state: "visible" });
  assert.equal(await row.getAttribute("draggable"), "true");
  await row.dispatchEvent("dragstart");
  const group = page.locator('[data-sidebar="group"]').filter({ has: page.getByText("Destination 2", { exact: true }) });
  await group.dispatchEvent("dragover"); await group.dispatchEvent("drop");
  await delay(180);
  assert.deepEqual(await page.evaluate(() => window.moves), [{ threadId: "thread-0", spaceId: "space-2" }]);
  checks.push("desktop-native-dnd");
  console.log("PASS desktop: hidden handle, native draggable row and one callback");
  await context.close();
  await writeFile(`${output}/receipt.json`, JSON.stringify({ passed: true, browser: browser.version(), checks, boundary: "Disposable React host data, Chromium; not physical devices/live server persistence." }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
