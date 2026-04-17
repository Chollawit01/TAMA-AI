// ====================================================
// TAMA AI - Chat Handler
// รับคำถามจากผู้ใช้ใน LINE แล้วตอบด้วย Gemini AI
// พร้อมดึงข้อมูลราคาหุ้น/คริปโต real-time
// ====================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const logger = require('./logger');

let genAI = null;
let chatSessions = new Map(); // เก็บ chat history ของแต่ละ user

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// ====================================================
// ดึงข้อมูลราคา real-time
// ====================================================

/**
 * ดึงราคาคริปโตจาก CoinGecko
 */
async function getCryptoPrice(query) {
  const coinMap = {
    btc: 'bitcoin', bitcoin: 'bitcoin',
    eth: 'ethereum', ethereum: 'ethereum',
    bnb: 'binancecoin', binance: 'binancecoin',
    sol: 'solana', solana: 'solana',
    xrp: 'ripple', ripple: 'ripple',
    doge: 'dogecoin', dogecoin: 'dogecoin',
    ada: 'cardano', cardano: 'cardano',
    dot: 'polkadot', polkadot: 'polkadot',
    matic: 'matic-network', polygon: 'matic-network',
    avax: 'avalanche-2', avalanche: 'avalanche-2',
    link: 'chainlink', chainlink: 'chainlink',
    sui: 'sui', near: 'near', apt: 'aptos', aptos: 'aptos',
  };

  const lowerQuery = query.toLowerCase().trim();
  const coinId = coinMap[lowerQuery];
  if (!coinId) return null;

  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: coinId,
          vs_currencies: 'usd,thb',
          include_24hr_change: true,
          include_market_cap: true,
          include_24hr_vol: true,
        },
        timeout: 8000,
      }
    );

    const info = data[coinId];
    if (!info) return null;

    return {
      coin: coinId.toUpperCase(),
      usd: info.usd,
      thb: info.thb,
      change24h: info.usd_24h_change?.toFixed(2),
      marketCap: info.usd_market_cap,
      volume24h: info.usd_24h_vol,
    };
  } catch {
    return null;
  }
}

/**
 * ดึงราคาหุ้นจาก Yahoo Finance
 */
