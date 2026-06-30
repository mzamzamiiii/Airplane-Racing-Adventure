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
            try { await client.messaging.sendGroupMessage(channelId, command); }
            catch (e) { /* تجاوز الخطأ تلقائياً */ }
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

    let hasEnergy = true; 
    let isTurnReady = (config.index === 1); 

    async function attemptRace() {
        if (config.index === 1) {
            if (hasEnergy) {
                console.log(`🚀 [${config.name}] طاقة كاملة! يطلق دورة سباق جديدة...`);
                await globalQueue.add(client, config.sChannel, `!س جلد خاص ${config.id}`);
                hasEnergy = false; 
            }
        } else {
            if (hasEnergy && isTurnReady) {
                console.log(`✅ [${config.name}] الشروط مكتملة (الطاقة + الدور)! يبدأ السباق...`);
                await globalQueue.add(client, config.sChannel, `!س جلد خاص ${config.id}`);
                hasEnergy = false; 
                isTurnReady = false; 
            }
        }
    }

    client.on('privateMessage', async (message) => {
        const body = message.body || "";
        if (body.includes("عاد حيوانك لطاقته الكاملة") || body.includes("back to full energy")) {
            console.log(`⚡ [${config.name}] رسالة خاص: اكتملت الطاقة!`);
            hasEnergy = true;
            await attemptRace(); 
        }
    });

    client.on('groupMessage', async (message) => {
        if (message.sourceSubscriberId === TRACKED_BOT_ID) {
            const body = message.body || "";
            
            if (body.includes("انتهى السباق") || body.includes("The race has finished")) {
                const prevIndex = config.index === 1 ? 12 : config.index - 1;
                const prevBot = ACCOUNTS.find(a => a.index === prevIndex);

                // التعديل الجوهري: التحقق من أن الرسالة في روم الحساب السابق (prevBot.sChannel)
                if (prevBot && message.targetGroupId === prevBot.sChannel && body.includes(String(prevBot.id))) {
                    if (config.index !== 1) { 
                        console.log(`🏁 [${config.name}] تم رصد انتهاء سباق ${prevBot.name} في الروم ${prevBot.sChannel}، دوري الآن!`);
                        isTurnReady = true;
                        await attemptRace(); 
                    }
                }
            }
        }
    });

    client.on('ready', () => {
        console.log(`✅ ${config.name} متصل وجاهز.`);
        
        setTimeout(() => {
            if (client.profile) client.profile.updateStatus(wolfjs.Status.BUSY).catch(() => {});
        }, 5000);

        if (config.index === 1) {
            setTimeout(() => attemptRace(), 8000); 
        }

        runTDuty(client, config);
        runAdventureDuty(client, config);
    });

    client.login(config.email, config.password);
}

// =========================================================================
// ================== 🔄 المهام الجانبية (Background Tasks) ==================
// =========================================================================
async function runTDuty(client, config) {
    while (true) {
        await globalQueue.add(client, config.tChannel, '!ط قصف');
        
        await new Promise(r => setTimeout(r, 3000)); 
        
        if (config.index === 1) {
            await globalQueue.add(client, config.tChannel, '!ط هدية 20300554 2000');
            await new Promise(r => setTimeout(r, 3000)); 
            await globalQueue.add(client, config.tChannel, '!ط هجوم 20300554');
            await new Promise(r => setTimeout(r, 3000)); 
            await globalQueue.add(client, config.tChannel, '!ط خزينة إيداع كل');
        } else {
            await globalQueue.add(client, config.tChannel, '!ط هدية 38770375 2000');
        }
        await new Promise(r => setTimeout(r, 8 * 60 * 1000));
    }
}

async function runAdventureDuty(client, config) {
    let last61MinTask = 0;
    while (true) {
        if (Date.now() - last61MinTask >= 61 * 60 * 1000 || last61MinTask === 0) {
            await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف سحب ذهب 750000');
            await globalQueue.add(client, config.adventureChannel, '!مغامرة شراء 10');
            last61MinTask = Date.now();
        }
        await globalQueue.add(client, config.adventureChannel, '!مغامرة قتال');
        await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف ايداع كل');
        
        await new Promise(r => setTimeout(r, 3 * 60 * 1000 + 3000));
    }
}

// =========================================================================
// ================== 🚀 التشغيل الموزع بفواصل زمنية ==================
// =========================================================================
ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => createBot(acc), i * 3500); 
});
