import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// =========================================================================
// ================== 🎮 CONTROL PANEL (إعدادات الحسابات) ==================
// =========================================================================

const TRACKED_BOT_ID = 80277459; 

const ACCOUNTS = [
    { email: process.env.U_MAIL_1, password: process.env.U_PASS_1, name: 'King', id: 38770375, index: 1, tChannel: 569, sChannel: 569, adventureChannel: 569 },
    { email: process.env.U_MAIL_2, password: process.env.U_PASS_2, name: 'KSA', id: 27112980, index: 2, tChannel: 569, sChannel: 18654218, adventureChannel: 569 },
    { email: process.env.U_MAIL_3, password: process.env.U_PASS_3, name: 'MKH', id: 1780249, index: 3, tChannel: 569, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_4, password: process.env.U_PASS_4, name: 'SAA', id: 2251312, index: 4, tChannel: 569, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_5, password: process.env.U_PASS_5, name: 'JDH', id: 39043364, index: 5, tChannel: 569, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_6, password: process.env.U_PASS_6, name: 'MLK', id: 34648535, index: 6, tChannel: 569, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_7, password: process.env.U_PASS_7, name: 'CRN', id: 79996355, index: 7, tChannel: 445, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_8, password: process.env.U_PASS_8, name: 'REX', id: 34435550, index: 8, tChannel: 445, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_9, password: process.env.U_PASS_9, name: 'LRD', id: 15859439, index: 9, tChannel: 445, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_10, password: process.env.U_PASS_10, name: 'ROY', id: 32198971, index: 10, tChannel: 445, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_11, password: process.env.U_PASS_11, name: 'EMP', id: 39515341, index: 11, tChannel: 445, sChannel: 18654218, adventureChannel: 445 },
    { email: process.env.U_MAIL_12, password: process.env.U_PASS_12, name: 'NOR', id: 2374823, index: 12, tChannel: 445, sChannel: 18654218, adventureChannel: 445 }
];

// =========================================================================
// ================== 🛡️ نظام الطابور (SafeQueue) ==================
// =========================================================================
class SafeQueue {
    constructor() { this.queue = []; this.isProcessing = false; }

    async add(client, channelId, command) {
        return new Promise((resolve) => {
            this.queue.push({ client, channelId, command, resolve });
            this.process();
        });
    }

    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const { client, channelId, command, resolve } = this.queue.shift();
        
        try {
            await client.messaging.sendGroupMessage(channelId, command);
        } catch (err) {
            console.log(`🔄 محاولة إرسال بديلة لـ [${command}]...`);
            try { await client.messaging.sendGroupMessage(channelId, command); }
            catch (e) { console.error(`❌ فشل نهائي: ${e.message}`); }
        }
        this.isProcessing = false;
        resolve();
        this.process();
    }
}
const globalQueue = new SafeQueue();

// =========================================================================
// ================== 🤖 مصنع البوتات (Bot Factory) ==================
// =========================================================================
function createBot(config) {
    const client = new WOLF();

    async function triggerRaceCommand() {
        console.log(`🎯 [${config.name}] بدء السباق...`);
        await globalQueue.add(client, config.sChannel, `!س جلد خاص ${config.id}`);
    }

    client.on('groupMessage', async (message) => {
        if (message.sourceSubscriberId === TRACKED_BOT_ID && message.targetGroupId === config.sChannel) {
            const body = message.body.trim();
            
            // نظام استخلاص الوقت الذكي
            if (body.includes("ما زال السباق جاريًا") && body.includes(String(config.id))) {
                const match = body.match(/\d+/);
                const waitSeconds = match ? parseInt(match[0]) : 30;
                console.log(`⚠️ [${config.name}] انتظار ${waitSeconds} ثانية للسباق...`);
                setTimeout(() => triggerRaceCommand(), (waitSeconds + 1) * 1000);
            }
        }
    });

    client.on('ready', () => {
        console.log(`✅ ${config.name} متصل.`);
        client.profile.updateStatus(wolfjs.Status.BUSY);
        
        // تشغيل المهام التلقائية
        runTDuty(client, config);
        runAdventureDuty(client, config);
    });

    client.login(config.email, config.password);
}

// المهام
async function runTDuty(client, config) {
    while (true) {
        await globalQueue.add(client, config.tChannel, '!ط قصف');
        await new Promise(r => setTimeout(r, 8 * 60 * 1000));
    }
}

async function runAdventureDuty(client, config) {
    while (true) {
        await globalQueue.add(client, config.adventureChannel, '!مغامرة قتال');
        await new Promise(r => setTimeout(r, 4 * 60 * 1000));
    }
}

// =========================================================================
// ================== 🚀 التشغيل ==================
// =========================================================================
ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => createBot(acc), i * 3000);
});
