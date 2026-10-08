import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const chrome = process.env.CHROME_PATH ?? ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Chromium introuvable. Définir CHROME_PATH vers le navigateur installé.');

const address = 'http://127.0.0.1:4174/preview-pole-emdr/';
const server = spawn('node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Le serveur de preview a quitté avant le contrôle.');
    try {
      const response = await fetch(address);
      if (response.ok) return;
    } catch {
      // Vite démarre encore.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('La preview ne répond pas sur le port 4174.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });

  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const response = await page.goto(address, { waitUntil: 'networkidle' });
    assert(response?.ok(), `${width}px : la page ne répond pas correctement`);
    await page.evaluate(() => document.fonts.ready);
    const audit = await page.evaluate(async () => {
      const paragraphs = [...document.querySelectorAll('p')];
      const images = [...document.images];
      const localLinks = [...document.querySelectorAll('a[href^="#"]')];
      const imageResponses = await Promise.all(images.map(async (element) => ({
        src: element.getAttribute('src'),
        ok: (await fetch(element.src)).ok,
      })));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        overflowingElements: [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 12)
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}=${Math.round(element.getBoundingClientRect().right)}:${element.outerHTML.slice(0, 95)}`),
        smallParagraphs: paragraphs.filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 16).map((element) => element.textContent?.trim().slice(0, 50)),
        brokenImages: imageResponses.filter((item) => !item.ok).map((item) => item.src),
        brokenAnchors: localLinks.filter((element) => !document.querySelector(element.getAttribute('href'))).map((element) => element.getAttribute('href')),
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        disclaimer: document.body.textContent?.includes('Concept SABAN CORP — Site non officiel'),
      };
    });

    assert(audit.overflow <= 1, `${width}px : débordement horizontal de ${audit.overflow}px (${audit.overflowingElements.join(', ')})`);
    assert(audit.smallParagraphs.length === 0, `${width}px : paragraphes sous 16px : ${audit.smallParagraphs.join(', ')}`);
    assert(audit.brokenImages.length === 0, `${width}px : images absentes : ${audit.brokenImages.join(', ')}`);
    assert(audit.brokenAnchors.length === 0, `${width}px : ancres sans cible : ${audit.brokenAnchors.join(', ')}`);
    assert(audit.robots === 'noindex, nofollow', `${width}px : balise robots incorrecte`);
    assert(audit.disclaimer, `${width}px : mention de preview absente`);

    if (width <= 900) {
      await page.locator('.menu-toggle').click();
      assert(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'true', `${width}px : menu non ouvert`);
      await page.locator('.main-nav a[href="#formations"]').click();
      assert(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false', `${width}px : menu non refermé`);
      assert(new URL(page.url()).hash === '#formations', `${width}px : navigation vers les formations en échec`);
    }

    await page.locator('.accordion summary').first().click();
    assert(await page.locator('.accordion details').first().getAttribute('open') !== null, `${width}px : accordéon inactif`);
    assert(pageErrors.length === 0, `${width}px : erreurs JavaScript : ${pageErrors.join(', ')}`);

    await page.locator('.accordion summary').first().click();
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible')));
    await page.waitForTimeout(750);
    await page.screenshot({ path: `/tmp/preview-pole-emdr-${width}.png`, fullPage: true });
    console.log(`${width}px : rendu, navigation, accordéon, images, paragraphes et ancres OK`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
