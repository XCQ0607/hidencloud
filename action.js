const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const os = require('os');

// ==========================================
// Part 1: Configuration & Helpers
// ==========================================

// Enable stealth plugin
chromium.use(stealth);

const RENEW_DAYS = 10;
const INJECTED_SCRIPT = `
(function() {
    if (window.self === window.top) return;

    try {
        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        let screenX = getRandomInt(800, 1200);
        let screenY = getRandomInt(400, 600);
        
        Object.defineProperty(MouseEvent.prototype, 'screenX', { value: screenX });
        Object.defineProperty(MouseEvent.prototype, 'screenY', { value: screenY });
    } catch (e) { }

    try {
        const originalAttachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(init) {
            const shadowRoot = originalAttachShadow.call(this, init);
            if (shadowRoot) {
                const checkAndReport = () => {
                    const checkbox = shadowRoot.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        const rect = checkbox.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && window.innerWidth > 0 && window.innerHeight > 0) {
                            const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
                            const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
                            window.__turnstile_data = { xRatio, yRatio };
                            return true;
                        }
                    }
                    return false;
                };
                if (!checkAndReport()) {
                    const observer = new MutationObserver(() => {
                        if (checkAndReport()) observer.disconnect();
                    });
                    observer.observe(shadowRoot, { childList: true, subtree: true });
                }
            }
            return shadowRoot;
        };
    } catch (e) { }
})();
`;

