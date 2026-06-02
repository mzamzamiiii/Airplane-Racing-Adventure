import 'dotenv/config';
import wolfjs from 'wolf.js';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

let isSystemActive = false; // المتغير 'a'
let b = null; // المؤقت 'b'

// دالة المهام
async function performTasks() {
    console.log(`[LOG] 🚀 تنفيذ المهام...`);
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000)); // تأخير ثانيتين
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

// إدارة المؤقت ب
function manageTimer() {
    let intervalMs = isSystemActive ? 64000 : 306000;
    if (b) clearInterval(b);
    performTasks();
    b = setInterval(performTasks, intervalMs);
    console.log(`[LOG] ⚙️ المؤقت مضبوط على: ${intervalMs/1000} ثانية.`);
}

// دالة الكابتشا المحدثة
async function solveCaptcha(buffer) {
    try {
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(buffer);
        await worker.terminate();
        return text.replace(/[^0-9]/g, '').trim();
    } catch (e) { console.error("Captcha Error:", e); return null; }
}

client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;

    // 1. الكابتشا
    if (message.type === 'text/image_link') {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        // في الكابتشا، نحن نفترض أن الصورة تحتوي على نص للاسم
        const code = await solveCaptcha(buffer);
        if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
        return;
    }

    // 2. معالجة النصوص (المنطق الصحيح)
    const body = message.body;
    
    // استخدام Regex لاستخراج الحالة بعد "حالة الضمان:" فقط
    const statusMatch = body.match(/حالة الضمان:\s*(.*)/);
    const timeMatch = body.match(/الجهاز الزمني:\s*(.*)/);

    if (statusMatch && timeMatch) {
        const statusValue = statusMatch[1].trim(); // النص بعد "حالة الضمان:"
        const timeValue = timeMatch[1].trim();    // النص بعد "الجهاز الزمني:"
        
        // التحقق الدقيق: هل هي "جاهز" تماماً؟
        const isReady = (statusValue === "جاهز");
        const isTimeActive = timeValue.includes('س') || timeValue.includes('د');

        console.log(`[LOG] 🔎 الحالة: ${statusValue} | الزمني: ${timeValue}`);

        if (isTimeActive) {
            isSystemActive = true;
        } else if (statusValue === "غير جاهز") {
            isSystemActive = false;
        } else if (isReady) {
            console.log(`[LOG] 💎 الضمان جاهز!`);
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
            isSystemActive = true;
        }

        manageTimer();
    }
});

client.login(process.env.U_MAIL, process.env.U_PASS);
