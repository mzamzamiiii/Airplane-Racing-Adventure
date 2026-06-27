import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// =========================================================================
// ================== 🎮 CONTROL PANEL (لوحة التحكم) ==================
// =========================================================================

const TRACKED_BOT_ID = 80277459; 

const ACCOUNTS = [
    { 
        email: process.env.U_MAIL_1, 
        password: process.env.U_PASS_1, 
        name: 'King', 
        id: 38770375, 
        index: 1, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 569 
    },
    { 
        email: process.env.U_MAIL_2, 
        password: process.env.U_PASS_2, 
        name: 'KSA', 
        id: 27112980, 
        index: 2, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_3, 
        password: process.env.U_PASS_3, 
        name: 'MKH', 
        id: 1780249, 
        index: 3, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_4, 
        password: process.env.U_PASS_4, 
        name: 'SAA', 
        id: 2251312, 
        index: 4, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_5, 
        password: process.env.U_PASS_5, 
        name: 'JDH', 
        id: 39043364, 
        index: 5, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_6, 
        password: process.env.U_PASS_6, 
        name: 'MLK', 
        id: 34648535, 
        index: 6, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_7, 
        password: process.env.U_PASS_7, 
        name: 'CRN', 
        id: 79996355, 
        index: 7, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_8, 
        password: process.env.U_PASS_8, 
        name: 'REX', 
        id: 34435550, 
        index: 8, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_9, 
        password: process.env.U_PASS_9, 
        name: 'LRD', 
        id: 15859439, 
        index: 9, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_10, 
        password: process.env.U_PASS_10, 
        name: 'ROY', 
        id: 32198971, 
        index: 10, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_11, 
        password: process.env.U_PASS_11, 
        name: 'EMP', 
        id: 39515341, 
        index: 11, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_12, 
        password: process.env.U_PASS_12, 
        name: 'NOR', 
        id: 2374823, 
        index: 12, 
        tChannel: 569, 
        sChannel: 569, 
        adventureChannel: 445 
    }
];

// =========================================================================
// ================== 🛡️ GLOBAL QUEUE (نظام طابور الأمان) ==================
// =========================================================================
class SafeQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    async add(client, channelId, command, delayAfter = 0) {
        return new Promise((resolve) => {
            this.queue.push({ client, channelId, command, delayAfter, resolve });
            this.process();
        });
    }

    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;
        const { client, channelId, command, delayAfter, resolve } = this.queue.shift();
        try {
            await client.messaging.sendGroupMessage(channelId, command);
            if (delayAfter > 0) await new Promise(r => setTimeout(r, delayAfter));
        } catch (err) {
            console.error(`❌ خطأ [${command}]:`, err.message);
        }
        this.isProcessing = false;
        resolve();
        this.process();
    }
}
const globalQueue = new SafeQueue();

// =========================================================================
// ================== 🚦 RACE MANAGER (متحكم السباق) ==================
// =========================================================================
class RaceManager {
    constructor() {
        this.currentTurnIndex = 1;
        this.lastTurnTime = {};
        this.clientsMap = new Map();
    }

    registerClient(index, config, client, triggerFunc) {
        this.clientsMap.set(index, { config, client, triggerFunc });
    }

    async handleRaceEndMessage(body) {
        if (body.includes("انتهى السباق")) {
            const match = body.match(/\((\d+)\)\s*$/);
            if (match && match[1]) {
                const extractedId = match[1];
                const currentTurnBot = this.clientsMap.get(this.currentTurnIndex);
                
                if (!currentTurnBot) return;

                if (extractedId === String(currentTurnBot.config.id)) {
                    console.log(`🏁 [السباق] الحساب ${this.currentTurnIndex} (${currentTurnBot.config.name}) أنهى سباقه.`);
                    this.lastTurnTime[this.currentTurnIndex] = Date.now();
                    this.currentTurnIndex = this.currentTurnIndex >= 12 ? 1 : this.currentTurnIndex + 1;
                    this.triggerNext();
                }
            }
        }
    }

    async triggerNext() {
        const nextBot = this.clientsMap.get(this.currentTurnIndex);
        if (!nextBot) return;

        const lastPlayed = this.lastTurnTime[this.currentTurnIndex] || 0;
        const diff = Date.now() - lastPlayed;
        const twelveMinutes = 12 * 60 * 1000;

        if (diff >= twelveMinutes) {
            nextBot.triggerFunc();
        } else {
            const waitTime = twelveMinutes - diff;
            setTimeout(() => nextBot.triggerFunc(), waitTime);
        }
    }
}
const raceManager = new RaceManager();

// =========================================================================
// ================== 🤖 BOT FACTORY (مصنع البوتات) ==================
// =========================================================================
function createBot(config) {
    const client = new WOLF();
    let isAdventure61MinRunning = false;

    async function runTDuty() {
        while (true) {
            try {
                await new Promise(r => setTimeout(r, (config.index - 1) * 5000));
                await globalQueue.add(client, config.tChannel, '!ط قصف', 5000);

                if (config.index === 1) {
                    await globalQueue.add(client, config.tChannel, '!ط هدية 20300554 2000');
                    await new Promise(r => setTimeout(r, 10000));
                    await globalQueue.add(client, config.tChannel, '!ط خزينة إيداع كل');
                } else {
                    await globalQueue.add(client, config.tChannel, '!ط هدية 38770375 2000');
                }
                await new Promise(r => setTimeout(r, 8 * 60 * 1000));
            } catch (err) { await new Promise(r => setTimeout(r, 5000)); }
        }
    }

    async function triggerRaceCommand() {
        console.log(`🎯 [حساب ${config.index}] حان دوري بالسباق...`);
        await globalQueue.add(client, config.sChannel, `!س جلد خاص ${config.id}`);
    }

    async function runAdventureDuty() {
        await new Promise(r => setTimeout(r, (config.index - 1) * 3000));
        let last61MinTask = 0;
        while (true) {
            try {
                if (Date.now() - last61MinTask >= 61 * 60 * 1000 || last61MinTask === 0) {
                    isAdventure61MinRunning = true;
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف سحب ذهب 750000', 5000);
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة شراء 10');
                    last61MinTask = Date.now();
                    isAdventure61MinRunning = false;
                }
                if (!isAdventure61MinRunning) {
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة قتال', 3000);
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف ايداع كل');
                }
                await new Promise(r => setTimeout(r, 3 * 60 * 1000 + 3000));
            } catch (err) { await new Promise(r => setTimeout(r, 4000)); }
        }
    }

    client.on('groupMessage', async (message) => {
        if (message.sourceSubscriberId === TRACKED_BOT_ID) {
            await raceManager.handleRaceEndMessage(message.body.trim());
        }
    });

    client.on('ready', () => {
        console.log(`✅ ${config.name} متصل.`);
        raceManager.registerClient(config.index, config, client, triggerRaceCommand);
        runTDuty();
        runAdventureDuty();
        if (config.index === 1) setTimeout(() => raceManager.triggerNext(), 10000);
    });

    client.login(config.email, config.password);
}

// =========================================================================
// ================== 🚀 SYSTEM STARTUP ==================
// =========================================================================
ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => createBot(acc), i * 4000);
});
