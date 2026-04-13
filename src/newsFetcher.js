// ====================================================
// TAMA AI - Investment News Fetcher
// ดึงข่าวการลงทุนจากหลายแหล่ง (หุ้น, คริปโต, ทอง, Forex, กองทุน)
// ====================================================

const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const logger = require('./logger');

const rssParser = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'TAMA-AI-Bot/1.0',
  },
});

// --------------- RSS News Sources ---------------
const RSS_SOURCES = [
  // === Thai Stock Market ===
  {
    name: 'Investing.com TH',
    url: 'https://th.investing.com/rss/news.rss',
    category: 'stock-th',
  },
  {
    name: 'SET News',
    url: 'https://www.set.or.th/set/rss.do',
    category: 'stock-th',
  },
  {
    name: 'ThanSettakij',
    url: 'https://www.thansettakij.com/rss',
    category: 'stock-th',
  },
  {
    name: 'Kaohoon',
    url: 'https://www.kaohoon.com/feed',
    category: 'stock-th',
  },
  // === US Stock Market ===
  {
    name: 'CNBC Markets',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
    category: 'stock-us',
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'stock-us',
  },
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'stock-us',
  },
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'stock-us',
  },
  // === China Stock Market ===
  {
    name: 'SCMP Business',
    url: 'https://www.scmp.com/rss/5/feed',
    category: 'stock-cn',
  },
  {
    name: 'Caixin Global',
    url: 'https://www.caixinglobal.com/rss.html',
    category: 'stock-cn',
  },
  {
    name: 'CNBC Asia',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390',
    category: 'stock-cn',
  },
  // === Crypto ===
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'crypto',
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'crypto',
  },
  // === Forex ===
  {
    name: 'ForexLive',
    url: 'https://www.forexlive.com/feed',
    category: 'forex',
  },
];

/**
 * ดึงข่าวจาก RSS Feed
 */
async function fetchRSSNews(source) {
  try {
    const feed = await rssParser.parseURL(source.url);
    const items = (feed.items || []).slice(0, 5).map((item) => ({
      title: item.title || '',
      link: item.link || '',
      summary: item.contentSnippet || item.content || '',
      date: item.pubDate || item.isoDate || '',
      source: source.name,
      category: source.category,
    }));
    logger.info(`Fetched ${items.length} items from ${source.name}`);
    return items;
  } catch (error) {
    logger.warn(`Failed to fetch RSS from ${source.name}: ${error.message}`);
    return [];
  }
}

/**
 * ดึงราคาคริปโตจาก CoinGecko (free API)
 */
async function fetchCryptoPrices() {
  try {
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: 'bitcoin,ethereum,binancecoin,solana,ripple',
          vs_currencies: 'usd,thb',
          include_24hr_change: true,
        },
        timeout: 10000,
      }
    );

    const prices = Object.entries(data).map(([coin, info]) => ({
      coin: coin.toUpperCase(),
      usd: info.usd,
      thb: info.thb,
      change24h: info.usd_24h_change ? info.usd_24h_change.toFixed(2) : 'N/A',
    }));

    logger.info(`Fetched crypto prices for ${prices.length} coins`);
    return prices;
  } catch (error) {
    logger.warn(`Failed to fetch crypto prices: ${error.message}`);
    return [];
  }
}

/**
 * ดึงราคาทองจาก API
 */
async function fetchGoldPrice() {
  try {
    const { data } = await axios.get(
      'https://www.goldapi.io/api/XAU/USD',
      {
        headers: { 'x-access-token': process.env.GOLD_API_KEY || '' },
        timeout: 10000,
      }
    );
    logger.info('Fetched gold price');
    return {
      price: data.price,
      change: data.ch,
      changePercent: data.chp,
    };
  } catch (error) {
    logger.warn(`Failed to fetch gold price: ${error.message}`);
    // Fallback - return null, AI will skip gold section
    return null;
  }
}

/**
 * ดึงข่าวทั้งหมดจากทุกแหล่ง
 */
async function fetchAllNews() {
  logger.info('Starting to fetch all investment news...');

  // Fetch RSS feeds in parallel
  const rssPromises = RSS_SOURCES.map((source) => fetchRSSNews(source));
  const rssResults = await Promise.allSettled(rssPromises);
  const allNews = rssResults
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Fetch market data in parallel
  const [cryptoPrices, goldPrice] = await Promise.allSettled([
    fetchCryptoPrices(),
    fetchGoldPrice(),
  ]).then((results) =>
    results.map((r) => (r.status === 'fulfilled' ? r.value : null))
  );

  // Group news by category
  const grouped = {
    'stock-th': allNews.filter((n) => n.category === 'stock-th'),
    'stock-us': allNews.filter((n) => n.category === 'stock-us'),
    'stock-cn': allNews.filter((n) => n.category === 'stock-cn'),
    crypto: allNews.filter((n) => n.category === 'crypto'),
    forex: allNews.filter((n) => n.category === 'forex'),
    general: allNews.filter((n) => n.category === 'general'),
  };

  logger.info(
    `Total news fetched: ${allNews.length} | Crypto prices: ${cryptoPrices ? 'OK' : 'Failed'} | Gold: ${goldPrice ? 'OK' : 'Failed'}`
  );

  return {
    news: grouped,
    totalCount: allNews.length,
    cryptoPrices: cryptoPrices || [],
    goldPrice,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { fetchAllNews, fetchCryptoPrices, fetchGoldPrice };
