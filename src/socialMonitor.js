// ====================================================
// TAMA AI - Social Monitor
// ติดตามโพสต์ของ Elon Musk & Donald Trump บน X (Twitter)
// เมื่อมีโพสต์ใหม่ ส่งแจ้งเตือนผ่าน LINE ทันที
// ====================================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_FILE = path.join(__dirname, '..', 'data', 'last_posts.json');

// บัญชีที่ต้องการติดตาม
const TRACKED_ACCOUNTS = [
  {
    id: 'elonmusk',
    name: 'Elon Musk',
    emoji: '🚀',
    xUserId: '', // จะถูกเติมจาก API
  },
  {
    id: 'realDonaldTrump',
    name: 'Donald Trump',
    emoji: '🇺🇸',
    xUserId: '',
  },
];

/**
 * โหลด last seen post IDs จากไฟล์
 */
function loadLastPosts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    logger.warn(`Could not load last posts: ${error.message}`);
  }
  return {};
}

/**
 * บันทึก last seen post IDs
 */
function saveLastPosts(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    logger.warn(`Could not save last posts: ${error.message}`);
  }
}

// ======================================================
// Method 1: X (Twitter) API v2 (ต้องมี Bearer Token)
// ======================================================

/**
 * ดึง User ID จาก username (X API v2)
 */
async function getXUserId(username, bearerToken) {
  try {
    const { data } = await axios.get(
      `https://api.twitter.com/2/users/by/username/${username}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        timeout: 10000,
      }
    );
    return data.data?.id || null;
  } catch (error) {
    logger.warn(`Could not get X user ID for @${username}: ${error.message}`);
    return null;
  }
}

/**
 * ดึงโพสต์ล่าสุดจาก X API v2
 */
async function fetchXPosts(userId, username, bearerToken, sinceId) {
  try {
    const params = {
      max_results: 5,
      'tweet.fields': 'created_at,public_metrics,text',
      exclude: 'replies,retweets',
    };
    if (sinceId) {
      params.since_id = sinceId;
    }

    const { data } = await axios.get(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        params,
        timeout: 10000,
      }
    );

    const tweets = data.data || [];
    logger.info(`Fetched ${tweets.length} new tweets from @${username}`);
    return tweets.map((t) => ({
      id: t.id,
      text: t.text,
      createdAt: t.created_at,
      likes: t.public_metrics?.like_count || 0,
      retweets: t.public_metrics?.retweet_count || 0,
    }));
  } catch (error) {
    logger.warn(`Failed to fetch X posts for @${username}: ${error.message}`);
    return [];
  }
}

// ======================================================
// Method 2: RSSHub / Nitter fallback (ไม่ต้อง API key)
// ======================================================

const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub.moeyy.cn',
];

/**
 * ดึงโพสต์ผ่าน RSSHub (free, ไม่ต้อง API key)
 */
async function fetchViaRSSHub(username) {
  const RSSParser = require('rss-parser');
  const parser = new RSSParser({ timeout: 15000 });

  for (const instance of RSSHUB_INSTANCES) {
    try {
      const url = `${instance}/twitter/user/${username}`;
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, 5).map((item) => ({
        id: item.guid || item.link || '',
        text: item.contentSnippet || item.title || '',
        createdAt: item.pubDate || item.isoDate || '',
        likes: 0,
        retweets: 0,
        link: item.link || '',
      }));
      logger.info(`Fetched ${items.length} posts from RSSHub for @${username}`);
      return items;
    } catch (error) {
      logger.debug(`RSSHub ${instance} failed for @${username}: ${error.message}`);
      continue;
    }
  }
  logger.warn(`All RSSHub instances failed for @${username}`);
  return [];
}

// ======================================================
// Main: ตรวจสอบโพสต์ใหม่
// ======================================================

/**
 * ตรวจสอบโพสต์ใหม่จาก Elon & Trump
 * @returns {Array} โพสต์ใหม่ทั้งหมดที่ยังไม่เคยส่ง
 */
async function checkNewPosts() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const lastPosts = loadLastPosts();
  const allNewPosts = [];

  for (const account of TRACKED_ACCOUNTS) {
    let posts = [];

    // Try X API first (if token available)
    if (bearerToken) {
      // Get user ID if not cached
      if (!account.xUserId) {
        account.xUserId = await getXUserId(account.id, bearerToken);
      }

      if (account.xUserId) {
        const sinceId = lastPosts[account.id]?.lastId || null;
        posts = await fetchXPosts(account.xUserId, account.id, bearerToken, sinceId);
      }
    }

    // Fallback to RSSHub if no X API or no results
    if (posts.length === 0 && !bearerToken) {
      posts = await fetchViaRSSHub(account.id);

      // Filter out already-seen posts
      const lastSeenIds = lastPosts[account.id]?.seenIds || [];
      posts = posts.filter((p) => !lastSeenIds.includes(p.id));
    }

    if (posts.length > 0) {
      // Store new last ID
      lastPosts[account.id] = {
        lastId: posts[0].id,
        seenIds: posts.map((p) => p.id).slice(0, 20),
        lastCheck: new Date().toISOString(),
      };

      // Add account info to each post
      posts.forEach((post) => {
        allNewPosts.push({
          ...post,
          accountName: account.name,
          accountId: account.id,
          emoji: account.emoji,
        });
      });
    }
  }

  // Save updated last posts
  saveLastPosts(lastPosts);

  logger.info(`Total new posts found: ${allNewPosts.length}`);
  return allNewPosts;
}

/**
 * จัดรูปแบบโพสต์สำหรับ LINE
 */
function formatPostsForLine(posts) {
  if (posts.length === 0) return null;

  let message = '\n📢 VIP POST ALERT!\n';
  message += '━━━━━━━━━━━━━━━━━━\n';

  for (const post of posts) {
    const time = post.createdAt
      ? new Date(post.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
      : '';

    message += `\n${post.emoji} ${post.accountName} (@${post.accountId})\n`;
    if (time) message += `🕐 ${time}\n`;
    message += `\n${post.text}\n`;

    if (post.likes > 0 || post.retweets > 0) {
      message += `❤️ ${post.likes.toLocaleString()} | 🔄 ${post.retweets.toLocaleString()}\n`;
    }

    if (post.link) {
      message += `🔗 ${post.link}\n`;
    }

    message += '━━━━━━━━━━━━━━━━━━\n';
  }

  message += '\n🤖 TAMA AI - Social Monitor';

  return message;
}

module.exports = { checkNewPosts, formatPostsForLine };
