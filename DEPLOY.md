# Deploy to Railway.app

## ขั้นตอนการ Deploy:

### 1. สร้าง GitHub Repository
```bash
cd "c:\Users\jls com\Desktop\TAMA AI"
git init
git add .
git commit -m "Initial commit - TAMA AI Bot"
git branch -M main
git remote add origin https://github.com/Chollawit01/TAMA-AI.git
git push -u origin main
```

### 2. ที่ Railway.app Dashboard
1. ไปที่ https://railway.app/dashboard
2. กด **+ New Project**
3. เลือก **Deploy from GitHub**
4. เลือก **TAMA-AI** repository
5. เลือก branch **main**
6. กด **Deploy**

### 3. ตั้ง Environment Variables
Railway Dashboard > Project > **Variables**

เพิ่ม variables เหล่านี้:
```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_CHANNEL_ID=your-line-channel-id
X_BEARER_TOKEN=your-x-bearer-token
CRON_SCHEDULE=0 11 * * *
URGENT_CRON_SCHEDULE=*/15 * * * *
URGENT_NEWS_KEYWORDS=ด่วน,ข่าวด่วน,urgent,breaking,flash,fed,fomc,rate hike,rate cut,crash,halt
URGENT_NEWS_RECENT_HOURS=8
SOCIAL_CRON_SCHEDULE=*/5 * * * *
RUN_ON_START=false
```

หมายเหตุ: ถ้าเคยเอา secret จริงใส่ไว้ในเอกสารหรือ commit ไปแล้ว ควร rotate key นั้นทันที

### 4. ทำเสร็จแล้ว!
Railway จะ Auto Deploy เมื่อคุณ push code ใหม่

---

## หลังจาก Deploy
- ตรวจดู logs: Railway Dashboard > Logs
- แก้ code และ push ขึ้น GitHub
- Railway จะ auto deploy อีกครั้ง

## เพิ่มเติม
- Free tier นำให้ 500 ชม./เดือน (~16-17 ชม./วัน)
- ถ้าจำเป็นสามารถ upgrade ได้ ($10/เดือน)
