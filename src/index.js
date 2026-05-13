// ====================================================
// TAMA AI - Main Application
// AI แจ้งเตือนข่าวสรุปรายวัน + ข่าวด่วนผ่าน LINE
// ====================================================

require('dotenv').config();

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { fetchAllNews } = require('./newsFetcher');
const { summarizeNews } = require('./summarizer');
const { sendLineNotify, sendErrorNotify } = require('./lineNotify');
const { checkNewPosts, formatPostsForLine } = require('./socialMonitor');
const { startWebhookServer } = require('./webhook');
const logger = require('./logger');

const URGENT_STATE_FILE = path.join(__dirname, '..', 'data', 'urgent_news_state.json');
const DEFAULT_URGENT_KEYWORDS = [
  'ด่วน',
  'ข่าวด่วน',
  'urgent',
  'breaking',
  'flash',
  'crash',
  'halt',
  'circuit breaker',
  'fed',
  'fomc',
  'rate hike',
  'rate cut',
  'tariff',
  'sanction',
  'bankruptcy',
  'default',
  'สงคราม',
  'แผ่นดินไหว',
  'น้ำมัน',
];

function loadUrgentState() {
  try {
    if (fs.existsSync(URGENT_STATE_FILE)) {
      const raw = fs.readFileSync(URGENT_STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (error) {
    logger.warn(`Could not load urgent state: ${error.message}`);
  }

  return { sentKeys: [] };
}

function saveUrgentState(state) {
  try {
    const dir = path.dirname(URGENT_STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(URGENT_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    logger.warn(`Could not save urgent state: ${error.message}`);
  }
}

function getUrgentKeywords() {
  const fromEnv = (process.env.URGENT_NEWS_KEYWORDS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_URGENT_KEYWORDS;
}

function isRecentNews(item) {
  const hours = Number(process.env.URGENT_NEWS_RECENT_HOURS || '8');
  const maxAgeMs = Math.max(hours, 1) * 60 * 60 * 1000;
  const ts = Date.parse(item.date || '');

  if (!Number.isFinite(ts)) {
    return true;
  }

  return Date.now() - ts <= maxAgeMs;
}

function getUrgentItems(newsData) {
  const keywords = getUrgentKeywords();
  const allItems = Object.values(newsData.news || {}).flatMap((items) => items || []);

  return allItems
    .filter((item) => {
      if (!isRecentNews(item)) return false;
      const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    })
    .slice(0, 8);
}

function buildUrgentNewsData(baseNewsData, urgentItems) {
  const grouped = {
    'stock-th': urgentItems.filter((n) => n.category === 'stock-th'),
    'stock-us': urgentItems.filter((n) => n.category === 'stock-us'),
    'stock-cn': urgentItems.filter((n) => n.category === 'stock-cn'),
    crypto: urgentItems.filter((n) => n.category === 'crypto'),
    forex: urgentItems.filter((n) => n.category === 'forex'),
    general: urgentItems.filter((n) => n.category === 'general'),
  };

  return {
    news: grouped,
    totalCount: urgentItems.length,
    cryptoPrices: baseNewsData.cryptoPrices || [],
    goldPrice: baseNewsData.goldPrice || null,
    fetchedAt: new Date().toISOString(),
  };
}

function getUrgentItemKey(item) {
  const anchor = item.link || item.title || '';
  return `${item.source || 'unknown'}|${anchor}`;
}

// ตรวจสอบ environment variables ที่จำเป็น
function validateConfig() {
  const required = ['GEMINI_API_KEY', 'LINE_CHANNEL_ACCESS_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please create a .env file with the required variables. See .env.example');
    process.exit(1);
  }
}

/**
 * Job หลัก: ดึงข่าว -> สรุปด้วย AI -> ส่ง LINE
 */
async function runNewsJob() {
  const startTime = Date.now();
  logger.info('========================================');
  logger.info('TAMA AI - Starting news job...');
  logger.info('========================================');

  try {
    // Step 1: ดึงข่าวจากทุกแหล่ง
    logger.info('[1/3] Fetching investment news...');
    const newsData = await fetchAllNews();

    if (newsData.totalCount === 0) {
      logger.warn('No news found. Skipping this cycle.');
      return;
    }

    // Step 2: ใช้ AI สรุปข่าว
    logger.info('[2/3] AI summarizing news...');
    const summary = await summarizeNews(newsData);

    if (!summary || summary.trim().length === 0) {
      logger.warn('AI returned empty summary. Skipping.');
      return;
    }

    // Step 3: ส่งผ่าน LINE
    logger.info('[3/3] Sending to LINE...');
    await sendLineNotify(summary);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Job completed successfully in ${duration}s`);
  } catch (error) {
    logger.error(`Job failed: ${error.message}`);
    await sendErrorNotify(
      `Job failed at ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}\nError: ${error.message}`
    );
  }
}

/**
 * Job ข่าวด่วน: คัดเฉพาะข่าวสำคัญแล้วส่งเพิ่มทันที (กันส่งซ้ำ)
 */
async function runUrgentNewsJob() {
  logger.info('Checking urgent investment news...');

  try {
    const newsData = await fetchAllNews();
    if (newsData.totalCount === 0) {
      logger.info('No news found for urgent check.');
      return;
    }

    const urgentItems = getUrgentItems(newsData);
    if (urgentItems.length === 0) {
      logger.info('No urgent news found in this cycle.');
      return;
    }

    const state = loadUrgentState();
    const sent = new Set(state.sentKeys || []);
    const newUrgentItems = urgentItems.filter((item) => !sent.has(getUrgentItemKey(item)));

    if (newUrgentItems.length === 0) {
      logger.info('Urgent news exists but already sent before.');
      return;
    }

    const urgentNewsData = buildUrgentNewsData(newsData, newUrgentItems);
    const summary = await summarizeNews(urgentNewsData);

    if (!summary || summary.trim().length === 0) {
      logger.warn('AI returned empty urgent summary. Skipping.');
      return;
    }

    const prefix = '🚨 ข่าวด่วนการลงทุน (อัปเดตเพิ่มเติม)\n';
    await sendLineNotify(`${prefix}${summary}`);

    const updatedKeys = [
      ...new Set([...sent, ...newUrgentItems.map((item) => getUrgentItemKey(item))]),
    ].slice(-500);

    saveUrgentState({
      sentKeys: updatedKeys,
      updatedAt: new Date().toISOString(),
    });

    logger.info(`Sent ${newUrgentItems.length} urgent news item(s)`);
  } catch (error) {
    logger.error(`Urgent news job failed: ${error.message}`);
  }
}

/**
 * Job ตรวจสอบโพสต์ Elon & Trump
 */
async function runSocialJob() {
  logger.info('Checking for new posts from Elon & Trump...');

  try {
    const newPosts = await checkNewPosts();

    if (newPosts.length > 0) {
      const message = formatPostsForLine(newPosts);
      if (message) {
        await sendLineNotify(message);
        logger.info(`Sent ${newPosts.length} new social post(s) to LINE`);
      }
    } else {
      logger.info('No new posts from tracked accounts');
    }
  } catch (error) {
    logger.error(`Social monitor failed: ${error.message}`);
  }
}

/**
 * Start the application
 */
async function main() {
  logger.info('🤖 TAMA AI - Investment News Bot Starting...');
  validateConfig();

  const cronSchedule = process.env.CRON_SCHEDULE || '0 11 * * *'; // Default: วันละ 1 ครั้ง เวลา 11:00
  const urgentSchedule = process.env.URGENT_CRON_SCHEDULE || '*/15 * * * *'; // Default: ตรวจข่าวด่วนทุก 15 นาที
  const socialSchedule = process.env.SOCIAL_CRON_SCHEDULE || '*/5 * * * *'; // Default: ทุก 5 นาที
  logger.info(`News schedule: ${cronSchedule}`);
  logger.info(`Urgent news schedule: ${urgentSchedule}`);
  logger.info(`Social monitor schedule: ${socialSchedule}`);
  logger.info(`Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);

  // เริ่ม Webhook Server สำหรับรับข้อความ LINE
  startWebhookServer();

  // รันทันทีเฉพาะตอนที่กำหนดชัดเจน
  if (process.env.RUN_ON_START === 'true') {
    logger.info('Running initial jobs...');
    await runNewsJob();
    await runUrgentNewsJob();
    await runSocialJob();
  }

  // ตั้ง cron job ข่าวสรุปรายวัน เวลา 11:00
  cron.schedule(cronSchedule, async () => {
    await runNewsJob();
  }, {
    timezone: 'Asia/Bangkok',
  });

  // ตั้ง cron job ตรวจข่าวด่วน ถ้ามีค่อยส่งเพิ่ม
  cron.schedule(urgentSchedule, async () => {
    await runUrgentNewsJob();
  }, {
    timezone: 'Asia/Bangkok',
  });

  // ตั้ง cron job ตรวจโพสต์ Elon & Trump ทุก 5 นาที
  cron.schedule(socialSchedule, async () => {
    await runSocialJob();
  }, {
    timezone: 'Asia/Bangkok',
  });

  logger.info(`Cron jobs scheduled. Waiting for next execution...`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down TAMA AI...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down TAMA AI...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
