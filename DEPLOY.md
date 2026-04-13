# Deploy to Railway.app

## ขั้นตอนการ Deploy:

### 1. สร้าง GitHub Repository
```bash
cd "c:\Users\jls com\Desktop\TAMA AI"
git init
git add .
git commit -m "Initial commit - TAMA AI Bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/TAMA-AI.git
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

เพิ่ม 7 variables นี้:
```
GEMINI_API_KEY=AIzaSyDNwYhOU_Yzv0_SkVmuM9BKGAkvxcU4WbQ
LINE_CHANNEL_ACCESS_TOKEN=t5e/wHO+qoURVzOyv+ebd8q/+PWi693KaGFkEgRYabGwEouAnnjbO/FnM6ZpZIe9O/nb6raiH/zBAjzZu7LzdnOUpt9ADKEUj7tH+cJPFoUl2QiwOseCu/1O01L9p41OKB3PdSc19/cJu82yEuxw5wdB04t89/1O/w1cDnyilFU=
LINE_CHANNEL_SECRET=625d2f72bbd922230b0d07544ef2ec7f
LINE_CHANNEL_ID=2008744906
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAAXB8wEAAAAAby26gP4avMT6UZmOYrzy7K%2FT26E%3DVgynr3CWD2Fln5A37rWMn1MTWFGngKbQbsAPy7jbI0Mc7CiunK
CRON_SCHEDULE=0 9,12,15,18 * * *
SOCIAL_CRON_SCHEDULE=*/5 * * * *
```

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