// Helper to sleep
const sleep = (min = 3000, max = 8000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

function getUsers() {
    try {
        if (process.env.USERS_JSON) {
            const parsed = JSON.parse(process.env.USERS_JSON);
            return Array.isArray(parsed) ? parsed : (parsed.users || []);
        }
        // Fallback for local testing
        const localUsersPath = path.join(__dirname, 'users.json');
        if (fs.existsSync(localUsersPath)) {
            console.log('Loading users from local users.json file...');
            const fileContent = fs.readFileSync(localUsersPath, 'utf8');
            const parsed = JSON.parse(fileContent);
            return Array.isArray(parsed) ? parsed : (parsed.users || []);
        }
    } catch (e) {
        console.error('Error parsing USERS_JSON or users.json:', e);
    }
    return [];
}

// ==========================================
// Part 2: Renewal Logic (HidenCloudBot)
// ==========================================

class HidenCloudBot {
    constructor(cookieStr, username) {
        this.username = username;
        this.originalCookie = cookieStr;
        this.cookieData = {};
        this.parseCookieStr(cookieStr);

        this.commonHeaders = {
            'Host': 'dash.hidencloud.com',
            'Connection': 'keep-alive',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Referer': 'https://dash.hidencloud.com/',
        };

        this.client = axios.create({
            baseURL: 'https://dash.hidencloud.com',
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 500,
            timeout: 30000
        });

        this.services = [];
        this.csrfToken = '';
        this.logMsg = [];
    }

    log(msg) {
        console.log(`[${this.username}] ${msg}`);
        this.logMsg.push(msg);
    }

    parseCookieStr(str) {
        if (!str) return;
        str.split(';').forEach(pair => {
            const idx = pair.indexOf('=');
            if (idx > 0) {
                const key = pair.substring(0, idx).trim();
                const val = pair.substring(idx + 1).trim();
                if (!['path', 'domain', 'expires', 'httponly', 'secure', 'samesite'].includes(key.toLowerCase())) {
                    this.cookieData[key] = val;
                }
            }
        });
    }

    updateCookiesFromResponse(headers) {
        const setCookie = headers['set-cookie'];
        if (setCookie) {
            setCookie.forEach(sc => {
                const firstPart = sc.split(';')[0];
                const idx = firstPart.indexOf('=');
                if (idx > 0) {
                    const key = firstPart.substring(0, idx).trim();
                    const val = firstPart.substring(idx + 1).trim();
                    this.cookieData[key] = val;
                }
            });
        }
    }

    getCookieStr() {
        return Object.keys(this.cookieData).map(k => `${k}=${this.cookieData[k]}`).join('; ');
    }

    async request(method, url, data = null, extraHeaders = {}) {
        let currentUrl = url;
        const requestHeaders = {
            ...this.commonHeaders,
            ...extraHeaders,
            'Cookie': this.getCookieStr()
        };

        if (method === 'POST' && !requestHeaders['Content-Type']) {
            requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        try {
            const res = await this.client({
                method,
                url: currentUrl,
                headers: requestHeaders,
                data
            });

            this.updateCookiesFromResponse(res.headers);
            res.finalUrl = currentUrl;

            if (res.status === 301 || res.status === 302) {
                const location = res.headers['location'];
                if (location) {
                    this.log(`🔄 重定向 -> ${location}`);
                    currentUrl = location.startsWith('http') ? location : `https://dash.hidencloud.com${location.startsWith('/') ? '' : '/'}${location}`;
                    return this.request('GET', currentUrl);
                }
            }
            res.finalUrl = currentUrl;
            return res;
        } catch (err) {
            throw err;
        }
    }

    extractTokens($) {
        const metaToken = $('meta[name="csrf-token"]').attr('content');
        if (metaToken) this.csrfToken = metaToken;
    }

    async init() {
        this.log('🔍 正在验证 API 登录状态...');
        try {
            const res = await this.request('GET', '/dashboard');
            if (res.headers.location && res.headers.location.includes('/login')) {
                this.log('❌ Cookie 无效，无法访问仪表盘');
                return false;
            }
            const $ = cheerio.load(res.data);
            this.extractTokens($);

            // Parse Services
            $('a[href*="/service/"]').each((i, el) => {
                const href = $(el).attr('href');
                const match = href.match(/\/service\/(\d+)\/manage/);
                if (match) {
                    this.services.push({ id: match[1], url: href });
                }
            });
            // deduplicate
            this.services = this.services.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            this.log(`✅ API 连接成功，发现 ${this.services.length} 个服务`);
            return true;
        } catch (e) {
            this.log(`❌ 初始化异常: ${e.message}`);
            return false;
        }
    }

    async processService(service) {
        await sleep(2000, 4000);
        this.log(`>>> 处理服务 ID: ${service.id}`);

        try {
            const manageRes = await this.request('GET', `/service/${service.id}/manage`);
            const $ = cheerio.load(manageRes.data);
            const formToken = $('input[name="_token"]').val();

            this.log(`📅 提交续期 (${RENEW_DAYS}天)...`);
            await sleep(1000, 2000);

            const params = new URLSearchParams();
            params.append('_token', formToken);
            params.append('days', RENEW_DAYS);

            const res = await this.request('POST', `/service/${service.id}/renew`, params, {
                'X-CSRF-TOKEN': this.csrfToken,
                'Referer': `https://dash.hidencloud.com/service/${service.id}/manage`
            });

            if (res.finalUrl && res.finalUrl.includes('/invoice/')) {
                this.log(`⚡️ 续期成功，前往支付`);
                await this.performPayFromHtml(res.data, res.finalUrl);
            } else {
                this.log('⚠️ 续期后未跳转，检查账单列表...');
                await this.checkAndPayInvoices(service.id);
            }

        } catch (e) {
            this.log(`❌ 处理异常: ${e.message}`);
        }
    }

    async checkAndPayInvoices(serviceId) {
        await sleep(2000, 3000);
        try {
            const res = await this.request('GET', `/service/${serviceId}/invoices?where=unpaid`);
            const $ = cheerio.load(res.data);

            const invoiceLinks = [];
            $('a[href*="/invoice/"]').each((i, el) => {
                const href = $(el).attr('href');
                if (href && !href.includes('download')) invoiceLinks.push(href);
            });

            const uniqueInvoices = [...new Set(invoiceLinks)];
            if (uniqueInvoices.length === 0) {
                this.log(`✅ 无未支付账单`);
                return;
            }

            for (const url of uniqueInvoices) {
                await this.paySingleInvoice(url);
                await sleep(3000, 5000);
            }
        } catch (e) {
            this.log(`❌ 查账单出错: ${e.message}`);
        }
    }

    async paySingleInvoice(url) {
        try {
            this.log(`📄 打开账单: ${url}`);
            const res = await this.request('GET', url);
            await this.performPayFromHtml(res.data, url);
        } catch (e) {
            this.log(`❌ 访问失败: ${e.message}`);
        }
    }

    async performPayFromHtml(html, currentUrl) {
        const $ = cheerio.load(html);

        let targetForm = null;
        let targetAction = '';

        $('form').each((i, form) => {
            const btnText = $(form).find('button').text().trim().toLowerCase();
            const action = $(form).attr('action');
            if (btnText.includes('pay') && action && !action.includes('balance/add')) {
                targetForm = $(form);
                targetAction = action;
                return false;
            }
        });

        if (!targetForm) {
            this.log(`⚪ 页面未找到支付表单 (可能已支付)`);
            return;
        }

        const payParams = new URLSearchParams();
        targetForm.find('input').each((i, el) => {
            const name = $(el).attr('name');
            const value = $(el).val();
            if (name) payParams.append(name, value || '');
        });

        this.log(`💳 提交支付...`);

        try {
            const payRes = await this.request('POST', targetAction, payParams, {
                'X-CSRF-TOKEN': this.csrfToken,
                'Referer': currentUrl
            });

            if (payRes.status === 200) {
                this.log(`✅ 支付成功！`);
            } else {
                this.log(`⚠️ 支付响应: ${payRes.status}`);
            }
        } catch (e) {
            this.log(`❌ 支付失败: ${e.message}`);
        }
    }
}

// ==========================================
// Part 3: Browser Login Logic (Integrated from login.js)
// ==========================================

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const DEBUG_PORT = 9222;

function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/json/version`, (res) => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

async function launchChrome() {
    if (await checkPort(DEBUG_PORT)) {
        console.log('Chrome is already open.');
        return;
    }

    console.log(`Launching Chrome (Detached)...`);
    // Use OS temp directory for user data or specific tmp path
    const userDataDir = path.join(os.tmpdir(), 'chrome_user_data_' + Date.now());

    const args = [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--window-size=1280,720',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--user-data-dir=${userDataDir}`,
        '--disable-dev-shm-usage'
    ];

    const chrome = spawn(CHROME_PATH, args, {
        detached: true,
        stdio: 'ignore'
    });
    chrome.unref();

    console.log('Waiting for Chrome to initialize...');
    for (let i = 0; i < 20; i++) {
        if (await checkPort(DEBUG_PORT)) break;
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!await checkPort(DEBUG_PORT)) {
        throw new Error('Chrome launch failed');
    }
}