async function getStockPrice(symbol) {
  try {
    // ลองหาชื่อหุ้นจากข้อความ
    const stockSymbol = extractStockSymbol(symbol);
    if (!stockSymbol) return null;

    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${stockSymbol}`,
      {
        params: { interval: '1d', range: '5d' },
        headers: { 'User-Agent': 'TAMA-AI-Bot/1.0' },
        timeout: 8000,
      }
    );

    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const change = price - prevClose;
    const changePercent = ((change / prevClose) * 100).toFixed(2);
    const currency = meta.currency || 'THB';
    const name = meta.shortName || meta.symbol;
    const marketTime = new Date(meta.regularMarketTime * 1000);
    const dateStr = marketTime.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });

    return {
      symbol: meta.symbol,
      name,
      price,
      change: change.toFixed(2),
      changePercent,
      currency,
      date: dateStr,
      prevClose,
    };
  } catch (err) {
    logger.warn(`Stock price fetch failed for ${symbol}: ${err.message}`);
    return null;
  }
}

/**
 * แปลงชื่อหุ้นเป็น Yahoo Finance symbol
 */
function extractStockSymbol(text) {
  const lower = text.toLowerCase().trim();

  // Thai stock mapping (common stocks)
  const thaiStocks = {
    scb: 'SCB.BK', 'scb x': 'SCB.BK',
    kbank: 'KBANK.BK', kasikorn: 'KBANK.BK', กสิกร: 'KBANK.BK',
    bbl: 'BBL.BK', bangkok: 'BBL.BK', กรุงเทพ: 'BBL.BK',
    ktb: 'KTB.BK', กรุงไทย: 'KTB.BK',
    ttb: 'TTB.BK',
    ptt: 'PTT.BK', ปตท: 'PTT.BK',
    'ptt ep': 'PTTEP.BK', pttep: 'PTTEP.BK',
    'ptt gc': 'PTTGC.BK', pttgc: 'PTTGC.BK',
    cpall: 'CPALL.BK',
    cpf: 'CPF.BK',
    cp: 'CP.BK',
    scc: 'SCC.BK', ปูนซิเมนต์: 'SCC.BK',
    advanc: 'ADVANC.BK', ais: 'ADVANC.BK', เอไอเอส: 'ADVANC.BK',
    true: 'TRUE.BK', ทรู: 'TRUE.BK',
    dtac: 'DTAC.BK',
    delta: 'DELTA.BK', เดลต้า: 'DELTA.BK',
    gulf: 'GULF.BK', กัลฟ์: 'GULF.BK',
    bdms: 'BDMS.BK',
    mint: 'MINT.BK',
    aot: 'AOT.BK', ท่าอากาศยาน: 'AOT.BK',
    bts: 'BTS.BK',
    bh: 'BH.BK', กรุงเทพดุสิต: 'BH.BK',
    ira: 'IRA.BK', intuch: 'INTUCH.BK',
    or: 'OR.BK',
    ea: 'EA.BK',
    banpu: 'BANPU.BK', บ้านปู: 'BANPU.BK',
    set: '^SET.BK',
  };

  // US stock mapping
  const usStocks = {
    apple: 'AAPL', aapl: 'AAPL',
    google: 'GOOGL', googl: 'GOOGL', goog: 'GOOGL',
    microsoft: 'MSFT', msft: 'MSFT',
    amazon: 'AMZN', amzn: 'AMZN',
    tesla: 'TSLA', tsla: 'TSLA', เทสล่า: 'TSLA',
    meta: 'META', facebook: 'META',
    nvidia: 'NVDA', nvda: 'NVDA', เอ็นวิเดีย: 'NVDA',
    amd: 'AMD',
    netflix: 'NFLX', nflx: 'NFLX',
    'dow jones': '^DJI', dow: '^DJI',
    's&p': '^GSPC', 's&p 500': '^GSPC', 'sp500': '^GSPC',
    nasdaq: '^IXIC',
  };

  // ค้นหาใน mapping
  for (const [key, val] of Object.entries(thaiStocks)) {
    if (lower.includes(key)) return val;
  }
  for (const [key, val] of Object.entries(usStocks)) {
    if (lower.includes(key)) return val;
  }

  // ถ้าเป็นตัวพิมพ์ใหญ่ 2-5 ตัว อาจเป็น symbol โดยตรง
  const match = text.match(/\b([A-Z]{1,5})\b/);
  if (match) {
    const sym = match[1];
    // ลองเป็นหุ้นไทยก่อน (.BK)
    return `${sym}.BK`;
  }

  return null;
}

/**
 * ตรวจจับว่าข้อความถามเกี่ยวกับอะไร
 */
function detectIntent(message) {
  const lower = message.toLowerCase();

  // ถามราคาคริปโต
  const cryptoKeywords = ['btc', 'bitcoin', 'eth', 'ethereum', 'bnb', 'sol', 'solana',
    'xrp', 'doge', 'ada', 'dot', 'matic', 'avax', 'link', 'sui', 'near', 'apt',
    'คริปโต', 'crypto', 'เหรียญ'];
  for (const kw of cryptoKeywords) {
    if (lower.includes(kw)) return { type: 'crypto', keyword: kw };
  }

  // ถามราคาหุ้นเฉพาะตัว
  const stockSymbol = extractStockSymbol(message);
  if (stockSymbol && (lower.includes('ราคา') || lower.includes('เท่าไร') || lower.includes('เท่าไหร่') || lower.includes('price') || lower.includes('ตอนนี้'))) {
    return { type: 'stock-price', keyword: message, symbol: stockSymbol };
  }

  // ถามเกี่ยวกับหุ้น
  if (lower.includes('หุ้น') || lower.includes('stock') || lower.includes('set') ||
      lower.includes('dow') || lower.includes('s&p') || lower.includes('nasdaq')) {
    return { type: 'stock', keyword: lower };
  }

  // ถามเกี่ยวกับทอง
  if (lower.includes('ทอง') || lower.includes('gold') || lower.includes('xau')) {
    return { type: 'gold', keyword: lower };
  }

  // ถามเกี่ยวกับ forex
  if (lower.includes('forex') || lower.includes('ค่าเงิน') || lower.includes('usd') ||
      lower.includes('eur') || lower.includes('บาท') || lower.includes('dollar')) {
    return { type: 'forex', keyword: lower };
  }

  return { type: 'general', keyword: lower };
}

// ====================================================
// Chat with Gemini AI
// ====================================================

/**
 * สร้าง/ดึง chat session ของ user
 */
function getChatSession(userId) {
  if (chatSessions.has(userId)) {
    return chatSessions.get(userId);
  }

  const todayStr = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });

  const client = getClient();
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: `คุณคือ "TAMA AI" ผู้ช่วย AI ด้านการลงทุนส่วนตัว
วันนี้คือ: ${todayStr}
ตอบเป็นภาษาไทยเสมอ (ยกเว้นชื่อเฉพาะ) กระชับ ตรงประเด็น ใช้ emoji เหมาะสม
คุณมีความรู้เรื่อง: หุ้นไทย, หุ้นอเมริกา, หุ้นจีน, คริปโต, ทองคำ, Forex, กองทุนรวม
- ตอบคำถามเรื่องการลงทุนทุกประเภท
- วิเคราะห์หุ้น/คริปโตที่ถูกถาม
- แนะนำด้วยข้อมูลและเหตุผล
- เตือนความเสี่ยงเสมอ
- ถ้าได้รับข้อมูลราคา real-time ให้ใช้ข้อมูลนั้นตอบ ห้ามใช้ข้อมูลเก่าจาก training data
- จำกัดความยาวไม่เกิน 800 ตัวอักษร
- ถ้าไม่เกี่ยวกับการลงทุน ก็ตอบได้ แต่แจ้งว่าเชี่ยวชาญด้านลงทุน`,
  });

  const chat = model.startChat({
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.7,
    },
  });

  chatSessions.set(userId, chat);

  // ลบ session เก่าหลัง 30 นาที
  setTimeout(() => {
    chatSessions.delete(userId);
  }, 30 * 60 * 1000);

  return chat;
}

/**
 * ตอบกลับข้อความจากผู้ใช้
 */
async function handleChatMessage(userMessage, replyToken, userId) {
  try {
    // ตรวจจับ intent
    const intent = detectIntent(userMessage);
    let contextData = '';

    // ดึงข้อมูลราคา real-time ถ้าถามคริปโต
    if (intent.type === 'crypto') {
      const price = await getCryptoPrice(intent.keyword);
      if (price) {
        contextData = `\n[ข้อมูลราคาล่าสุด: ${price.coin} = $${price.usd?.toLocaleString()} (${price.thb?.toLocaleString()} THB) | 24h: ${price.change24h}% | Market Cap: $${(price.marketCap / 1e9)?.toFixed(1)}B]`;
      }
    }

    // ดึงข้อมูลราคาหุ้น real-time
    if (intent.type === 'stock-price' || intent.type === 'stock') {
      const stock = await getStockPrice(userMessage);
      if (stock) {
        const sign = stock.change >= 0 ? '+' : '';
        contextData = `\n[ข้อมูลราคาหุ้นล่าสุด: ${stock.name} (${stock.symbol}) = ${stock.price} ${stock.currency} | เปลี่ยนแปลง: ${sign}${stock.change} (${sign}${stock.changePercent}%) | ปิดก่อนหน้า: ${stock.prevClose} | ข้อมูล ณ ${stock.date}]`;
      }
    }

    // ส่งไป Gemini AI
    const chat = getChatSession(userId);
    const fullMessage = contextData
      ? `${userMessage}\n${contextData}`
      : userMessage;

    const result = await chat.sendMessage(fullMessage);
    let reply = result.response.text() || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้';

    // จำกัดความยาว
    if (reply.length > 4900) {
      reply = reply.substring(0, 4900) + '\n...';
    }

    // ตอบกลับผ่าน LINE Reply API
    await replyToLine(replyToken, reply);
    logger.info(`Replied to ${userId}: ${reply.substring(0, 50)}...`);
  } catch (error) {
    logger.error(`Chat handler error: ${error.message}`);

    // ตอบกลับ error
    await replyToLine(replyToken, '⚠️ ขออภัย TAMA AI มีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * ตอบกลับผ่าน LINE Reply API
 */
async function replyToLine(replyToken, text) {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [{ type: 'text', text }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error) {
    logger.error(`LINE reply failed: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = { handleChatMessage };
