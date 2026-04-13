# TAMA AI - Investment News Bot

AI Bot สรุปข่าวการลงทุนทุกประเภท ส่งแจ้งเตือนผ่าน LINE ทุก 1 ชั่วโมง

## Features

- ดึงข่าวจากหลายแหล่ง: หุ้นไทย, ตลาดโลก, คริปโต, Forex, ทองคำ
- ใช้ AI (GPT) สรุปข่าวเป็นภาษาไทย อ่านง่าย
- ส่งแจ้งเตือนผ่าน LINE Notify อัตโนมัติทุก 1 ชั่วโมง
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

#### OpenAI API Key
1. ไปที่ https://platform.openai.com/api-keys
2. สร้าง API Key ใหม่
3. คัดลอก key ไว้

#### LINE Notify Token
1. ไปที่ https://notify-bot.line.me/my/
2. Login ด้วย LINE Account
3. กด **"Generate token"**
4. ตั้งชื่อ Token เช่น "TAMA AI"
5. เลือกห้องแชทที่ต้องการรับแจ้งเตือน (เช่น "1-on-1 chat with LINE Notify" หรือกลุ่ม)
6. คัดลอก Token ไว้

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
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
LINE_NOTIFY_TOKEN=xxxxxxxxxxxxxxxx
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
| `OPENAI_API_KEY` | Yes | - | OpenAI API Key |
| `LINE_NOTIFY_TOKEN` | Yes | - | LINE Notify Token |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | โมเดล AI ที่ใช้ |
| `GOLD_API_KEY` | No | - | Gold API Key (optional) |
| `CRON_SCHEDULE` | No | `0 * * * *` | Cron schedule (ทุก 1 ชม.) |
| `RUN_ON_START` | No | `true` | รันทันทีเมื่อเริ่ม |
| `LOG_LEVEL` | No | `info` | Log level |

## Cron Schedule Examples

| Schedule | Description |
|---|---|
| `0 * * * *` | ทุก 1 ชั่วโมง (default) |
| `*/30 * * * *` | ทุก 30 นาที |
| `0 9,12,17 * * *` | เฉพาะ 9:00, 12:00, 17:00 |
| `0 8-18 * * 1-5` | ทุกชม. เฉพาะ 8:00-18:00 วันจันทร์-ศุกร์ |

## Cost Estimate

- **OpenAI GPT-4o-mini**: ~$0.01-0.03 ต่อครั้ง (~$0.50-1.00/เดือน สำหรับ 24 ครั้ง/วัน)
- **LINE Notify**: ฟรี
- **CoinGecko API**: ฟรี
- **Gold API**: ฟรี (300 requests/month)
