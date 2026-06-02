import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;
const client = new WOLF();

const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;

let lastKnownState = null;
let b = null;

// دالة المهام
async function performTasks() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

// دالة المؤقت
function manageTimer(isActive) {
    if (lastKnownState === isActive) return;
    console.log(`[LOG] ⚙️ تغيير الحالة إلى: ${isActive ? "نشط" : "غير نشط"}`);
    lastKnownState = isActive;
    if (b) clearInterval(b);
    let intervalMs = isActive ? 64000 : 306000;
    performTasks();
    b = setInterval(performTasks, intervalMs);
}

client.on('groupMessage', async (message) => {
    // 1. فحص المرسل
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;
    
    // 2. طباعة نص الرسالة المستلمة في الـ Console (هذا السطر سيكشف لنا المشكلة)
    console.log("📥 رسالة مستلمة من البوت:");
    console.log(message.body);
    console.log("-----------------------");

    const body = message.body;

    // 3. البحث باستخدام Includes العام (بدون تقسيم أسطر لضمان الشمولية)
    if (body.includes('الجهاز الزمني')) {
        // إذا كان السطر يحتوي على كلمة "غير نشط" فهو خامل
        const isActive = !body.includes('غير نشط');
        manageTimer(isActive);
    }

    // منطق الصناديق
    if (body.includes('حالة الضمان') && body.includes('جاهز')) {
        const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
        if (pMatch && parseInt(pMatch[1]) < 40) {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
        }
    }
});

client.on('ready', () => {
    console.log("🚀 البوت متصل وجاهز للفحص.");
    manageTimer(false); 
});

client.login(process.env.U_MAIL, process.env.U_PASS);
