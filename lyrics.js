const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'file:///home/claude/site/index.html';
const wav = fs.readFileSync('/home/claude/test/silence.wav');
const cover1 = fs.readFileSync('/home/claude/test/cover1.png');
const cover2 = fs.readFileSync('/home/claude/test/cover2.png');
const OUT = '/home/claude/test/shots';
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
let failed = 0;
function check(name, condition, extra) {
    if (condition) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LRC з рядком кожні 2 секунди
function makeLrc(count) {
    const rows = [];
    for (let i = 0; i < count; i++) {
        const t = 1 + i * 2;
        const mm = String(Math.floor(t / 60)).padStart(2, '0');
        const ss = String(t % 60).padStart(2, '0');
        rows.push('[' + mm + ':' + ss + '.00] Рядок ' + (i + 1) + ': ми слухаємо музику разом');
    }
    rows.splice(3, 0, '[00:06.50] ');               // пауза-«ноти»
    rows.push('[00:59.00] ');
    return rows.join('\n');
}
const SYNCED = makeLrc(20);
const PLAIN = 'Перший рядок\nДругий рядок\n\nТретій рядок після паузи\nЧетвертий рядок';

const audiusTracks = [
    { id: 'A1', title: 'Океан Ельзи - Обійми (Official Video)', user: { name: 'Music Label' }, duration: 200, artwork: { '150x150': 'https://img.test/c1.png' } },
    { id: 'A2', title: 'Skrillex - Bangarang (feat. Sirah) [Free Download]', user: { name: 'DJ Uploader' }, duration: 215, artwork: { '150x150': 'https://img.test/c2.png' } },
    { id: 'A3', title: 'Unknown Beat', user: { name: 'Someone' }, duration: 100, artwork: { '150x150': 'https://img.test/c1.png' } },
    { id: 'A4', title: 'Slowed Track', user: { name: 'Slow Artist' }, duration: 300, artwork: { '150x150': 'https://img.test/c2.png' } },
    { id: 'A5', title: 'Plain Only', user: { name: 'Plain Artist' }, duration: 180, artwork: { '150x150': 'https://img.test/c1.png' } },
    { id: 'A6', title: 'Just Instrumental', user: { name: 'Inst Artist' }, duration: 120, artwork: { '150x150': 'https://img.test/c2.png' } },
    { id: 'A7', title: 'Flaky Song', user: { name: 'Flaky' }, duration: 90, artwork: { '150x150': 'https://img.test/c1.png' } },
    { id: 'A8', title: 'Search Only', user: { name: 'Search Artist' }, duration: 210, artwork: { '150x150': 'https://img.test/c2.png' } }
];

function json(status, body) {
    return { status: status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}

function record(o) {
    return Object.assign({ id: 1, name: o.trackName, albumName: 'x', instrumental: false, plainLyrics: null, syncedLyrics: null }, o);
}

// Імітація LRCLIB. Повертає { status, body } залежно від запиту
function lrclib(url, state) {
    const q = url.searchParams;
    const title = q.get('track_name');
    const artist = q.get('artist_name');
    const dur = q.get('duration');
    if (state.lrclibDown) { return json(500, { error: 'down' }); }

    if (url.pathname === '/api/get') {
        if (title === 'Digital Soul' && artist === 'Chrome Static') {
            return json(200, record({ trackName: title, artistName: artist, duration: 252, syncedLyrics: SYNCED, plainLyrics: 'x' }));
        }
        if (title === 'Обійми' && artist === 'Океан Ельзи') {
            return json(200, record({ trackName: title, artistName: artist, duration: 200, syncedLyrics: SYNCED.replace(/Рядок/g, 'Обійми—рядок') }));
        }
        if (title === 'Bangarang' && artist === 'Skrillex') {
            return json(200, record({ trackName: title, artistName: artist, duration: 215, syncedLyrics: SYNCED.replace(/Рядок/g, 'Bangarang line') }));
        }
        if (title === 'Plain Only') {
            return json(200, record({ trackName: title, artistName: artist, duration: 180, plainLyrics: PLAIN }));
        }
        if (title === 'Just Instrumental') {
            return json(200, record({ trackName: title, artistName: artist, duration: 120, instrumental: true }));
        }
        if (title === 'Flaky Song') {
            state.flakyCalls = (state.flakyCalls || 0) + 1;
            if (!state.flakyOk) { return json(503, { error: 'busy' }); }
            return json(200, record({ trackName: title, artistName: artist, duration: 90, syncedLyrics: SYNCED.replace(/Рядок/g, 'Flaky') }));
        }
        return json(404, { code: 404, name: 'TrackNotFound' });
    }

    if (url.pathname === '/api/search') {
        if (title === 'Unknown Beat') {
            // Інший виконавець із тією самою назвою: НЕ повинен підійти
            return json(200, [record({ trackName: 'Unknown Beat', artistName: 'Totally Different Band', duration: 100, syncedLyrics: SYNCED })]);
        }
        if (title === 'Slowed Track') {
            // Той самий виконавець, але версія на 50 с коротша: НЕ повинна підійти
            return json(200, [record({ trackName: 'Slowed Track', artistName: 'Slow Artist', duration: 250, syncedLyrics: SYNCED, plainLyrics: PLAIN })]);
        }
        if (title === 'Search Only') {
            return json(200, [
                record({ id: 1, trackName: 'Search Only', artistName: 'Search Artist', duration: 400, syncedLyrics: SYNCED.replace(/Рядок/g, 'WRONG') }),
                record({ id: 2, trackName: 'Search Only (Radio Edit)', artistName: 'Search Artist', duration: 212, syncedLyrics: SYNCED.replace(/Рядок/g, 'Знайдено') })
            ]);
        }
        return json(200, []);
    }
    return json(404, {});
}

async function setup(browser, opts) {
    opts = opts || {};
    const context = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 } });
    const page = await context.newPage();
    const state = { errors: [], lrclibLog: [], flakyOk: false };

    page.on('pageerror', (e) => state.errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
        if (m.type() === 'error' && m.text().indexOf('Failed to load resource') === -1) {
            state.errors.push('console: ' + m.text());
        }
    });

    await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.protocol === 'file:') { return route.continue(); }

        if (url.hostname === 'lrclib.net') {
            state.lrclibLog.push(url.pathname + url.search);
            return route.fulfill(lrclib(url, state));
        }
        if (url.hostname === 'api.audius.co') {
            return opts.audius ? route.fulfill(json(200, ['https://discovery.test'])) : route.abort();
        }
        if (url.hostname === 'discovery.test' && url.pathname.indexOf('/trending') !== -1) {
            return route.fulfill(json(200, { data: audiusTracks }));
        }
        const isAudio = url.pathname.endsWith('.mp3') || url.pathname.endsWith('/stream');
        if (isAudio) {
            const range = route.request().headers()['range'];
            const total = wav.length;
            const base = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
            if (range) {
                const m = /bytes=(\d+)-(\d*)/.exec(range);
                const start = Number(m[1]);
                const end = m[2] ? Number(m[2]) : total - 1;
                return route.fulfill({ status: 206, headers: Object.assign({}, base, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total }), body: wav.subarray(start, end + 1) });
            }
            return route.fulfill({ status: 200, headers: base, body: wav });
        }
        if (url.hostname === 'img.test') {
            return route.fulfill({ status: 200, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }, body: url.pathname.indexOf('c2') !== -1 ? cover2 : cover1 });
        }
        if (url.hostname === 'images.unsplash.com') {
            return route.fulfill({ status: 200, headers: { 'Content-Type': 'image/png' }, body: cover1 });
        }
        return route.abort();
    });

    await page.goto(SITE);
    // Пісочниця без мережі не завантажує шрифт іконок — робимо їх невидимими плейсхолдерами, щоб перевіряти лише розкладку
    await page.addStyleTag({ content: '.material-symbols-outlined{display:inline-block;width:1em;height:1em;overflow:hidden;color:transparent!important;background:rgba(255,255,255,.22);border-radius:4px;line-height:1}' });
    await page.waitForSelector('#tracks-list .song-row');
    return { page: page, state: state, context: context };
}