async function attemptTurnstileCdp(page) {
    const frames = page.frames();
    for (const frame of frames) {
        try {
            const data = await frame.evaluate(() => window.__turnstile_data).catch(() => null);

            if (data) {
                console.log('>> Found Turnstile in frame. Ratios:', data);
                const iframeElement = await frame.frameElement();
                if (!iframeElement) continue;

                const box = await iframeElement.boundingBox();
                if (!box) continue;

                const clickX = box.x + (box.width * data.xRatio);
                const clickY = box.y + (box.height * data.yRatio);

                const client = await page.context().newCDPSession(page);
                await client.send('Input.dispatchMouseEvent', {
                    type: 'mousePressed',
                    x: clickX,
                    y: clickY,
                    button: 'left',
                    clickCount: 1
                });
                await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
                await client.send('Input.dispatchMouseEvent', {
                    type: 'mouseReleased',
                    x: clickX,
                    y: clickY,
                    button: 'left',
                    clickCount: 1
                });
                console.log('>> CDP Click sent.');
                await client.detach();
                return true;
            }
        } catch (e) { }
    }
    return false;
}

async function handleVerification(page) {
    console.log('Checking for verification...');
    for (let i = 0; i < 30; i++) {
        if (await page.getByRole('textbox', { name: 'Email or Username' }).isVisible()) {
            console.log('Login form detected.');
            return;
        }
        await attemptTurnstileCdp(page);
        await page.waitForTimeout(1000);
    }
}

// ==========================================
// Main Execution
// ==========================================

