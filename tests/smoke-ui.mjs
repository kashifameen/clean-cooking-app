import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
  }[ext] || "application/octet-stream";
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const filePath = path.normalize(path.join(root, rel));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "content-type": contentType(filePath), "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function clickControl(page, selector) {
  const handle = await page.waitForSelector(selector, { timeout: 10000 });
  await page.evaluate((el) => {
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const scrollsX = /(auto|scroll)/.test(style.overflowX);
      if (scrollsX) {
        const rect = el.getBoundingClientRect();
        const parent = node.getBoundingClientRect();
        if (rect.left < parent.left || rect.right > parent.right) {
          node.scrollLeft += rect.left - parent.left - 12;
        }
      }
      node = node.parentElement;
    }
  }, handle);
  const box = await handle.boundingBox();
  const viewport = page.viewport() || { width: 1280, height: 900 };
  const visible = box && box.x >= 0 && box.y >= 0 && box.x + 8 < viewport.width && box.y + 8 < viewport.height;
  if (!visible) {
    await page.evaluate((el) => el.click(), handle);
    return;
  }
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 40));
}

async function runViewport(page, label) {
  const failures = [];
  page.on("pageerror", (err) => failures.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") failures.push(msg.text());
  });
  await page.goto("http://127.0.0.1:" + page._port + "/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(".recipe-card", { timeout: 20000 });
  const initial = await page.$eval("#results-count", (el) => el.textContent);
  if (!initial.includes("277")) throw new Error(`${label} did not show 277 recipes: ${initial}`);

  await clickControl(page, '.cat-pill-btn[data-cat="Hotpot"]');
  await page.waitForFunction(() => (document.querySelector("#results-count")?.textContent || "").includes("277"));
  const hotpotBadge = await page.$eval(".recipe-card", (el) => el.textContent);
  if (!/Pressure Cooker \/ Hotpot/i.test(hotpotBadge)) {
    throw new Error(`${label} hotpot filter did not show pressure-cooker cards`);
  }
  await clickControl(page, '.cat-pill-btn[data-cat="All"]');

  await page.type("#search-input", "kashmiri");
  await page.waitForFunction(() => document.querySelectorAll(".recipe-card").length === 1);
  const title = await page.$eval(".recipe-card h3", (el) => el.textContent);
  if (!/kashmiri/i.test(title)) throw new Error(`${label} search missed pink tea: ${title}`);

  await clickControl(page, ".recipe-card");
  await page.waitForSelector("#recipe-modal.flex", { timeout: 10000 });
  const baseCals = await page.$eval("#modal-cals", (el) => el.textContent.trim());
  await clickControl(page, '.scale-btn[data-scale="2"]');
  const scaledCals = await page.$eval("#modal-cals", (el) => el.textContent.trim());
  if (Number(scaledCals) !== Number(baseCals) * 2) {
    throw new Error(`${label} scale failed ${baseCals} -> ${scaledCals}`);
  }
  const ingredient = await page.$eval("#modal-ingredients-list", (el) => el.textContent);
  if (!/\d/.test(ingredient)) throw new Error(`${label} ingredients missing`);

  const timerButton = await page.$(".start-timer-btn");
  if (!timerButton) throw new Error(`${label} recipe has no timer`);
  await clickControl(page, ".start-timer-btn");
  await page.waitForSelector(".timer-toggle-btn");
  const remaining = await page.$eval("#modal-instructions-list", (el) => el.textContent);
  if (!/\d+:\d\d/.test(remaining)) throw new Error(`${label} timer did not render: ${remaining}`);

  await clickControl(page, "#tab-btn-instantpot");
  await page.waitForFunction(() => /Liquid \/ Hotpot Broth Requirement/i.test(document.body.innerText));

  await clickControl(page, '.plan-slot-add-btn[data-slot="breakfast"]');
  await clickControl(page, "#modal-add-prep-btn");
  await clickControl(page, "#close-modal-btn");
  await clickControl(page, '.nav-tab-btn[data-tab="planner"]');
  await page.waitForFunction(() => {
    const view = document.querySelector("#view-planner");
    return view && !view.classList.contains("hidden") && /Meal Prep/i.test(view.textContent || "");
  });
  const stored = await page.evaluate(() => ({
    plan: localStorage.getItem("clean_cooking_meal_plan") || "",
    prep: localStorage.getItem("clean_cooking_meal_prep") || "",
  }));
  if (!stored.plan.toLowerCase().includes("kashmiri")) throw new Error(`${label} meal plan did not persist`);
  if (!stored.prep.toLowerCase().includes("kashmiri")) throw new Error(`${label} meal prep did not persist`);

  await page.reload({ waitUntil: "networkidle0" });
  const storedAfter = await page.evaluate(() => localStorage.getItem("clean_cooking_meal_prep") || "");
  if (!storedAfter.toLowerCase().includes("kashmiri")) throw new Error(`${label} meal prep did not survive reload`);

  await clickControl(page, '.nav-tab-btn[data-tab="recipes"]');
  await page.waitForSelector(".fav-btn");
  const favHandle = await page.$(".fav-btn");
  await page.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }), favHandle);
  const favBox = await favHandle.boundingBox();
  const favX = favBox.x + favBox.width / 2;
  const favY = favBox.y + favBox.height / 2;
  await page.mouse.click(favX, favY);
  let favId = await page.evaluate(() => JSON.parse(localStorage.getItem("clean_cooking_favorites") || "[]")[0]);
  if (!favId) {
    favId = await page.evaluate((x, y) => {
      const button = document.elementFromPoint(x, y)?.closest(".fav-btn");
      if (!button) return "";
      button.click();
      return JSON.parse(localStorage.getItem("clean_cooking_favorites") || "[]")[0] || "";
    }, favX, favY);
  }
  if (!favId) throw new Error(`${label} favorite was not stored at ${favX},${favY}`);
  await page.reload({ waitUntil: "networkidle0" });
  const favAfter = await page.evaluate(() => localStorage.getItem("clean_cooking_favorites"));
  if (!favAfter.includes(favId)) throw new Error(`${label} favorite did not persist`);

  const blocked = failures.filter((item) => !/favicon/i.test(item));
  if (blocked.length) throw new Error(`${label} page errors:\n${blocked.join("\n")}`);
  console.log(`${label} smoke passed`);
}

const server = await startServer();
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage();
    page._port = port;
    await page.setViewport(viewport);
    await runViewport(page, label);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log("ui smoke passed");