async function playRow(page, title) {
    // Вікно тексту перекриває сторінку (так і задумано), тому викликаємо той самий обробник кліку напряму
    await page.$eval('#tracks-list .song-row:has(.song-title:text-is("' + title + '"))', (el) => el.click());
}

const expectedIndex = (times, t) => { let r = -1; for (let i = 0; i < times.length; i++) { if (times[i] <= t) { r = i; } } return r; };

async function snapshot(page) {
    return page.evaluate(() => {
        const a = document.getElementById('audio');
        const items = Array.from(document.querySelectorAll('.lyrics-line'));
        return { t: a.currentTime, paused: a.paused, active: items.findIndex((e) => e.classList.contains('is-active')), times: typeof lyricsLines !== 'undefined' ? lyricsLines.map((l) => l.time) : [] };
    });
}

(async () => {
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

    /* ------------------------------------------------------------------ */
    console.log('\n[1] Парсер і очищення назв (чиста логіка)');
    {
        const { page, state } = await setup(browser);
        const r = await page.evaluate(() => ({
            multi: parseSyncedLyrics('[00:10.00][00:40.50] Приспів\n[00:12.5] Куплет'),
            frac: parseSyncedLyrics('[01:02.5] a\n[01:03.25] b\n[01:04.123] c').map((l) => l.time),
            meta: parseSyncedLyrics('[ar:Хтось]\n[ti:Щось]\n[00:01.00] Текст').length,
            enhanced: parseSyncedLyrics('[00:01.00] <00:01.00> Слово <00:01.50> друге')[0].text,
            gaps: parseSyncedLyrics('[00:01.00] a\n[00:02.00] \n[00:03.00] \n[00:04.00] b').map((l) => l.text),
            onlyEmpty: parseSyncedLyrics('[00:01.00] \n[00:02.00] ').length,
            crlf: parseSyncedLyrics('[00:01.00] a\r\n[00:02.00] b\r\n').length,
            clean1: cleanLyricsTitle('Bangarang (feat. Sirah) [Free Download]'),
            clean2: cleanLyricsTitle('Track Name ft. Someone'),
            clean3: cleanLyricsTitle('(Untitled)'),
            clean4: cleanLyricsTitle('Обійми (Official Video)'),
            split1: splitArtistTitle('Океан Ельзи - Обійми'),
            split2: splitArtistTitle('Just A Title'),
            split3: splitArtistTitle('Well-known-title'),
            match1: isLooseMatch('Океан Ельзи', 'океан ельзи!'),
            match2: isLooseMatch('AB', 'ABC'),
            match3: isLooseMatch('Bangarang (Radio Edit)', 'Bangarang'),
            match4: isLooseMatch('Totally Different Band', 'Some Label'),
            dur: [getLyricsDuration({ duration: 200 }), getLyricsDuration({ duration: '3:45' }), getLyricsDuration({ duration: '1:02:03' }), getLyricsDuration({})],
            queries: buildLyricsQueries({ title: 'Океан Ельзи - Обійми (Official Video)', user: { name: 'Music Label' } })
        }));
        check('кілька міток в одному рядку', r.multi.length === 3 && r.multi[0].time === 10 && r.multi[2].time === 40.5 && r.multi[0].text === 'Приспів', r.multi);
        check('дробові секунди (.5 / .25 / .123)', JSON.stringify(r.frac) === JSON.stringify([62.5, 63.25, 64.123]), r.frac);
        check('метадані [ar:] [ti:] ігноруються', r.meta === 1, r.meta);
        check('word-level теги <00:01.00> прибираються', r.enhanced === 'Слово друге', r.enhanced);
        check('порожні рядки поспіль зливаються', JSON.stringify(r.gaps) === JSON.stringify(['a', '', 'b']), r.gaps);
        check('лише порожні рядки → немає тексту', r.onlyEmpty === 0, r.onlyEmpty);
        check('CRLF підтримується', r.crlf === 2, r.crlf);
        check('очищення: [..] і (feat ..)', r.clean1 === 'Bangarang', r.clean1);
        check('очищення: "ft." наприкінці', r.clean2 === 'Track Name', r.clean2);
        check('очищення: назва лише в дужках не стає порожньою', r.clean3 === '(Untitled)', r.clean3);
        check('очищення кирилиці', r.clean4 === 'Обійми', r.clean4);
        check('"Виконавець - Назва" розбирається', r.split1 && r.split1.artist === 'Океан Ельзи' && r.split1.title === 'Обійми', r.split1);
        check('без дефіса — немає розбору', r.split2 === null && r.split3 === null, [r.split2, r.split3]);
        check('порівняння виконавців з кирилицею й пунктуацією', r.match1 === true);
        check('дуже короткі рядки — лише точний збіг', r.match2 === false);
        check('"Bangarang (Radio Edit)" ~ "Bangarang"', r.match3 === true);
        check('різні виконавці не збігаються', r.match4 === false);
        check('тривалість: число / m:ss / h:mm:ss / нічого', JSON.stringify(r.dur) === JSON.stringify([200, 225, 3723, 0]), r.dur);
        check('запити: спершу розібраний виконавець, потім завантажувач',
            r.queries.length >= 2 && r.queries[0].artist === 'Океан Ельзи' && r.queries[0].title === 'Обійми' && r.queries[1].artist === 'Music Label', r.queries);
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[2] Кнопка й вікно: відкриття, порожній стан, клавіатура');
    {
        const { page, state } = await setup(browser);
        const btnBefore = await page.evaluate(() => ({ aria: document.getElementById('lyrics-btn').getAttribute('aria-expanded'), hidden: document.getElementById('lyrics-overlay').getAttribute('aria-hidden') }));
        check('початково вікно закрите', btnBefore.aria === 'false' && btnBefore.hidden === 'true', btnBefore);

        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        const idle = await page.evaluate(() => ({
            title: document.querySelector('.lyrics-status-title').textContent,
            btnActive: document.getElementById('lyrics-btn').classList.contains('active'),
            aria: document.getElementById('lyrics-btn').getAttribute('aria-expanded'),
            focusId: document.activeElement && document.activeElement.id,
            volumePopup: !!document.querySelector('.volume-popup')
        }));
        check('без треку: стан "Тут буде текст пісні"', idle.title === 'Тут буде текст пісні', idle);
        check('кнопка підсвічується, aria-expanded=true', idle.btnActive && idle.aria === 'true');
        check('фокус на кнопці закриття', idle.focusId === 'lyrics-close', idle.focusId);
        check('вікно гучності НЕ відкривається від кнопки тексту', idle.volumePopup === false);
        check('без треку запитів до LRCLIB немає', state.lrclibLog.length === 0, state.lrclibLog);
        await page.screenshot({ path: OUT + '/01-idle-desktop.png' });

        await page.keyboard.press('Escape');
        await sleep(350);
        const closed = await page.evaluate(() => ({ open: document.getElementById('lyrics-overlay').classList.contains('open'), focusId: document.activeElement && document.activeElement.id, btnActive: document.getElementById('lyrics-btn').classList.contains('active'), frame: lyricsFrame }));
        check('Escape закриває вікно', closed.open === false && closed.btnActive === false, closed);
        check('фокус повертається на кнопку тексту', closed.focusId === 'lyrics-btn', closed.focusId);

        // Повторне відкриття → закриття кліком по фону та кнопкою "×"
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        await page.mouse.click(20, 400);
        await sleep(350);
        check('клік по затемненому фону закриває', await page.evaluate(() => !document.getElementById('lyrics-overlay').classList.contains('open')));
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        await page.click('#lyrics-close');
        await sleep(350);
        check('кнопка × закриває', await page.evaluate(() => !document.getElementById('lyrics-overlay').classList.contains('open')));
        // Повторне натискання самої кнопки в плеєрі працює як перемикач (вона над затемненням)
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        await page.click('#lyrics-btn');
        await sleep(350);
        check('кнопка в плеєрі — перемикач (доступна при відкритому вікні)', await page.evaluate(() => !document.getElementById('lyrics-overlay').classList.contains('open')));
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[3] Підсвічування в реальному часі (локальний трек)');
    {
        const { page, state } = await setup(browser);
        await playRow(page, 'Digital Soul');
        await page.waitForFunction(() => !document.getElementById('audio').paused && document.getElementById('audio').currentTime > 0);
        await page.click('#lyrics-btn');
        await page.waitForSelector('.lyrics-lines.is-synced');

        const meta = await page.evaluate(() => ({ title: document.getElementById('lyrics-title').textContent, artist: document.getElementById('lyrics-artist').textContent, badge: document.getElementById('lyrics-badge').textContent, badgeHidden: document.getElementById('lyrics-badge').hidden, hint: document.getElementById('lyrics-hint').textContent, bg: getComputedStyle(document.querySelector('.lyrics-window')).getPropertyValue('--lyrics-cover') }));
        check('шапка: назва й виконавець', meta.title === 'Digital Soul' && meta.artist === 'Chrome Static', meta);
        check('бейдж "Синхронізовано"', meta.badge === 'Синхронізовано' && meta.badgeHidden === false, meta.badge);
        check('CSS-змінна обкладинки виставлена', meta.bg.indexOf('url(') !== -1, meta.bg);
        check('запит /api/get із назвою, виконавцем і тривалістю 252', state.lrclibLog.some((l) => l.indexOf('/api/get') === 0 && l.indexOf('track_name=Digital%20Soul') !== -1 && l.indexOf('artist_name=Chrome%20Static') !== -1 && l.indexOf('duration=252') !== -1), state.lrclibLog);

        // Точність: активний рядок має відповідати audio.currentTime протягом ~7 с
        let badSamples = 0; let samples = 0; let seenChanges = new Set();
        const started = Date.now();
        while (Date.now() - started < 7000) {
            const s = await snapshot(page);
            if (!s.paused) {
                samples++;
                const lo = expectedIndex(s.times, s.t + 0.2 - 0.12);
                const hi = expectedIndex(s.times, s.t + 0.2 + 0.12);
                seenChanges.add(s.active);
                if (s.active < lo || s.active > hi) { badSamples++; }
            }
            await sleep(120);
        }
        check('відібрано достатньо зразків', samples > 30, samples);
        check('активний рядок збігається з audio.currentTime (усі зразки)', badSamples === 0, { badSamples: badSamples, samples: samples });
        check('рядки справді змінювалися (>= 4 різні)', seenChanges.size >= 4, Array.from(seenChanges));

        // Автопрокрутка: активний рядок біля центру області
        await sleep(700);
        const center = await page.evaluate(() => {
            const b = document.getElementById('lyrics-body').getBoundingClientRect();
            const el = document.querySelector('.lyrics-line.is-active');
            const r = el.getBoundingClientRect();
            return { delta: Math.abs((r.top + r.height / 2) - (b.top + b.height / 2)), scrollTop: document.getElementById('lyrics-body').scrollTop };
        });
        check('активний рядок по центру області (±70px)', center.delta < 70, center);
        check('область прокручена', center.scrollTop > 50, center);

        // Класи: is-past для минулих, один is-active
        const cls = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.lyrics-line'));
            const a = items.findIndex((e) => e.classList.contains('is-active'));
            return { actives: items.filter((e) => e.classList.contains('is-active')).length, pastOk: items.every((e, i) => e.classList.contains('is-past') === (i < a)), a: a };
        });
        check('рівно один активний рядок', cls.actives === 1, cls);
        check('усі рядки до активного мають is-past', cls.pastOk, cls);
        await page.screenshot({ path: OUT + '/02-synced-desktop.png' });

        // Клік по рядку перемотує
        await page.evaluate(() => { document.querySelectorAll('.lyrics-line')[12].scrollIntoView({ block: 'center' }); });
        await page.click('.lyrics-line:nth-child(13)');
        await sleep(400);
        const seek = await page.evaluate(() => ({ t: document.getElementById('audio').currentTime, target: lyricsLines[12].time, active: Array.from(document.querySelectorAll('.lyrics-line')).findIndex((e) => e.classList.contains('is-active')) }));
        check('клік по рядку перемотує аудіо', Math.abs(seek.t - seek.target) < 1.2, seek);
        check('після перемотки активний саме цей рядок', seek.active === 12, seek);

        // Ручний скрол призупиняє автопрокрутку
        await page.mouse.move(640, 300);
        await page.mouse.wheel(0, -600);
        await sleep(150);
        const before = await page.evaluate(() => document.getElementById('lyrics-body').scrollTop);
        await sleep(2200);   // за цей час зміниться рядок, але прокрутка не повинна "втікати"
        const after = await page.evaluate(() => document.getElementById('lyrics-body').scrollTop);
        check('після ручного скролу автопрокрутка на паузі (~3 с)', Math.abs(after - before) < 5, { before: before, after: after });
        await sleep(1500);
        await page.evaluate(() => { const a = document.getElementById('audio'); if (a.paused) { a.play(); } });
        await sleep(2500);
        const resumed = await page.evaluate(() => { const b = document.getElementById('lyrics-body').getBoundingClientRect(); const r = document.querySelector('.lyrics-line.is-active').getBoundingClientRect(); return Math.abs((r.top + r.height / 2) - (b.top + b.height / 2)); });
        check('після паузи автопрокрутка відновлюється', resumed < 90, resumed);

        // Пауза зупиняє цикл кадрів, закриття теж
        await page.evaluate(() => document.getElementById('audio').pause());
        await sleep(100);
        check('пауза зупиняє requestAnimationFrame-цикл', (await page.evaluate(() => lyricsFrame)) === 0);
        await page.evaluate(() => document.getElementById('audio').play());
        await sleep(200);
        check('play знову запускає цикл', (await page.evaluate(() => lyricsFrame)) !== 0);
        await page.click('#lyrics-close');
        await sleep(200);
        check('закриття вікна зупиняє цикл', (await page.evaluate(() => lyricsFrame)) === 0);

        // Повторне відкриття: без нового запиту (кеш) і одразу на потрібному рядку
        const reqsBefore = state.lrclibLog.length;
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        await sleep(300);
        check('повторне відкриття не робить нових запитів', state.lrclibLog.length === reqsBefore, state.lrclibLog.slice(reqsBefore));
        const re = await snapshot(page);
        check('після повторного відкриття підсвічування актуальне', re.active === expectedIndex(re.times, re.t + 0.2) || re.active === expectedIndex(re.times, re.t + 0.5), re);
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[4] Треки Audius: брудні назви, безпека співставлення, різні стани');
    {
        const { page, state } = await setup(browser, { audius: true });
        await page.waitForSelector('#tracks-list .song-row:has(.song-title:text-is("Skrillex - Bangarang (feat. Sirah) [Free Download]"))');
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');

        // A1: "Виконавець - Назва (Official Video)", завантажувач — лейбл
        await playRow(page, 'Океан Ельзи - Обійми (Official Video)');
        await page.waitForSelector('.lyrics-lines.is-synced');
        let text = await page.evaluate(() => document.querySelector('.lyrics-line').textContent);
        check('A1: знайдено за розібраним "Виконавець - Назва"', text.indexOf('Обійми—рядок') === 0, text);
        check('A1: у запиті очищена назва й тривалість 200', state.lrclibLog.some((l) => l.indexOf('track_name=%D0%9E%D0%B1%D1%96%D0%B9%D0%BC%D0%B8') !== -1 && l.indexOf('duration=200') !== -1), state.lrclibLog);
        check('A1: шапка показує повну оригінальну назву', (await page.evaluate(() => document.getElementById('lyrics-title').textContent)) === 'Океан Ельзи - Обійми (Official Video)');
        await page.screenshot({ path: OUT + '/03-audius-desktop.png' });

        // A2: feat + [Free Download]
        await playRow(page, 'Skrillex - Bangarang (feat. Sirah) [Free Download]');
        await page.waitForFunction(() => { const l = document.querySelector('.lyrics-line'); return l && l.textContent.indexOf('Bangarang line') === 0; });
        check('A2: "feat." і [Free Download] прибрано — текст знайдено', true);

        // A3: інший виконавець з тією ж назвою → НЕ показувати чужий текст
        await playRow(page, 'Unknown Beat');
        await page.waitForSelector('.lyrics-status-title');
        check('A3: чужий виконавець відхилено → "Тексту не знайдено"', (await page.evaluate(() => document.querySelector('.lyrics-status-title').textContent)) === 'Тексту не знайдено');
        check('A3: бейдж прихований', await page.evaluate(() => document.getElementById('lyrics-badge').hidden));

        // A4: та сама пісня, але тривалість відрізняється на 50 с → НЕ показувати
        await playRow(page, 'Slowed Track');
        await page.waitForFunction(() => { const t = document.querySelector('.lyrics-status-title'); return t && document.getElementById('lyrics-title').textContent === 'Slowed Track'; });
        await sleep(300);
        check('A4: версія з іншою тривалістю (Δ50с) відхилена', (await page.evaluate(() => document.querySelector('.lyrics-status-title').textContent)) === 'Тексту не знайдено');

        // A5: лише простий текст
        await playRow(page, 'Plain Only');
        await page.waitForSelector('.lyrics-lines.is-plain');
        const plain = await page.evaluate(() => ({ badge: document.getElementById('lyrics-badge').textContent, isPlainClass: document.getElementById('lyrics-badge').classList.contains('is-plain'), lines: document.querySelectorAll('.lyrics-line').length, active: document.querySelectorAll('.lyrics-line.is-active').length, blank: document.querySelectorAll('.lyrics-line.is-blank').length, hint: document.getElementById('lyrics-hint').textContent, cursor: getComputedStyle(document.querySelector('.lyrics-line')).cursor }));
        check('A5: бейдж "Без синхронізації"', plain.badge === 'Без синхронізації' && plain.isPlainClass, plain);
        check('A5: без підсвічування, 5 рядків із 1 порожнім розділювачем', plain.active === 0 && plain.lines === 5 && plain.blank === 1, plain);
        check('A5: курсор не "pointer" (перемотка недоступна)', plain.cursor !== 'pointer', plain.cursor);
        await page.screenshot({ path: OUT + '/04-plain-desktop.png' });

        // A6: інструментал
        await playRow(page, 'Just Instrumental');
        await page.waitForFunction(() => { const t = document.querySelector('.lyrics-status-title'); return t && t.textContent === 'Інструментальний трек'; });
        check('A6: інструментал → "Інструментальний трек"', true);

        // A8: точного збігу немає → знаходимо через пошук, відкидаючи версію на 400 с
        await playRow(page, 'Search Only');
        await page.waitForFunction(() => { const l = document.querySelector('.lyrics-line'); return l && (l.textContent.indexOf('Знайдено') === 0 || l.textContent.indexOf('WRONG') === 0); });
        text = await page.evaluate(() => document.querySelector('.lyrics-line').textContent);
        check('A8: через /api/search обрано версію Δ2с, а не Δ190с', text.indexOf('Знайдено') === 0, text);

        // A7: помилка мережі → стан помилки, не кешується, "Спробувати ще раз" працює
        await playRow(page, 'Flaky Song');
        await page.waitForSelector('.lyrics-retry');
        check('A7: 503 → "Не вдалося завантажити текст" + кнопка повтору', (await page.evaluate(() => document.querySelector('.lyrics-status-title').textContent)) === 'Не вдалося завантажити текст');
        await page.screenshot({ path: OUT + '/05-error-desktop.png' });
        state.flakyOk = true;
        await page.click('.lyrics-retry');
        await page.waitForFunction(() => { const l = document.querySelector('.lyrics-line'); return l && l.textContent.indexOf('Flaky') === 0; });
        check('A7: після "Спробувати ще раз" текст з’являється', true);

        // Швидке перемикання: старий запит не має перезаписати новий
        const slowLog = state.lrclibLog.length;
        await page.evaluate(() => { document.getElementById('lyrics-close').click(); });
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[5] Зміна треку, поки вікно відкрите (Далі / гонка запитів)');
    {
        const { page, state } = await setup(browser);
        await playRow(page, 'Digital Soul');
        await page.click('#lyrics-btn');
        await page.waitForSelector('.lyrics-lines.is-synced');
        // Далі → наступний локальний трек (Rainy Rooftops) — тексту немає
        await page.evaluate(() => playNext());
        await page.waitForFunction(() => document.getElementById('lyrics-title').textContent === 'Rainy Rooftops');
        await page.waitForSelector('.lyrics-status-title');
        check('перехід до наступного треку оновлює шапку й стан', (await page.evaluate(() => document.querySelector('.lyrics-status-title').textContent)) === 'Тексту не знайдено');
        check('список рядків попереднього треку прибрано', (await page.evaluate(() => document.querySelectorAll('.lyrics-line').length)) === 0);

        // Гонка: швидко Digital Soul → Rainy → Digital Soul; підсумок має відповідати останньому
        await page.evaluate(() => { setTrackList(window.localTracks, 0); playSong('Rainy Rooftops'); playSong('Electric Moonlight'); playSong('Digital Soul'); });
        await page.waitForSelector('.lyrics-lines.is-synced');
        await sleep(600);
        const final = await page.evaluate(() => ({ title: document.getElementById('lyrics-title').textContent, lines: document.querySelectorAll('.lyrics-line').length, status: !!document.querySelector('.lyrics-status') }));
        check('після швидких перемикань відображається текст останнього треку', final.title === 'Digital Soul' && final.lines > 10 && !final.status, final);

        // Закрите вікно + зміна треку → зайвих запитів немає
        await page.click('#lyrics-close');
        await sleep(300);
        const n = state.lrclibLog.length;
        await page.evaluate(() => playSong('Midnight Lofi'));
        await sleep(600);
        check('коли вікно закрите, зміна треку не викликає запитів', state.lrclibLog.length === n, state.lrclibLog.slice(n));
        await page.click('#lyrics-btn');
        await page.waitForSelector('.lyrics-status-title');
        check('відкриття вікна підтягує текст поточного треку', (await page.evaluate(() => document.getElementById('lyrics-title').textContent)) === 'Midnight Lofi');
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[6] Розкладка: телефон, Z-порядок, плеєр залишається доступним');
    {
        const { page, state } = await setup(browser, { viewport: { width: 390, height: 844 } });
        await playRow(page, 'Digital Soul');
        await page.click('#lyrics-btn');
        await page.waitForSelector('.lyrics-lines.is-synced');
        await sleep(2500);
        const m = await page.evaluate(() => {
            const w = document.querySelector('.lyrics-window').getBoundingClientRect();
            const f = document.querySelector('footer.player-bar').getBoundingClientRect();
            const btn = document.getElementById('lyrics-btn').getBoundingClientRect();
            const topEl = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
            const body = document.getElementById('lyrics-body');
            return { winTop: w.top, winBottom: w.bottom, winLeft: w.left, winRight: w.right, footerTop: f.top, vw: window.innerWidth, hScroll: body.scrollWidth > body.clientWidth, btnOnTop: !!(topEl && topEl.closest('#lyrics-btn')), docHScroll: document.documentElement.scrollWidth > window.innerWidth };
        });
        check('телефон: вікно на всю ширину', m.winLeft <= 1 && Math.abs(m.winRight - m.vw) <= 1, m);
        check('телефон: вікно не заходить під плеєр (зазор ≤ 8px)', m.winBottom <= m.footerTop + 8, m);
        check('телефон: кнопка тексту над затемненням і натискається', m.btnOnTop, m);
        check('телефон: немає горизонтального скролу в тексті', m.hScroll === false, m);
        await page.screenshot({ path: OUT + '/06-synced-mobile.png' });
        check('без помилок у консолі', state.errors.length === 0, state.errors);
    }
    {
        const { page } = await setup(browser, { viewport: { width: 820, height: 1100 } });
        await playRow(page, 'Digital Soul');
        await page.click('#lyrics-btn');
        await page.waitForSelector('.lyrics-lines.is-synced');
        await sleep(2500);
        const t = await page.evaluate(() => { const w = document.querySelector('.lyrics-window').getBoundingClientRect(); const f = document.querySelector('footer.player-bar').getBoundingClientRect(); return { winBottom: w.bottom, footerTop: f.top, h: w.height }; });
        check('планшет: вікно над плеєром, висота обмежена (≤720)', t.winBottom <= t.footerTop && t.h <= 721, t);
        await page.screenshot({ path: OUT + '/07-synced-tablet.png' });
    }

    /* ------------------------------------------------------------------ */
    console.log('\n[7] prefers-reduced-motion');
    {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            if (url.protocol === 'file:') { return route.continue(); }
            if (url.hostname === 'lrclib.net') { return route.fulfill(lrclib(url, {})); }
            if (url.pathname.endsWith('.mp3')) { return route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: wav }); }
            if (url.hostname === 'images.unsplash.com') { return route.fulfill({ status: 200, headers: { 'Content-Type': 'image/png' }, body: cover1 }); }
            return route.abort();
        });
        await page.goto(SITE);
        await page.waitForSelector('#tracks-list .song-row');
        await page.$eval('#tracks-list .song-row', (el) => el.click());
        await page.click('#lyrics-btn');
        await page.waitForSelector('#lyrics-overlay.open');
        const d = await page.evaluate(() => ({ overlayOpen: getComputedStyle(document.getElementById('lyrics-overlay')).transitionDuration, win: getComputedStyle(document.querySelector('.lyrics-window')).transitionDuration, media: prefersReducedMotion() }));
        check('reduced-motion: перехід відкритого оверлея вимкнено', d.overlayOpen === '0s', d);
        check('reduced-motion: перехід самого вікна вимкнено', d.win === '0s', d);
        check('reduced-motion: JS визначає налаштування', d.media === true, d);
        await context.close();
    }

    await browser.close();
    console.log('\n==== ' + passed + ' passed, ' + failed + ' failed ====');
    process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(2); });