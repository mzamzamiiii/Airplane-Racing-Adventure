import 'dotenv/config'; // استدعاء ملف البيئة لقراءة الإيميلات وكلمات المرور المشفرة
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// =========================================================================
// ================== 🎮 CONTROL PANEL (لوحة التحكم الرئيسية) ==================
// =========================================================================

// آيدي الحساب (المرسل أو حساب اللعبة) الذي نراقب رسالته "انتهى السباق"
const TRACKED_BOT_ID = 80277459; 

// مصفوفة الحسابات الـ 12 مع إمكانية التحكم الكامل بقناة كل دورة وعضوية كل حساب
const ACCOUNTS = [
    { 
        email: process.env.U_MAIL_1, password: process.env.U_PASS_1, name: 'King', id: 38770375, index: 1,
        tChannel: 569, sChannel: 569, adventureChannel: 569 
    },
    { 
        email: process.env.U_MAIL_2, password: process.env.U_PASS_2, name: 'KSA', id: 27112980, index: 2,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_3, password: process.env.U_PASS_3, name: 'MKH', id: 1780249, index: 3,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_4, password: process.env.U_PASS_4, name: 'SAA', id: 2251312, index: 4,
        tChannel: 569, sChannel: 569, adventureChannel: 445
    },
    { 
        email: process.env.U_MAIL_5, password: process.env.U_PASS_5, name: 'JDH', id: 39043364, index: 5,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_6, password: process.env.U_PASS_6, name: 'MLK', id: 34648535, index: 6,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_7, password: process.env.U_PASS_7, name: 'CRN', id: 79996355, index: 7,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_8, password: process.env.U_PASS_8, name: 'REX', id: 34435550, index: 8,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_9, password: process.env.U_PASS_9, name: 'LRD', id: 15859439, index: 9,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_10, password: process.env.U_PASS_10, name: 'ROY', id: 32198971, index: 10,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_11, password: process.env.U_PASS_11, name: 'EMP', id: 39515341, index: 11,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    },
    { 
        email: process.env.U_MAIL_12, password: process.env.U_PASS_12, name: 'NOR', id: 2374823, index: 12,
        tChannel: 569, sChannel: 569, adventureChannel: 445 
    }
];

// =========================================================================
// ================== 🛡️ GLOBAL QUEUE (نظام طابور الأمان المركزي) ==================
// =========================================================================
// هذا النظام يمنع الحسابات من إرسال رسائل في نفس اللحظة منعا حاسماً للسبام والتبنيد
class SafeQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    // دالة إضافة الرسالة إلى الطابور مع إمكانية تحديد وقت انتظار بعدها (delayAfter)
    async add(client, channelId, command, delayAfter = 0) {
        return new Promise((resolve) => {
            this.queue.push({ client, channelId, command, delayAfter, resolve });
            this.process();
        });
    }

    // معالجة وإرسال الرسائل بالدور؛ مستحيل تخرج رسالتين معاً
    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const { client, channelId, command, delayAfter, resolve } = this.queue.shift();

        try {
            await client.messaging.sendGroupMessage(channelId, command);
            if (delayAfter > 0) {
                await new Promise(r => setTimeout(r, delayAfter)); // دالة الانتظار بين الأوامر
            }
        } catch (err) {
            console.error(`❌ خطأ أثناء إرسال الأمر [${command}] للقناة [${channelId}]:`, err.message);
        }

        this.isProcessing = false;
        resolve();
        this.process(); // الانتقال للأمر التالي بالطابور
    }
}

const globalQueue = new SafeQueue();

// =========================================================================
// ================== 🚦 RACE MANAGER (متحكم نظام دورة السباق !س) ==================
// =========================================================================
// هذا الكلاس يدير طابور السباق الذكي، لكي لا يلعب حساب إلا بعد انتهاء الحساب السابق بـ 12 دقيقة واستلام رسالة اللعبة
class RaceManager {
    constructor() {
        this.currentTurnIndex = 1; // يحدد الحساب الذي عليه الدور حالياً (يبدأ بحساب 1)
        this.lastTurnTime = {}; // يحتفظ بآخر وقت لعب فيه الحساب لضمان شرط الـ 12 دقيقة
        this.clientsMap = new Map(); // خارطة لربط الحسابات وتفعيلها عند مناداتها
    }

    // تسجيل الحسابات بداخل نظام إدارة السباق عند بدء التشغيل
    registerClient(index, config, client, triggerFunc) {
        this.clientsMap.set(index, { config, client, triggerFunc });
    }

