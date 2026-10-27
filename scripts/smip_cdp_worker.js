const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT_FILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/DevToolsActivePort');
const HTTP_PORT = 8321;

async function getWsEndpoint() {
  if (!fs.existsSync(PORT_FILE)) {
    throw new Error('Nuk u gjet skedari DevToolsActivePort në Google Chrome.');
  }
  const lines = fs.readFileSync(PORT_FILE, 'utf8').trim().split('\n');
  const port = lines[0].trim();
  const wsPath = lines[1].trim();
  return `ws://127.0.0.1:${port}${wsPath}`;
}

async function start() {
  const wsEndpoint = await getWsEndpoint();
  console.log(`[CDP Worker] Lidhje me Chrome: ${wsEndpoint}`);

  const browser = await chromium.connectOverCDP(wsEndpoint);
  console.log('[CDP Worker] ✓ U lidha me sukses me Google Chrome! Sesioni po mbahet aktiv.');

  function getSmipPage() {
    const pages = browser.contexts().flatMap(c => c.pages());
    return pages.find(p => p.url().includes('smip.al'));
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Parse JSON body helper
    const readBody = () => new Promise((resolve) => {
      let b = '';
      req.on('data', chunk => b += chunk);
      req.on('end', () => {
        try { resolve(JSON.parse(b || '{}')); } catch(e) { resolve({}); }
      });
    });

    try {
      const page = getSmipPage();
      if (!page && req.url !== '/ping') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Nuk u gjet tab-i i smip.al në Chrome.' }));
      }

      if (req.method === 'GET' && req.url === '/ping') {
        return res.end(JSON.stringify({ status: 'ok', connected: true }));
      }

      if (req.method === 'GET' && req.url === '/status') {
        const info = await page.evaluate(() => {
          const userBtn = document.getElementById('user-dropdown');
          const teacherName = userBtn ? userBtn.textContent.trim() : '';
          const monthPicker = document.getElementById('month-picker');
          const month = monthPicker ? monthPicker.value : '';
          const controls = Array.from(document.querySelectorAll('[class*=-control]')).map(c => c.textContent.trim());
          const subTabs = Array.from(document.querySelectorAll('button, a, div'))
            .filter(e => ['Temat', 'Regjistri'].includes(e.textContent.trim()))
            .map(e => ({ tag: e.tagName, text: e.textContent.trim(), class: e.className }));
          return {
            url: window.location.href,
            teacherName,
            month,
            controls,
            subTabs
          };
        });
        return res.end(JSON.stringify({ status: 'ok', info }));
      }

      if (req.method === 'POST' && req.url === '/eval') {
        const { code } = await readBody();
        const result = await page.evaluate(code);
        return res.end(JSON.stringify({ status: 'ok', result }));
      }

      if (req.method === 'POST' && req.url === '/click') {
        const { selector, text } = await readBody();
        if (selector) {
          await page.locator(selector).first().click();
        } else if (text) {
          await page.locator(`:has-text("${text}")`).first().click();
        }
        await page.waitForTimeout(600);
        return res.end(JSON.stringify({ status: 'ok' }));
      }

      if (req.method === 'POST' && req.url === '/select') {
        const { className, subjectName, month } = await readBody();
        console.log(`[CDP Worker] Zgjedhje: Klasa '${className}', Lënda '${subjectName}', Muaji '${month}'`);
        await page.bringToFront();

        // Close any open popups (like month calendar)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // 1. Zgjidh Klasën (react-select-3-input)
        if (className) {
          const classInput = page.locator('#react-select-3-input');
          if (await classInput.count() > 0) {
            await classInput.click();
            await page.waitForTimeout(300);
            const opt = page.locator(`[class*=-option]:has-text("${className}")`);
            if (await opt.count() > 0) {
              await opt.first().click();
            } else {
              await page.keyboard.type(className);
              await page.keyboard.press('Enter');
            }
            await page.waitForTimeout(500);
          }
        }

        // 2. Zgjidh Lëndën (react-select-4-input)
        if (subjectName) {
          const subInput = page.locator('#react-select-4-input');
          if (await subInput.count() > 0) {
            await subInput.click();
            await page.waitForTimeout(300);
            const opt = page.locator(`[class*=-option]:has-text("${subjectName}")`);
            if (await opt.count() > 0) {
              await opt.first().click();
            } else {
              await page.keyboard.type(subjectName);
              await page.keyboard.press('Enter');
            }
            await page.waitForTimeout(500);
          }
        }

        // 3. Zgjidh Muajin (month-picker)
        if (month) {
          const mPicker = page.locator('#month-picker');
          if (await mPicker.count() > 0) {
            await mPicker.fill(month);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);
            await page.keyboard.press('Escape'); // dismiss calendar popup
            await page.waitForTimeout(300);
          }
        }

        const currentControls = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[class*=-control]')).map(c => c.textContent.trim());
        });

        return res.end(JSON.stringify({ status: 'ok', currentControls }));
      }

      if (req.method === 'POST' && req.url === '/insert-topics') {
        const { topics, dryRun } = await readBody();
        if (!topics || !Array.isArray(topics)) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Mungon lista e temave (topics).' }));
        }

        console.log(`[CDP Worker] Nisja e hedhjes së ${topics.length} temave (dryRun=${!!dryRun})...`);
        await page.bringToFront();

        const results = [];
        for (let i = 0; i < topics.length; i++) {
          const item = topics[i];
          const dataStr = item.data;
          const dataIso = item.data_iso || dataStr;
          const temaStr = item.tema;
          console.log(`  [${i + 1}/${topics.length}] ${dataStr} -> ${temaStr}`);

          // 1. Gjej butonin 'Shto temë' (mund të jetë buton, ikonë me +, ose tekst)
          const addBtn = page.locator('#add-topic')
            .or(page.locator('button:has-text("Shto temë")'))
            .or(page.locator('button:has-text("Shto")'))
            .or(page.locator('[aria-label="Shto temë"]'))
            .or(page.locator('button:has-text("+")'));

          if (await addBtn.count() === 0) {
            results.push({ nr: i + 1, error: 'Butoni Shto temë nuk u gjet' });
            continue;
          }

          await addBtn.first().click();
          await page.waitForTimeout(500);

          // 2. Plotëso datën në modal
          const dateInput = page.locator('#date').or(page.locator('input[name="date"]'));
          if (await dateInput.count() > 0) {
            const inputType = await dateInput.first().getAttribute('type');
            const fillVal = inputType === 'date' ? dataIso : dataStr;
            await dateInput.first().fill(fillVal);
            await dateInput.first().dispatchEvent('change');
          }

          // 3. Plotëso temën në modal
          const nameInput = page.locator('#name').or(page.locator('input[name="name"]')).or(page.locator('textarea[name="name"]'));
          if (await nameInput.count() > 0) {
            await nameInput.first().fill(temaStr);
            await nameInput.first().dispatchEvent('change');
          }

          await page.waitForTimeout(300);

          // 4. Konfirmo në modal
          const confirmBtn = page.locator('#add-modal button:has-text("Konfirmo")')
            .or(page.locator('#add-modal button:has-text("Shto")'))
            .or(page.locator('.modal button[type="submit"]'))
            .or(page.locator('button[type="submit"]:has-text("Konfirmo")'));
          
          if (await confirmBtn.count() > 0) {
            await confirmBtn.first().click();
            await page.waitForTimeout(700);
            results.push({ nr: i + 1, data: dataStr, tema: temaStr, status: 'ok' });
          } else {
            results.push({ nr: i + 1, error: 'Butoni Konfirmo nuk u gjet' });
          }
        }

        // 5. Ruaj nëse nuk është dry-run
        if (!dryRun) {
          console.log('[CDP Worker] Duke ruajtur ndryshimet përfundimtare...');
          const saveBtn = page.locator('#bulk-save-grades')
            .or(page.locator('button:has-text("Ruaj Ndryshimet")'))
            .or(page.locator('button:has-text("Ruaj")'));
          if (await saveBtn.count() > 0) {
            await saveBtn.first().click();
            await page.waitForTimeout(3000);
          }
        }

        return res.end(JSON.stringify({ status: 'ok', inserted: results.length, results }));
      }

      if (req.method === 'GET' && req.url === '/screenshot') {
        await page.bringToFront();
        const screenshotPath = 'smip_cdp_live.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        return res.end(JSON.stringify({ status: 'ok', file: screenshotPath }));
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint i panjohur' }));

    } catch (err) {
      console.error('[CDP Worker Error]:', err.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[CDP Worker] 🟢 Serveri po dëgjon në http://127.0.0.1:${HTTP_PORT}`);
    console.log('[CDP Worker] Sesioni i Chrome mbetet i lidhur PA NDËRPRERJE.');
  });
}

start().catch(err => {
  console.error('[CDP Worker Fatal]:', err);
  process.exit(1);
});
