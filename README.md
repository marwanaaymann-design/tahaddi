# تحدي الكورة - طريقة التشغيل (من غير برمجة)

المحتويات: index.html (اللعبة) + مجلد api (السيرفر) + schema.sql (الجداول) + package.json.

## 1) Neon (الداتابيز) - 3 دقايق
1. ادخل https://console.neon.tech وسجل دخول بحسابك.
2. اعمل Project جديد (اسمه أي حاجة، مثلا tahaddi).
3. من القايمة الجانبية دوس **SQL Editor**.
4. افتح ملف `schema.sql` من الفولدر، انسخ كل اللي فيه والصقه في SQL Editor، ودوس **Run**. (لازم تشوف رسالة نجاح.)
5. ارجع للوحة الـ Project، دوس **Connect** وانسخ الـ **Connection string** (بتبدأ بـ postgresql://). سيبها منسوخة، مش هتبعتها لحد.

## 2) GitHub (رفع الملفات) - 3 دقايق
1. ادخل https://github.com وسجل دخول.
2. دوس **+** فوق على اليمين ثم **New repository**. الاسم: tahaddi. سيبه **Private** وادوس **Create repository**.
3. دوس رابط **uploading an existing file**.
4. فك الضغط عن الـ zip اللي بعتهولك، وادخل جوه فولدر `site`. اسحب **كل اللي جواه** (index.html و package.json و schema.sql و README.md وفولدر api) وارميهم في صفحة GitHub.
   - تأكد إنك شايف `api/g.js` في القايمة قبل ما تكمل.
5. دوس **Commit changes**.

## 3) Vercel (النشر) - 3 دقايق
1. ادخل https://vercel.com وسجل دخول بحساب GitHub.
2. دوس **Add New** ثم **Project**، واختار الريبو **tahaddi** ودوس **Import**.
3. **قبل ما تدوس Deploy**: افتح **Environment Variables** وضيف:
   - Name: `DATABASE_URL`
   - Value: الصق الـ Connection string اللي نسختها من Neon.
   - دوس **Add**.
4. دوس **Deploy** وانتظر دقيقة. هيطلعلك رابط اللعبة (مثلا tahaddi.vercel.app).

## 4) التجربة
1. افتح الرابط على موبايلك، اختار **أونلاين**، ادخل الأسماء وادوس ابدأ.
2. هيظهر كود الغرفة ورابط. ابعته لصحابك، كل واحد يفتحه ويكتب اسمه ويختار فريقه.
3. لو ظهرت رسالة "نسيت تضيف DATABASE_URL": ارجع Vercel > Settings > Environment Variables، ضيفه، وبعدين Deployments > آخر نشر > Redeploy.

ملحوظات: الغرف بتتمسح بعد 24 ساعة. الباسوردات بتتخزن مشفرة (scrypt) ومش بتتشاف. الداتابيز المجانية بتنام لو مفيش استخدام، فأول طلب ممكن يتأخر ثانية أو اتنين.
