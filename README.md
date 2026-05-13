# TAMA AI - Investment News Bot

AI Bot สรุปข่าวการลงทุนทุกประเภท ส่งแจ้งเตือนผ่าน LINE วันละ 1 ครั้งเวลา 11:00 และส่งข่าวด่วนเพิ่มเมื่อพบเหตุการณ์สำคัญ

## Features

- ดึงข่าวจากหลายแหล่ง: หุ้นไทย, ตลาดโลก, คริปโต, Forex, ทองคำ
- ใช้ Gemini สรุปข่าวเป็นภาษาไทย อ่านง่าย
- ส่งแจ้งเตือนผ่าน LINE Messaging API อัตโนมัติวันละ 1 ครั้งเวลา 11:00
- มีโหมดข่าวด่วนส่งเพิ่มแยกต่างหากเมื่อเจอคำ/เหตุการณ์เข้าข่าย
- แสดงราคา Crypto และทองคำ real-time
- วิเคราะห์มุมมองสั้นๆ จาก AI

## ตัวอย่างข้อความที่ส่ง

```
🤖 TAMA AI สรุปข่าวการลงทุน
📅 11 เม.ย. 2026 เวลา 14:00 น.

📈 หุ้นไทย
• SET Index ปรับตัวขึ้น 0.5% ...
• กลุ่มพลังงานนำตลาด ...

🌍 ตลาดโลก
• S&P 500 ทำ All-Time High ...
• Fed ส่งสัญญาณคงดอกเบี้ย ...

₿ คริปโต
• BTC: $67,500 (+2.1%)
• ETH: $3,800 (+1.5%)

🥇 ทองคำ
• XAU/USD: $2,350 (+0.3%)

💡 มุมมอง TAMA AI
ตลาดโดยรวมเป็นบวก...
```

## Quick Start

### 1. ติดตั้ง Dependencies

```bash
cd "TAMA AI"
npm install
```

### 2. สร้าง API Keys

#### Gemini API Key
1. ไปที่ https://aistudio.google.com/app/apikey
2. สร้าง API Key ใหม่
3. คัดลอก key ไว้

#### LINE Messaging API
1. ไปที่ https://developers.line.biz/console/
2. สร้าง Provider และ Messaging API Channel
3. เปิดแท็บ Messaging API แล้วคัดลอก Channel access token
4. ไปที่ Basic settings แล้วคัดลอก Channel secret และ Channel ID

#### Gold API (Optional)
1. ไปที่ https://www.goldapi.io/
2. สมัคร Free tier (300 requests/month)

### 3. ตั้งค่า Environment Variables

```bash
# คัดลอก .env.example เป็น .env
copy .env.example .env
```

แก้ไขไฟล์ `.env` ใส่ค่าจริง:

```env
GEMINI_API_KEY=your-gemini-api-key
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ID=your-line-channel-id
CRON_SCHEDULE=0 11 * * *
URGENT_CRON_SCHEDULE=*/15 * * * *
RUN_ON_START=false
```

### 4. รันโปรแกรม

```bash
# รันปกติ
npm start

# รันแบบ dev (auto-restart เมื่อแก้ไขไฟล์)
npm run dev
```

### 5. ทดสอบทีละขั้น

```bash
# ทดสอบดึงข่าวอย่างเดียว
node src/test.js fetch

# ทดสอบดึงข่าว + สรุป AI
node src/test.js summarize

# ทดสอบส่ง LINE
node src/test.js line

# ทดสอบทั้งหมด
node src/test.js
```

## Project Structure

```
TAMA AI/
├── src/
│   ├── index.js          # Main app + cron scheduler
│   ├── newsFetcher.js    # ดึงข่าวจาก RSS + API
│   ├── summarizer.js     # AI สรุปข่าว (OpenAI)
│   ├── lineNotify.js     # ส่งข้อความ LINE Notify
│   ├── logger.js         # Logging utility
│   └── test.js           # Test script
├── logs/                 # Log files (auto-created)
├── .env                  # Environment variables (สร้างเอง)
├── .env.example          # Template สำหรับ .env
├── .gitignore
├── package.json
└── README.md
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | - | Gemini API Key |
| `LINE_CHANNEL_ACCESS_TOKEN` | Yes | - | LINE Messaging API access token |
| `LINE_CHANNEL_SECRET` | Yes | - | LINE channel secret |
| `LINE_CHANNEL_ID` | Yes | - | LINE channel ID |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | โมเดล AI ที่ใช้ |
| `GOLD_API_KEY` | No | - | Gold API Key (optional) |
| `CRON_SCHEDULE` | No | `0 11 * * *` | Cron schedule สำหรับสรุปข่าวหลัก |
| `URGENT_CRON_SCHEDULE` | No | `*/15 * * * *` | Cron schedule ตรวจข่าวด่วน |
| `URGENT_NEWS_KEYWORDS` | No | default list | คำที่ใช้คัดข่าวด่วน |
| `URGENT_NEWS_RECENT_HOURS` | No | `8` | ช่วงเวลาย้อนหลังที่ใช้คัดข่าวด่วน |
| `RUN_ON_START` | No | `false` | รันทันทีเมื่อเริ่ม |
| `LOG_LEVEL` | No | `info` | Log level |

## Cron Schedule Examples

| Schedule | Description |
|---|---|
| `0 11 * * *` | ทุกวันเวลา 11:00 (default) |
| `*/30 * * * *` | ทุก 30 นาที |
| `0 9,12,17 * * *` | เฉพาะ 9:00, 12:00, 17:00 |
| `0 8-18 * * 1-5` | ทุกชม. เฉพาะ 8:00-18:00 วันจันทร์-ศุกร์ |

## Cost Estimate

- **OpenAI GPT-4o-mini**: ~$0.01-0.03 ต่อครั้ง (~$0.50-1.00/เดือน สำหรับ 24 ครั้ง/วัน)
- **LINE Notify**: ฟรี
- **CoinGecko API**: ฟรี
- **Gold API**: ฟรี (300 requests/month)
