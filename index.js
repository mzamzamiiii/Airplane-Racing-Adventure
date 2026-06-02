import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 80055399;
const CHANNEL_TASKS = 81889058;
const CHANNEL_ALLIANCE = 81889058;
const ALLOWED_PLAYER_NAMES = ['.أوكسجينه.', 'أوكسجيئه.', 'أوكسجيته '];

// --- متغيرات النظام ---
let currentInterval = 306000; 
let intervalRef = null;
let isFarming = false;

// --- دالة المهام ---
async function performTasks() {
    console.log(`[LOG] 🚀 بدء المهام الدورية (مد مهام + ايداع)...`);
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
        console.log(`[LOG] ✅ المهام الدورية تم إرسالها بنجاح.`);
    } catch (e) { console.error(`[ERROR] فشل في المهام الدورية: ${e.message}`); }
}

// --- منطق المؤقت ---
async function updateBotLogic(isTimeMachineActive, isGuaranteeReady) {
    let targetInterval = 306000; 

    if (isTimeMachineActive) {
        targetInterval = 64000;
        console.log(`[LOG] الحالة: الجهاز نشط. التوقيت: 64 ثانية.`);
    } else if (isGuaranteeReady) {
        console.log(`[LOG] الحالة: غير نشط ولكن الضمان جاهز. جارٍ طلب صندوق ضمان وقت...`);
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
        targetInterval = 64000;
    } else {
        targetInterval = 306000;
        console.log(`[LOG] الحالة: الجهاز غير نشط والضمان غير جاهز. التوقيت: 5 دقائق.`);
    }

    if (targetInterval !== currentInterval) {
        console.log(`[LOG] ⚙️ تغيير المؤقت من ${currentInterval/1000}ث إلى ${targetInterval/1000}ث.`);
        currentInterval = targetInterval;
        if (intervalRef) clearInterval(intervalRef);
        performTasks();
        intervalRef = setInterval(performTasks, currentInterval);
    }
}

// --- دوال الكابتشا (مع لوجات) ---
async function solveCaptcha(buffer) {
    console.log(`[LOG] 🖼️ جاري تحليل الكابتشا...`);
    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    const code = text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
    console.log(`[LOG] 🧩 الكابتشا المقروءة: "${code}"`);
    return code;
}

// --- المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID) return;

    // 1. الكابتشا
    if (message.type === 'text/image_link') {
        console.log(`[LOG] 📸 استلام صورة (احتمال كابتشا)...`);
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // فحص اللون والاسم
        const name = await extractPlayerName(buffer);
        console.log(`[LOG] 👤 اسم اللاعب الموجود بالكابتشا: ${name}`);
        
        if (ALLOWED_PLAYER_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
            console.log(`[LOG] ✅ الاسم مطابق، جاري حل الكابتشا...`);
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
        } else {
            console.log(`[LOG] ❌ الاسم غير مطابق أو لم يتم التعرف عليه، تجاهل.`);
        }
        return;
    }

    // 2. معالجة الرسائل النصية (الحالة والصناديق)
    const body = message.body;
    
    // تحليل الجهاز والضمان
    const isTimeMachineActive = !body.includes('الجهاز الزمني: غير نشط');
    const isGuaranteeReady = body.includes('حالة الضمان: جاهز');
    await updateBotLogic(isTimeMachineActive, isGuaranteeReady);

    // تحليل الصناديق
    if (body.includes('حالة الصناديق')) {
        const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
        if (pMatch) {
            const points = parseInt(pMatch[1]);
            console.log(`[LOG] 📦 نقاط الضمان الحالية: ${points}`);
            
            if (points < 40 && !isFarming) {
                console.log(`[LOG] ⚠️ النقاط أقل من 40، جاري فتح صندوق ذهبي...`);
                isFarming = true;
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح ذهبي');
                setTimeout(() => { isFarming = false; }, 8000);
            } else if (points >= 40) {
                console.log(`[LOG] ✅ النقاط ${points} (كافية)، لا حاجة لفتح صناديق.`);
            }
        }
    }
});

// --- دوال مساعدة إضافية ---
async function extractPlayerName(buffer) {
    try {
        const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
        const worker = await createWorker('ara+eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        return match ? match[1].trim() : "غير معروف";
    } catch (e) { return "خطأ"; }
}

client.on('ready', async () => {
    console.log("🚀 البوت متصل ومستعد للعمل.");
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
    intervalRef = setInterval(performTasks, currentInterval);
});

client.login(process.env.U_MAIL, process.env.U_PASS);
