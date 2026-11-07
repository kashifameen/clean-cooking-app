import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const chrome = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const outDir = process.env.NAV_SHOTS || "/tmp/cc-tabs-after";
fs.mkdirSync(outDir, { recursive: true });

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
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
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const cases = [
  { name: "320", width: 320, height: 700, font: 16 },
  { name: "360", width: 360, height: 740, font: 16 },
  { name: "390", width: 390, height: 844, font: 16 },
  { name: "412", width: 412, height: 900, font: 16 },
  { name: "600", width: 600, height: 900, font: 16 },
  { name: "768", width: 768, height: 1024, font: 16 },
  { name: "1024", width: 1024, height: 768, font: 16 },
  { name: "landscape-700", width: 700, height: 360, font: 16 },
  { name: "320-font-150", width: 320, height: 800, font: 24 },
  { name: "390-font-200", width: 390, height: 900, font: 32 },
];

const server = await startServer();
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  protocolTimeout: 120000,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.endsWith("/sw.js") || req.resourceType() === "image") req.abort();
    else req.continue();
  });
  for (const item of cases) {
    await page.setViewport({ width: item.width, height: item.height, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.evaluate((font) => {
      document.documentElement.style.fontSize = `${font}px`;
    }, item.font);
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const nav = document.querySelector(".app-tabs");
      const tabs = [...document.querySelectorAll(".nav-tab-btn")].map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tab: el.dataset.tab,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          text: el.innerText.replace(/\s+/g, " ").trim(),
          inside: rect.left >= -1 && rect.right <= vw + 1 && rect.top >= -1 && rect.width > 8 && rect.height >= 40,
          font: style.fontSize,
        };
      });
      return {
        vw,
        pageOverflow: document.documentElement.scrollWidth - vw,
        navScroll: nav.scrollWidth - nav.clientWidth,
        tabs,
      };
    });
    const bad = report.tabs.filter((tab) => !tab.inside);
    const names = report.tabs.map((tab) => tab.tab);
    if (names.length !== 5 || new Set(names).size !== 5) {
      throw new Error(`${item.name} expected 5 tabs, got ${names.join(",")}`);
    }
    if (bad.length || report.pageOverflow > 1 || report.navScroll > 1) {
      throw new Error(`${item.name} layout failed ${JSON.stringify({ bad, pageOverflow: report.pageOverflow, navScroll: report.navScroll })}`);
    }
    console.log(`${item.name} ok tabs=${report.tabs.map((tab) => tab.tab).join(",")}`);
  }

  await page.setViewport({ width: 360, height: 740 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "16px"; });
  await page.click('.nav-tab-btn[data-tab="planner"]');
  await page.waitForFunction(() => !document.querySelector("#view-planner").classList.contains("hidden"));
  await page.click('.nav-tab-btn[data-tab="shopping"]');
  await page.waitForFunction(() => !document.querySelector("#view-shopping").classList.contains("hidden"));
  await page.click('.nav-tab-btn[data-tab="guide"]');
  await page.waitForFunction(() => !document.querySelector("#view-guide").classList.contains("hidden"));
  await page.click('.nav-tab-btn[data-tab="drinks"]');
  await page.waitForFunction(() => (document.querySelector("#results-count")?.textContent || "").includes("21"));
  const active = await page.$eval('.nav-tab-btn[data-tab="recipes"]', (el) => el.className);
  if (!active.includes("border-emerald-500")) {
    throw new Error("drinks tab should return focus styling to the recipes tab");
  }
  console.log("tab activation ok");
} finally {
  await browser.close();
  server.close();
}
console.log("nav layout passed");
