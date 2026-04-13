// ====================================================
// TAMA AI - AI Summarizer (Google Gemini)
// ใช้ AI สรุปข่าวการลงทุนเป็นภาษาไทย
// ====================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');

let genAI = null;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * สร้าง prompt สำหรับสรุปข่าว
 */
function buildPrompt(newsData) {
  const { news, cryptoPrices, goldPrice, fetchedAt } = newsData;

  let prompt = `คุณคือนักวิเคราะห์การลงทุนมืออาชีพ ชื่อ "TAMA AI"
กรุณาสรุปข่าวการลงทุนต่อไปนี้เป็นภาษาไทย ให้กระชับ อ่านง่าย เหมาะส่งผ่าน LINE
ใช้ emoji ให้เหมาะสม และแบ่งหมวดหมู่ชัดเจน

เวลาที่ดึงข้อมูล: ${new Date(fetchedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

`;

  // Thai Stock News
  if (news['stock-th'] && news['stock-th'].length > 0) {
    prompt += `\n=== ข่าวหุ้นไทย (SET) ===\n`;
    news['stock-th'].forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  // US Stock News
  if (news['stock-us'] && news['stock-us'].length > 0) {
    prompt += `\n=== ข่าวหุ้นอเมริกา (Wall Street) ===\n`;
    news['stock-us'].forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  // China Stock News
  if (news['stock-cn'] && news['stock-cn'].length > 0) {
    prompt += `\n=== ข่าวหุ้นจีน ===\n`;
    news['stock-cn'].forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  // Crypto News & Prices
  if (news.crypto && news.crypto.length > 0) {
    prompt += `\n=== ข่าวคริปโต ===\n`;
    news.crypto.forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  if (cryptoPrices && cryptoPrices.length > 0) {
    prompt += `\n=== ราคาคริปโตปัจจุบัน ===\n`;
    cryptoPrices.forEach((cp) => {
      prompt += `- ${cp.coin}: $${cp.usd?.toLocaleString()} (${cp.thb?.toLocaleString()} THB) | 24h: ${cp.change24h}%\n`;
    });
  }

  // Gold Price
  if (goldPrice) {
    prompt += `\n=== ราคาทองคำ ===\n`;
    prompt += `- XAU/USD: $${goldPrice.price} | เปลี่ยนแปลง: ${goldPrice.change} (${goldPrice.changePercent}%)\n`;
  }

  // Forex News
  if (news.forex && news.forex.length > 0) {
    prompt += `\n=== ข่าว Forex ===\n`;
    news.forex.forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  // General Investment News
  if (news.general && news.general.length > 0) {
    prompt += `\n=== ข่าวการลงทุนทั่วไป ===\n`;
    news.general.forEach((item, i) => {
      prompt += `${i + 1}. ${item.title}\n   ${item.summary.substring(0, 200)}\n`;
    });
  }

  prompt += `
รูปแบบสรุปที่ต้องการ:
1. เริ่มด้วย "🤖 TAMA AI สรุปข่าวการลงทุน" พร้อมวันที่เวลา
2. แบ่งเป็นหมวด: 🇹🇭 หุ้นไทย, 🇺🇸 หุ้นอเมริกา, 🇨🇳 หุ้นจีน, ₿ คริปโต, 🥇 ทองคำ, 💱 Forex
3. แต่ละหมวดสรุป 2-3 ประเด็นสำคัญ
4. ถ้ามีหุ้นที่น่าสนใจ ให้แนะนำพร้อมเหตุผลสั้นๆ (ถ้าไม่มีข้อมูลหุ้นน่าสนใจ ไม่ต้องใส่)
5. ด้านล่างใส่ราคาคริปโตและทองคำ
6. จบด้วย "💡 มุมมอง TAMA AI" วิเคราะห์สั้นๆ 2-3 บรรทัด
7. หมวดไหนไม่มีข้อมูลข่าว ให้ข้ามหมวดนั้นไปเลย ไม่ต้องส่งหมวดที่ว่าง
8. จำกัดความยาวไม่เกิน 2000 ตัวอักษร (LINE limit)
9. ห้ามใส่ link หรือ URL ใดๆ`;

  return prompt;
}

/**
 * สรุปข่าวด้วย AI
 */
async function summarizeNews(newsData) {
  const client = getClient();
  const prompt = buildPrompt(newsData);

  logger.info('Sending news to Gemini AI for summarization...');

  try {
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemInstruction: 'คุณคือผู้ช่วย AI ด้านการลงทุน ตอบเป็นภาษาไทยเท่านั้น สรุปให้กระชับ ใช้ emoji เหมาะสม',
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.7,
      },
    });

    const summary = result.response.text() || '';
    logger.info(`AI summary generated: ${summary.length} chars`);

    // Ensure it doesn't exceed LINE limit (5000 chars max per message)
    if (summary.length > 4900) {
      return summary.substring(0, 4900) + '\n...';
    }

    return summary;
  } catch (error) {
    logger.error(`AI summarization failed: ${error.message}`);
    throw error;
  }
}

module.exports = { summarizeNews };
