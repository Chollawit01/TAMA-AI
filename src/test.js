// ====================================================
// TAMA AI - Test Script
// ทดสอบระบบทีละขั้นตอน
// ====================================================

require('dotenv').config();

const { fetchAllNews } = require('./newsFetcher');
const { summarizeNews } = require('./summarizer');
const { sendLineNotify } = require('./lineNotify');
const logger = require('./logger');

async function testFetch() {
  console.log('\n=== Test 1: Fetch News ===');
  const newsData = await fetchAllNews();
  console.log(`Total news: ${newsData.totalCount}`);
  console.log(`Crypto prices: ${newsData.cryptoPrices.length} coins`);
  console.log(`Gold price: ${newsData.goldPrice ? 'OK' : 'N/A'}`);
  Object.entries(newsData.news).forEach(([cat, items]) => {
    console.log(`  ${cat}: ${items.length} items`);
  });
  return newsData;
}

async function testSummarize(newsData) {
  console.log('\n=== Test 2: AI Summarize (Gemini) ===');
  if (!process.env.GEMINI_API_KEY) {
    console.log('SKIP: GEMINI_API_KEY not set');
    return null;
  }
  const summary = await summarizeNews(newsData);
  console.log(`Summary (${summary.length} chars):`);
  console.log(summary);
  return summary;
}

async function testLine(summary) {
  console.log('\n=== Test 3: LINE Messaging API ===');
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.log('SKIP: LINE_CHANNEL_ACCESS_TOKEN not set');
    return;
  }
  if (!summary) {
    summary = '🤖 TAMA AI Test Message\nThis is a test notification.';
  }
  await sendLineNotify(summary);
  console.log('LINE message sent!');
}

async function main() {
  const args = process.argv.slice(2);
  const testName = args[0] || 'all';

  console.log('🤖 TAMA AI - Test Suite');
  console.log(`Running test: ${testName}\n`);

  try {
    let newsData = null;
    let summary = null;

    if (testName === 'fetch' || testName === 'all') {
      newsData = await testFetch();
    }

    if (testName === 'summarize' || testName === 'all') {
      if (!newsData) newsData = await testFetch();
      summary = await testSummarize(newsData);
    }

    if (testName === 'line' || testName === 'all') {
      await testLine(summary);
    }

    console.log('\n✅ Tests completed!');
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

main();
