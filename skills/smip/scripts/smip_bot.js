#!/usr/bin/env node
/**
 * smip_bot.js - Autonome Browser Automation Bot për SMIP (smip.al)
 * Përdor Playwright për të lundruar, loguar dhe inseruar temat mësimore direkt në sistem.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(process.cwd(), '.smip_session');
const DEFAULT_STORAGE_PATH = path.join(SESSION_DIR, 'storage_state.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    topicsFile: null,
    className: 'Klasa 6 - 8',
    subjectName: 'Edukim Fizik',
    month: '10/2026',
    isElective: 'Jo',
    username: process.env.SMIP_USER || null,
    password: process.env.SMIP_PASS || null,
    headful: false,
    dryRun: false,
    saveSession: true,
    cdp: false,
    cdpPort: 9222,
    openChrome: false,
    storagePath: DEFAULT_STORAGE_PATH,
    screenshotPath: 'smip_registry_result.png'
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--topics' && args[i + 1]) config.topicsFile = args[++i];
    else if (a === '--class' && args[i + 1]) config.className = args[++i];
    else if (a === '--subject' && args[i + 1]) config.subjectName = args[++i];
    else if (a === '--month' && args[i + 1]) config.month = args[++i];
    else if (a === '--elective' && args[i + 1]) config.isElective = args[++i];
    else if (a === '--username' && args[i + 1]) config.username = args[++i];
    else if (a === '--password' && args[i + 1]) config.password = args[++i];
    else if (a === '--headful') config.headful = true;
    else if (a === '--dry-run') config.dryRun = true;
    else if (a === '--cdp') {
      config.cdp = true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) config.cdpPort = parseInt(args[++i], 10);
    }
    else if (a === '--open-chrome') config.openChrome = true;
    else if (a === '--storage-path' && args[i + 1]) config.storagePath = args[++i];
    else if (a === '--screenshot' && args[i + 1]) config.screenshotPath = args[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
SMIP Autonomous Bot (smip.al)
Përdorimi:
  node scripts/smip_bot.js [opsionet]

Opsionet:
  --topics <file.json>     Skedari me temat e gjeneruara nga parse_plan.py (i detyrueshëm)
  --class <emri>          Emri i klasës (p.sh. "Klasa 6 - 8", "Klasa 3")
  --subject <emri>        Emri i lëndës (p.sh. "Edukim Fizik", "Anglisht")
  --month <MM/YYYY>       Muaji dhe viti (default: "10/2026")
  --elective <Jo|Po>       Lëndë me zgjedhje (default: "Jo")
  --cdp [port]            Lidhet direkt me Google Chrome ekzistues (default port: 9222)
  --open-chrome           Nis Google Chrome me remote debugging port automatikisht në macOS
  --username <user>       Përdoruesi për login (ose variabli SMIP_USER)
  --password <pass>       Fjalëkalimi për login (ose variabli SMIP_PASS)
  --headful               Hap shfletuesin me dritare të dukshme (rekomanduar për verifikim/2FA)
  --dry-run               Plotëson temat në modal por nuk klikon butonin final Ruaj
  --screenshot <file.png> Ruan foton e regjistrit të plotësuar
  `);
}

function loadTopics(filePath, className) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Skedari i temave '${filePath}' nuk ekziston!`);
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (Array.isArray(content)) return content;
  if (content.klasat) {
    if (content.klasat[className]) return content.klasat[className].oret || [];
    for (const [k, v] of Object.entries(content.klasat)) {
      if (className.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(className.toLowerCase())) {
        return v.oret || [];
      }
    }
    const firstKey = Object.keys(content.klasat)[0];
    return content.klasat[firstKey].oret || [];
  }
  if (content.oret) return content.oret;
  if (content.topics) return content.topics;
  return [];
}

async function selectReactDropdown(page, inputSelector, textValue, labelHint = '') {
  try {
    // 1. Provo selektorin kryesor
    let input = page.locator(inputSelector);
    if (await input.count() > 0) {
      await input.first().click({ force: true });
      await input.first().fill(textValue);
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      return true;
    }

    // 2. Fallback dinamik: Gjej sipas etiketës (label hint)
    if (labelHint) {
      console.log(`  * [Vetë-Riparim] Duke kërkuar fushën '${labelHint}' me strategji alternative...`);
      const container = page.locator(`label:has-text("${labelHint}")`).locator('..').locator('input, [class*="-control"]');
      if (await container.count() > 0) {
        await container.first().click({ force: true });
        await page.keyboard.type(textValue);
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        return true;
      }
    }

    // 3. Fallback me kërkim të dropdown-ve të dukshëm
    const anyDropdown = page.locator('[class*="-control"]');
    if (await anyDropdown.count() > 0) {
      for (let i = 0; i < await anyDropdown.count(); i++) {
        const dd = anyDropdown.nth(i);
        const text = await dd.textContent();
        if (text && (text.includes(textValue) || (labelHint && text.includes(labelHint)))) {
          await dd.click();
          await page.keyboard.type(textValue);
          await page.keyboard.press('Enter');
          return true;
        }
      }
    }
  } catch (e) {
    console.warn(`Vërejtje te dropdown ${inputSelector} (${labelHint}):`, e.message);
  }
  return false;
}

async function run() {
  const config = parseArgs();
  if (!config.topicsFile) {
    console.error('Gabim: Mungon parametri --topics <skedari.json>');
    printHelp();
    process.exit(1);
  }

  const topics = loadTopics(config.topicsFile, config.className);
  console.log('=====================================================');
  console.log('          SMIP AUTONOMOUS AGENT BOT                  ');
  console.log('=====================================================');
  console.log(`Klasa:     ${config.className}`);
  console.log(`Lënda:     ${config.subjectName}`);
  console.log(`Muaji:     ${config.month}`);
  console.log(`Gjithsej:  ${topics.length} tema për t'u hedhur në regjistër`);
  console.log(`Modaliteti:${config.headful ? ' Me pamje (Headful)' : ' Në prapaskenë (Headless)'}`);
  console.log(`Dry-run:   ${config.dryRun ? 'Po (vetëm testim)' : 'Jo (ruajtje aktive)'}`);
  console.log('-----------------------------------------------------');

  fs.mkdirSync(SESSION_DIR, { recursive: true });

  if (config.openChrome) {
    console.log(`🚀 Duke hapur Google Chrome në macOS me portën CDP: ${config.cdpPort}...`);
    const { exec } = require('child_process');
    exec(`/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${config.cdpPort} "https://smip.al/teacher/registry?tab=daily-register"`);
    await new Promise(r => setTimeout(r, 2500));
    config.cdp = true;
  }

  let browser;
  let context;
  let page;

  if (config.cdp) {
    const cdpUrl = `http://localhost:${config.cdpPort}`;
    console.log(`✓ Duke u lidhur drejtpërdrejt me Google Chrome ekzistues (${cdpUrl})...`);
    try {
      browser = await chromium.connectOverCDP(cdpUrl);
      context = browser.contexts()[0] || await browser.newContext();
      const pages = context.pages();
      page = pages.find(p => p.url().includes('smip.al')) || await context.newPage();
      console.log(`✓ U lidha me sukses me dritaren aktive të Chrome! Tab-i: ${page.url()}`);
    } catch (e) {
      console.error(`❌ Nuk u arrit lidhja me Chrome në portën ${config.cdpPort}. Sigurohuni që Chrome është hapur me --remote-debugging-port=${config.cdpPort}`);
      throw e;
    }
  } else {
    const hasSession = fs.existsSync(config.storagePath);
    const launchOptions = {
      channel: 'chrome',
      headless: !config.headful
    };

    const contextOptions = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 }
    };

    if (hasSession) {
      console.log(`✓ Duke ngarkuar sesionin e ruajtur nga: ${config.storagePath}`);
      contextOptions.storageState = config.storagePath;
    }

    browser = await chromium.launch(launchOptions);
    context = await browser.newContext(contextOptions);
    page = await context.newPage();
  }

  try {
    console.log('1. Duke lundruar te https://smip.al/teacher/registry?tab=daily-register...');
    await page.goto('https://smip.al/teacher/registry?tab=daily-register', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Kontrollo nëse jemi ridrejtuar te faqja e login
    if (page.url().includes('/login')) {
      console.log('⚠️ Nevojitet hyrja (login) në SMIP.');
      
      if (config.username && config.password) {
        console.log(`Duke provuar hyrjen automatike me përdoruesin: ${config.username}...`);
        await page.fill('#username', config.username);
        await page.fill('#password', config.password);
        await page.click('button:has-text("Hyr")');
        
        await page.waitForNavigation({ timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2000);
      } else {
        if (!config.headful) {
          throw new Error('Nuk u gjet sesion i vlefshëm dhe nuk u dhanë kredencialet (--username dhe --password). Ekzekutoni me --headful për t\'u loguar një herë!');
        }
        console.log('👉 Ju lutem kryeni hyrjen manualisht në dritaren e shfletuesit të hapur (me kredenciale ose e-Albania)...');
        await page.waitForURL(url => !url.href.includes('/login'), { timeout: 120000 });
        console.log('✓ Hyrja u krye me sukses!');
      }

      // Ruaj sesionin e ri për herët e ardhshme
      await context.storageState({ path: config.storagePath });
      console.log(`✓ Sesioni u ruajt te: ${config.storagePath}`);
    }

    // Sigurohu që jemi te regjistri ditor
    if (!page.url().includes('tab=daily-register')) {
      await page.goto('https://smip.al/teacher/registry?tab=daily-register', { waitUntil: 'networkidle', timeout: 30000 });
    }

    console.log('2. Duke zgjedhur filtrat e klasës dhe lëndës...');
    // Zgjedhje: Lëndë me zgjedhje (#react-select-5-input)
    await selectReactDropdown(page, '#react-select-5-input', config.isElective);

    // Zgjedhje: Klasa (#react-select-6-input)
    console.log(`  * Klasa: ${config.className}`);
    await selectReactDropdown(page, '#react-select-6-input', config.className);

    // Zgjedhje: Lënda (#react-select-7-input)
    console.log(`  * Lënda: ${config.subjectName}`);
    await selectReactDropdown(page, '#react-select-7-input', config.subjectName);

    // Zgjedhje: Muaji (#month-picker)
    console.log(`  * Muaji: ${config.month}`);
    const monthPicker = page.locator('#month-picker');
    if (await monthPicker.count() > 0) {
      await monthPicker.fill(config.month);
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1500);

    // 3. Hedhja e temave njëra pas tjetrës
    console.log('3. Duke inseruar temat në regjistrin ditor...');
    let inserted = 0;

    for (let i = 0; i < topics.length; i++) {
      const item = topics[i];
      const dataStr = item.data;
      const temaStr = item.tema;
      console.log(`   [${i + 1}/${topics.length}] ${dataStr} -> ${temaStr}`);

      // Kliko butonin 'Shto temë'
      const addTopicBtn = page.locator('#add-topic').or(page.locator('button:has-text("Shto temë")'));
      await addTopicBtn.first().click();
      await page.waitForTimeout(500);

      // Plotëso datën në modal
      const dateInput = page.locator('#date').or(page.locator('input[name="date"]'));
      await dateInput.first().fill(dataStr);
      await dateInput.first().dispatchEvent('change');

      // Plotëso titullin e temës në modal
      const nameInput = page.locator('#name').or(page.locator('input[name="name"]')).or(page.locator('textarea[name="name"]'));
      await nameInput.first().fill(temaStr);
      await nameInput.first().dispatchEvent('change');

      await page.waitForTimeout(300);

      // Konfirmo në modal
      const confirmBtn = page.locator('#add-modal button:has-text("Konfirmo")')
        .or(page.locator('#add-modal button:has-text("Shto")'))
        .or(page.locator('.modal button[type="submit"]'));
      
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click();
        await page.waitForTimeout(700);
        inserted++;
      } else {
        console.warn('   ⚠️ Nuk u gjet butoni i konfirmimit në modal.');
      }
    }

    console.log(`✓ U inseruan me sukses ${inserted} nga ${topics.length} tema.`);

    // 4. Ruajtja finale
    if (!config.dryRun) {
      console.log('4. Duke ruajtur ndryshimet përfundimtare (#bulk-save-grades)...');
      const saveBtn = page.locator('#bulk-save-grades').or(page.locator('button:has-text("Ruaj Ndryshimet")'));
      if (await saveBtn.count() > 0) {
        await saveBtn.first().click();
        await page.waitForTimeout(3000);
        console.log('✓ Ndryshimet u ruajtën në bazën e të dhënave të SMIP!');
      } else {
        console.warn('⚠️ Butoni #bulk-save-grades nuk u gjet.');
      }
    } else {
      console.log('4. [DRY-RUN] Butoni Ruaj nuk u klikua sipas kërkesës.');
    }

    // 5. Screenshot
    await page.screenshot({ path: config.screenshotPath, fullPage: true });
    console.log(`✓ U ruajt fotoja e regjistrit: ${config.screenshotPath}`);

  } catch (error) {
    console.error('❌ Gabim gjatë ekzekutimit:', error.message);
    await page.screenshot({ path: 'smip_error.png' }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  process.exit(1);
});
