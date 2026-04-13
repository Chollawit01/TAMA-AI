// ====================================================
// TAMA AI - Main Application
// AI แจ้งเตือนข่าวการลงทุนผ่าน LINE ทุก 1 ชั่วโมง
// ====================================================

require('dotenv').config();

const cron = require('node-cron');
const { fetchAllNews } = require('./newsFetcher');
const { summarizeNews } = require('./summarizer');
const { sendLineNotify, sendErrorNotify } = require('./lineNotify');
const { checkNewPosts, formatPostsForLine } = require('./socialMonitor');
const { startWebhookServer } = require('./webhook');
const logger = require('./logger');

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

  const cronSchedule = process.env.CRON_SCHEDULE || '0 * * * *'; // Default: ทุกชั่วโมง (นาทีที่ 0)
  const socialSchedule = process.env.SOCIAL_CRON_SCHEDULE || '*/5 * * * *'; // Default: ทุก 5 นาที
  logger.info(`News schedule: ${cronSchedule}`);
  logger.info(`Social monitor schedule: ${socialSchedule}`);
  logger.info(`Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);

  // เริ่ม Webhook Server สำหรับรับข้อความ LINE
  startWebhookServer();

  // รันครั้งแรกทันที
  if (process.env.RUN_ON_START !== 'false') {
    logger.info('Running initial jobs...');
    await runNewsJob();
    await runSocialJob();
  }

  // ตั้ง cron job ข่าว ทุก 1 ชั่วโมง
  cron.schedule(cronSchedule, async () => {
    await runNewsJob();
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