    // فحص الرسائل القادمة من آيدي اللعبة للتأكد من انتهاء السباق للحساب الحالي
    async handleRaceEndMessage(body) {
        if (body.includes("انتهى السباق")) {
            const currentTurnBot = this.clientsMap.get(this.currentTurnIndex);
            if (!currentTurnBot) return;

            const expectedId = currentTurnBot.config.id;
            // التحقق أن الرسالة تنتهي بعضوية الحساب الذي يلعب الآن
            if (body.endsWith(String(expectedId))) {
                console.log(`🏁 [السباق] انتهى سباق الحساب ${this.currentTurnIndex} (${currentTurnBot.config.name}). التجهيز للتالي...`);
                
                this.lastTurnTime[this.currentTurnIndex] = Date.now(); // تسجيل وقت الانتهاء للحساب الحالي

                // الانتقال للحساب التالي (إذا وصلنا لـ 12 نعود لـ 1)
                this.currentTurnIndex = this.currentTurnIndex >= 12 ? 1 : this.currentTurnIndex + 1;

                this.triggerNext(); // استدعاء الحساب الجديد ليأخذ دوره
            }
        }
    }

    // تفعيل الحساب الذي عليه الدور بعد التحقق من مرور 12 دقيقة على آخر لعب له
    async triggerNext() {
        const nextBot = this.clientsMap.get(this.currentTurnIndex);
        if (!nextBot) return;

        const lastPlayed = this.lastTurnTime[this.currentTurnIndex] || 0;
        const diff = Date.now() - lastPlayed;
        const twelveMinutes = 12 * 60 * 1000; // 12 دقيقة بالملي ثانية

        if (diff >= twelveMinutes) {
            nextBot.triggerFunc(); // إرسال الأمر فوراً إذا انتهت الـ 12 دقيقة
        } else {
            const waitTime = twelveMinutes - diff;
            console.log(`⏳ [السباق] الحساب ${this.currentTurnIndex} ينتظر ${Math.ceil(waitTime/1000)} ثانية لإكمال شرط الـ 12 دقيقة.`);
            setTimeout(() => {
                if (this.currentTurnIndex === nextBot.config.index) {
                    nextBot.triggerFunc();
                }
            }, waitTime);
        }
    }
}

const raceManager = new RaceManager();

// متغيرات عامة لمراقبة هدايا الحسابات (من 2 لـ 12) لمزامنة إيداع خزينة حساب 1
let giftsSentCount = 0;
let onGiftsFinished = null;

