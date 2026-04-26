# دليل النشر على سيرفر ودومين

## 1) تجهيز السيرفر (Ubuntu مثال)

```bash
sudo apt update
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### تثبيت MongoDB (مثال Ubuntu)

```bash
sudo apt install -y mongodb
sudo systemctl enable mongodb
sudo systemctl start mongodb
sudo systemctl status mongodb
```

## 2) رفع المشروع

```bash
cd /var/www
sudo mkdir -p el-sakka
sudo chown -R $USER:$USER el-sakka
cd el-sakka
git clone <YOUR_REPO_URL> app
cd app
```

## 3) إعداد ملف البيئة

```bash
cp .env.example .env
```

عدّل `.env` بالقيم المناسبة:
- `OWNER_USERNAME`
- `OWNER_PASSWORD`
- `OWNER_JWT_SECRET` (ضروري قوي)
- `CORS_ORIGINS` (الدومين الرسمي)
- `MONGODB_URI`
- `UPLOADS_DIR` (يفضل خارج فولدر الكود)

مثال:

```env
NODE_ENV=production
PORT=3000
OWNER_USERNAME=elsakka
OWNER_PASSWORD=elsakkagroup
OWNER_JWT_SECRET=long-random-secret
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
MONGODB_URI=mongodb://127.0.0.1:27017/el_sakka_store
UPLOADS_DIR=/var/www/el-sakka/storage/uploads
SERVE_FRONTEND=true
```

## 4) تثبيت وبناء المشروع

```bash
npm ci
npm run build:prod
```

## 5) تشغيل الباك إند في الخلفية (PM2)

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 6) ربط Nginx بالدومين

1. انسخ إعداد Nginx:

```bash
sudo cp nginx.el-sakka.conf /etc/nginx/sites-available/el-sakka
sudo ln -s /etc/nginx/sites-available/el-sakka /etc/nginx/sites-enabled/el-sakka
sudo nginx -t
sudo systemctl restart nginx
```

2. (اختياري ومهم) فعّل SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 7) تحديثات لاحقة على السيرفر (Deploy changes)

```bash
cd /var/www/el-sakka/app
git pull
npm ci
npm run build:prod
pm2 restart el-sakka-store
```

بهذا الشكل أي تعديل جديد في الكود يتم تطبيقه على السيرفر الأونلاين مباشرة بعد الخطوات السابقة.
