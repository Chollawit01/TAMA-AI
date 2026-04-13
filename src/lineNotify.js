// ====================================================
// TAMA AI - LINE Messaging API Module
// ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (Broadcast)
// ====================================================

const axios = require('axios');
const logger = require('./logger');

const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * ส่งข้อความ Broadcast ไปยังผู้ติดตามทุกคน (LINE Messaging API)
 * @param {string} message - ข้อความที่จะส่ง
 */
async function sendLineNotify(message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set in environment variables');
  }

  // LINE Messaging API limit: 5000 chars per text message
  const chunks = splitMessage(message, 4900);

  logger.info(`Sending ${chunks.length} message(s) via LINE Messaging API...`);

  // LINE broadcast supports up to 5 message objects per request
  const batchSize = 5;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const messages = batch.map((text) => ({
      type: 'text',
      text: text.trim(),
    }));

    try {
      await axios.post(
        `${LINE_API_BASE}/message/broadcast`,
        { messages },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      logger.info(
        `LINE broadcast batch ${Math.floor(i / batchSize) + 1} sent (${messages.length} message(s))`
      );

      // Delay between batches to avoid rate limit
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errMsg =
        error.response?.data?.message || error.response?.data?.details || error.message;
      logger.error(`Failed to send LINE broadcast: ${JSON.stringify(errMsg)}`);
      throw new Error(`LINE Messaging API failed: ${errMsg}`);
    }
  }

  logger.info('All LINE messages sent successfully');
}

/**
 * ส่งข้อความไปยัง user ID เฉพาะ (push message)
 * @param {string} userId - LINE User ID
 * @param {string} message - ข้อความ
 */
async function sendLinePush(userId, message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const chunks = splitMessage(message, 4900);
  const messages = chunks.slice(0, 5).map((text) => ({
    type: 'text',
    text: text.trim(),
  }));

  try {
    await axios.post(
      `${LINE_API_BASE}/message/push`,
      { to: userId, messages },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    logger.info(`LINE push message sent to ${userId}`);
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    logger.error(`Failed to push LINE message: ${errMsg}`);
    throw error;
  }
}

/**
 * แบ่งข้อความยาวเป็นชิ้นย่อย
 */
function splitMessage(message, maxLength) {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks = [];
  const lines = message.split('\n');
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > maxLength) {
      if (current) {
        chunks.push(current.trim());
      }
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * ส่งข้อความแจ้ง error ผ่าน LINE
 */
async function sendErrorNotify(errorMessage) {
  try {
    await sendLineNotify(`⚠️ TAMA AI Error\n${errorMessage}`);
  } catch {
    logger.error('Failed to send error notification to LINE');
  }
}

module.exports = { sendLineNotify, sendLinePush, sendErrorNotify };