(async () => {
    const users = getUsers();
    if (users.length === 0) {
        console.log('No users found in process.env.USERS_JSON or local users.json');
        process.exit(1);
    }

    console.log(`🚀 Starting Action Script for ${users.length} users...`);
    const summary = [];

    // Launch Chrome Process (Detached)
    try {
        await launchChrome();
    } catch (e) {
        console.error('Fatal: Could not launch Chrome.', e);
        process.exit(1);
    }

    console.log(`Connecting to Chrome at port ${DEBUG_PORT}...`);
    let browser;
    try {
        browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
    } catch (e) {
        console.error('Fatal: Could not connect to Chrome CDP.', e);
        process.exit(1);
    }

    // Reuse the wrapper context
    const defaultContext = browser.contexts()[0];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`\n=== Processing User ${i + 1}: ${user.username} ===`);

        // Use the existing context but ensure it's clean-ish or just new Page
        const page = await defaultContext.newPage();
        await page.addInitScript(INJECTED_SCRIPT);
        page.setDefaultTimeout(60000);

        let cookieStr = '';
        let loginSuccess = false;

        try {
            // --- Part A: Login ---
            console.log('--- Phase 1: Browser Login ---');
            await page.goto('https://dash.hidencloud.com/auth/login');
            await handleVerification(page);

            await page.getByRole('textbox', { name: 'Email or Username' }).waitFor({ timeout: 20000 });
            await page.getByRole('textbox', { name: 'Email or Username' }).fill(user.username);
            await page.getByRole('textbox', { name: 'Password' }).click();
            await page.getByRole('textbox', { name: 'Password' }).fill(user.password);

            console.log('Checking for second verification...');
            for (let j = 0; j < 5; j++) {
                if (await attemptTurnstileCdp(page)) await page.waitForTimeout(2000);
                await page.waitForTimeout(500);
            }

            console.log('Clicking Sign In...');
            await page.getByRole('button', { name: 'Sign in to your account' }).click();

            try {
                await page.waitForURL('**/dashboard', { timeout: 30000 });
                console.log('Browser Login Successful!');
                loginSuccess = true;
            } catch (e) {
                console.error('Wait for dashboard failed. Checking for errors...');
                if (await page.getByText('Incorrect password').isVisible()) {
                    console.error('Login Failed: Incorrect password.');
                } else {
                    await page.screenshot({ path: `login_failed_${i}.png` });
                }
            }

            if (loginSuccess) {
                // Get Cookies
                const allCookies = await defaultContext.cookies();
                const relevantCookies = allCookies.filter(c => c.domain.includes('hidencloud.com'));
                cookieStr = relevantCookies.map(c => `${c.name}=${c.value}`).join('; ');

                // Export Cookies (Debug/Optional)
                const turnstileCookie = relevantCookies.find(c => c.name === 'hc_cf_turnstile');
                if (turnstileCookie) {
                    console.log(`✅ Cookie Extracted: hc_cf_turnstile=${turnstileCookie.value.substring(0, 10)}...`);
                }
            }

        } catch (err) {
            console.error(`Browser Interaction Error: ${err.message}`);
            await page.screenshot({ path: `error_browser_${i}.png` });
        } finally {
            await page.close();
        }

        // --- Part B: Renewal Logic ---
        if (loginSuccess && cookieStr) {
            console.log('\n--- Phase 2: Renewal Operations ---');
            const bot = new HidenCloudBot(cookieStr, user.username);
            if (await bot.init()) {
                for (const svc of bot.services) {
                    await bot.processService(svc);
                }
                summary.push({ user: user.username, status: 'Success', services: bot.services.length });
            } else {
                summary.push({ user: user.username, status: 'Failed (API Init)', services: 0 });
            }
        } else {
            summary.push({ user: user.username, status: 'Failed (Login)', services: 0 });
        }

        // Clear cookies for next user
        if (i < users.length - 1) {
            console.log('Clearing cookies for next user...');
            await defaultContext.clearCookies();
            await sleep(5000);
        }
    }

    console.log('Cleaning up browser...');
    try { if (browser) await browser.close(); } catch (e) { }

    console.log('Done (Forced Exit).');

    console.log('\n\n╔════════════════════════════════════════════╗');
    console.log('║               Final Summary                ║');
    console.log('╚════════════════════════════════════════════╝');
    summary.forEach(s => {
        console.log(`User: ${s.user} | Status: ${s.status} | Services: ${s.services}`);
    });

    // Exit code based on success
    if (summary.some(s => s.status.includes('Failed'))) {
        process.exit(1);
    } else {
        process.exit(0);
    }
})();
