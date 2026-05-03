const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = 3001;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function normalizeKeywordInput(text = '') {
  return text
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function extractCompanyDomain(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const blockedHosts = new Set([
      'www.google.com',
      'google.com',
      'maps.google.com',
      'accounts.google.com',
      'support.google.com',
      'policies.google.com',
      'youtube.com',
      'www.youtube.com'
    ]);

    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host || blockedHosts.has(host)) return null;

    return host;
  } catch {
    return null;
  }
}

async function collectDomainsFromGoogle(keywords) {
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const domains = new Set();

  try {
    for (const keyword of keywords) {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(700 + Math.floor(Math.random() * 700));

      const consentButton = page.locator('button:has-text("Accept all"), button:has-text("I agree")').first();
      if (await consentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await consentButton.click();
        await page.waitForTimeout(500);
      }

      const searchInput = page.locator('textarea[name="q"], input[name="q"]').first();
      await searchInput.fill(keyword);
      await page.waitForTimeout(400 + Math.floor(Math.random() * 600));
      await searchInput.press('Enter');

      await page.waitForSelector('#search a[href]', { timeout: 15000 });
      await page.waitForTimeout(900 + Math.floor(Math.random() * 900));

      const urls = await page.$$eval('#search a[href]', (links) =>
        links.map((a) => a.href).filter(Boolean)
      );

      for (const url of urls) {
        const domain = extractCompanyDomain(url);
        if (domain) domains.add(domain);
      }

      await page.waitForTimeout(1200 + Math.floor(Math.random() * 1000));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return Array.from(domains).sort((a, b) => a.localeCompare(b));
}

app.get('/', (req, res) => {
  res.render('index', {
    keywordsText: '',
    domains: [],
    count: 0,
    error: null
  });
});

app.post('/discover', async (req, res) => {
  const keywordsText = req.body.keywords || '';
  const keywords = normalizeKeywordInput(keywordsText);

  if (keywords.length === 0) {
    return res.render('index', {
      keywordsText,
      domains: [],
      count: 0,
      error: 'Zadej alespoň jedno klíčové slovo (1 na řádek).'
    });
  }

  try {
    const domains = await collectDomainsFromGoogle(keywords);
    return res.render('index', {
      keywordsText,
      domains,
      count: domains.length,
      error: null
    });
  } catch (error) {
    return res.render('index', {
      keywordsText,
      domains: [],
      count: 0,
      error: `Došlo k chybě při vyhledávání: ${error.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Lead discovery tool běží na http://localhost:${PORT}`);
});
