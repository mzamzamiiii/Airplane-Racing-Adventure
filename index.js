import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- متغيرات الحالة (مهمة جداً لمنع التكرار) ---
let isSystemActive = false; 
let b = null; 
let lastKnownState = null; // نستخدم هذا لمنع إعادة ضبط المؤقت دون داعٍ

// --- دالة المهام ---
async function performTasks() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

// --- إدارة المؤقت (معدلة لمنع التكرار) ---
function manageTimer(isActive) {
    // إذا كانت الحالة الحالية هي نفس الحالة السابقة، لا تفعل شيئاً (هذا يحل مشكلة التكرار)
    if (lastKnownState === isActive) return;

    console.log(`[LOG] ⚙️ تغيير الحالة: ${isActive ? "نشط" : "غير نشط"}. جاري ضبط المؤقت...`);
    lastKnownState = isActive;
    
    if (b) clearInterval(b);
    
    let intervalMs = isActive ? 64000 : 306000;
    performTasks(); // تنفيذ فوري عند التغيير
    b = setInterval(performTasks, intervalMs);
}

// --- دوال الكابتشا ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    const totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / totalPixels) * 100 > 40;
}

async function extractPlayerName(buffer) {
    try {
        const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
        const worker = await createWorker('ara+eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        return match ? match[1].trim() : "لم يتم العثور";
    } catch (e) { return "خطأ"; }
}

async function solveCaptcha(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }
    if (!found) return null;
    const margin = 10;
    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + margin, top: minY + margin, width: (maxX - minX) - (margin * 2), height: (maxY - minY) - (margin * 2) })
        .greyscale().normalize().linear(1.5, -0.2).sharpen().toBuffer();
    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    // 1. الكابتشا
    if ((message.targetGroupId === CHANNEL_TASKS || message.targetGroupId === CHANNEL_ALLIANCE) && message.sourceSubscriberId == TARGET_USER_ID && message.type === 'text/image_link') {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!(await isCaptchaByColor(buffer))) return;

            const name = await extractPlayerName(buffer);
            if (ALLOWED_PLAYERS.some(p => name.toLowerCase().includes(p.toLowerCase()))) {
                const code = await solveCaptcha(buffer);
                if (code) {
                    await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
                }
            }
        } catch (err) { console.error("⚠️ خطأ كابتشا:", err.message); }
        return;
    }

    if (message.sourceSubscriberId !== TARGET_USER_ID) return;
    
    // تقسيم الرسالة لأسطر للبحث بدقة
    const lines = message.body.split('\n');
    
    // البحث عن سطر الجهاز الزمني حصراً
    const timeLine = lines.find(line => line.includes('الجهاز الزمني'));
    
    if (timeLine) {
        // إذا كان السطر يحتوي "غير نشط" -> الحالة false
        const isActive = !timeLine.includes('غير نشط');
        manageTimer(isActive);
    }

    // منطق الصناديق (بسيط)
    if (message.body.includes('حالة الضمان')) {
        const pMatch = message.body.match(/نقاط الضمان:\s*(\d+)/);
        const sMatch = message.body.includes('جاهز');
        if (pMatch && sMatch && parseInt(pMatch[1]) < 40) {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
        }
    }
});

client.on('ready', () => {
    console.log("🚀 البوت متصل.");
    // بدء بحالة افتراضية
    manageTimer(false); 
});

client.login(process.env.U_MAIL, process.env.U_PASS);
