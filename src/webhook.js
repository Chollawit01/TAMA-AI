// ====================================================
// TAMA AI - Webhook Server (LINE Messaging API)
// รับข้อความจาก LINE แล้วตอบกลับด้วย Gemini AI
// ====================================================

const crypto = require('crypto');
const express = require('express');
const { handleChatMessage } = require('./chatHandler');
const logger = require('./logger');

/**
 * ตรวจสอบ LINE Signature (ป้องกัน request ปลอม)
 */
function validateSignature(body, signature) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return false;

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

/**
 * สร้าง Express app สำหรับ webhook
 */
function createWebhookServer() {
  const app = express();

  // Health check
  app.get('/', (req, res) => {
    res.json({ status: 'ok', name: 'TAMA AI', version: '1.0.0' });
  });

  // LINE Webhook endpoint
  app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    // ตอบ 200 ทันทีเพื่อไม่ให้ LINE timeout
    res.status(200).json({ status: 'ok' });

    try {
      const body = req.body.toString('utf8');
      const signature = req.headers['x-line-signature'];

      // ตรวจสอบ signature
      if (!validateSignature(body, signature)) {
        logger.warn('Invalid LINE webhook signature');
        return;
      }

      const payload = JSON.parse(body);
      const events = payload.events || [];

      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          const userId = event.source?.userId || 'unknown';

          logger.info(`Chat from ${userId}: ${userMessage.substring(0, 50)}`);

          // ตอบกลับด้วย AI
          await handleChatMessage(userMessage, replyToken, userId);
        }
      }
    } catch (error) {
      logger.error(`Webhook error: ${error.message}`);
    }
  });

  return app;
}

/**
 * เริ่ม webhook server
 */
function startWebhookServer() {
  const app = createWebhookServer();
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    logger.info(`Webhook server running on port ${port}`);
    logger.info(`Webhook URL: http://localhost:${port}/webhook`);
    logger.info(`Use ngrok to expose: ngrok http ${port}`);
  });

  return app;
}

module.exports = { startWebhookServer };