// =========================================================================
// ================== 🤖 BOT FACTORY (مصنع إنتاج وتشغيل البوتات) ==================
// =========================================================================
function createBot(config, botIndex) {
    const client = new WOLF();
    let isAdventure61MinRunning = false; // تتبع حالة دورة 61 دقيقة لإيقاف دورة الـ 3 دقائق مؤقتاً عند تزامنهما

    // -----------------------------------------------------------
    // 1️⃣ دورة !ط (تتكرر بالكامل كل 8 دقائق)
    // -----------------------------------------------------------
    async function runTDuty() {
        while (true) {
            try {
                // فارق زمني أولي 5 ثوانٍ بين الحسابات عند انطلاق الدورة الكلية
                await new Promise(r => setTimeout(r, (config.index - 1) * 5000));

                console.log(`🚀 [حساب ${config.index}] إرسال أوامر دورة !ط`);
                await globalQueue.add(client, config.tChannel, '!ط قصف', 5000); // إرسال قصف ثم انتظار 5 ثوانٍ

                if (config.index === 1) {
                    // حساب رقم 1: يرسل هديته المتميزة
                    await globalQueue.add(client, config.tChannel, '!ط هدية 20300554 2000');
                    
                    // يدخل وضع الانتظار حتى تنهي كافة الحسابات من 2 لـ 12 إرسال الهدايا
                    await new Promise((resolve) => {
                        giftsSentCount = 0; // تصفير العداد للدورة الجديدة
                        onGiftsFinished = resolve; // حفظ دالة التنبيه لطلب تفعيلها لاحقاً
                    });

                    // يرسل الخزينة فور تأكده من انتهاء الحساب الأخير
                    await globalQueue.add(client, config.tChannel, '!ط خزينة إيداع كل');
                } else {
                    // الحسابات من 2 لـ 12: ترسل هديتها العادية
                    await globalQueue.add(client, config.tChannel, '!ط هدية 38770375 2000');
                    giftsSentCount++;
                    
                    // إذا وصل الدور للحساب رقم 12، يقوم بتنبيه حساب 1 فوراً لينفذ أمر الخزينة
                    if (config.index === 12 && onGiftsFinished) {
                        onGiftsFinished();
                    }
                }

                // الدورة تعيد نفسها بالكامل بعد 8 دقائق
                await new Promise(r => setTimeout(r, 8 * 60 * 1000));
            } catch (err) {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    // -----------------------------------------------------------
    // 2️⃣ دالة إرسال أمر !س جلد خاص (تستدعى عند مجيء دور الحساب بالسباق)
    // -----------------------------------------------------------
    async function triggerRaceCommand() {
        console.log(`🎯 [حساب ${config.index}] حان دوري بالسباق، جاري الجلد...`);
        await globalQueue.add(client, config.sChannel, `!س جلد خاص ${config.id}`);
    }

    // -----------------------------------------------------------
    // 3️⃣ دورة المغامرة (3 دقائق و 3 ثوانٍ المندمجة مع الـ 61 دقيقة)
    // -----------------------------------------------------------
    async function runAdventureDuty() {
        // فارق زمني أولي 3 ثوانٍ بين كل حساب وحساب لمنع التداخل عند البدء
        await new Promise(r => setTimeout(r, (config.index - 1) * 3000));

        let last61MinTask = 0;
        const interval3Min = 3 * 60 * 1000 + 3000; // مؤقت 3 دقائق و 3 ثوانٍ بالملي ثانية
        const interval61Min = 61 * 60 * 1000;      // مؤقت 61 دقيقة بالملي ثانية

        while (true) {
            try {
                const now = Date.now();

                // التحقق هل حان وقت تنفيذ دورة السحب والشراء؟ (كل 61 دقيقة)
                if (now - last61MinTask >= interval61Min || last61MinTask === 0) {
                    isAdventure61MinRunning = true; // رفع الراية لإيقاف دورة الـ 3 دقائق مؤقتاً
                    
                    console.log(`⚔️ [حساب ${config.index}] تفعيل دورة سحب الذهب والشراء الكبرى (61 دقيقة)`);
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف سحب ذهب 750000', 5000); // سحب ثم انتظار 5 ثوانٍ
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة شراء 10');
                    
                    last61MinTask = Date.now();
                    isAdventure61MinRunning = false; // خفض الراية؛ لتعود دورة الـ 3 دقائق للعمل بسلاسة
                }

                // دورة الـ 3 دقائق و 3 ثوانٍ (تعمل فقط إذا لم تكن دورة الـ 61 دقيقة قائمة بالهندسة الحالية)
                if (!isAdventure61MinRunning) {
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة قتال', 3000); // قتال ثم انتظار 3 ثوانٍ
                    await globalQueue.add(client, config.adventureChannel, '!مغامرة تحالف ايداع كل');
                }

                // الانتظار الإلزامي قبل إعادة المحاولة للدورة القادمة
                await new Promise(r => setTimeout(r, interval3Min));

            } catch (err) {
                await new Promise(r => setTimeout(r, 4000));
            }
        }
    }

    // -----------------------------------------------------------
    // 4️⃣ مراقبة أحداث الرسائل المستلمة في القناة لخدمة السباق
    // -----------------------------------------------------------
    client.on('groupMessage', async (message) => {
        // إذا كانت الرسالة من الآيدي المراقب ونوعها نصي
        if (
            message.sourceSubscriberId === TRACKED_BOT_ID && 
            typeof message.body === 'string'
        ) {
            await raceManager.handleRaceEndMessage(message.body.trim());
        }
    });

    // -----------------------------------------------------------
    // 5️⃣ عند جهوزية الحساب واتصاله بالسيرفر
    // -----------------------------------------------------------
    client.on('ready', () => {
        console.log(`✅ الحساب [${config.name}] متصل بنجاح برقم ترتيب (${config.index})`);
        
        // ربط الحساب بالنظام المركزي لإدارة طابور السباق
        raceManager.registerClient(config.index, config, client, triggerRaceCommand);

        // إطلاق دورة !ط ودورة المغامرة الخاصة بالحساب
        runTDuty();
        runAdventureDuty();

        // الحساب رقم 1 يفتتح أول جولة سباق تلقائياً بعد استقرار تشغيل الحسابات بـ 10 ثوانٍ
        if (config.index === 1) {
            setTimeout(() => {
                raceManager.triggerNext();
            }, 10000);
        }
    });

    // تنفيذ عملية تسجيل الدخول للحساب
    client.login(config.email, config.password);
}

// =========================================================================
// ================== 🚀 SYSTEM STARTUP (معالج تشغيل النظام) ==================
// =========================================================================
// تشغيل الـ 12 حساباً بجدولة متتابعة (كل حساب يفتح بعد الآخر بـ 4 ثوانٍ) لمنع ضغط الاتصال بالسيرفر
ACCOUNTS.forEach((acc, i) => {
    setTimeout(() => {
        createBot(acc, i + 1);
    }, i * 4000); 
});
