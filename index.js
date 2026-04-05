const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');

// API Configuration
const API_KEY = "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";
const AI_MODEL = "z-ai/glm-4.5-air:free";

async function startBot() {
    // Session management ('session_rss_brand' folder banega)
    const { state, saveCreds } = await useMultiFileAuthState('session_rss_brand');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }), // Faltu logs band
        printQRInTerminal: false,          // Deprecated warning khatam karne ke liye
        browser: ["RSS BRAND", "Chrome", "2.0"]
    });

    // Save session credentials
    sock.ev.on('creds.update', saveCreds);

    // Connection Updates (QR Code & Status)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear();
            console.log('\n📱 RSS BRAND: SCAN THIS QR CODE 📱\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ RSS BRAND AI BOT IS SUCCESSFULLY ONLINE!');
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Connection lost. Reconnecting...');
                startBot();
            } else {
                console.log('❌ Logged out! Please delete "session_rss_brand" folder and scan again.');
            }
        }
    });

    // Message Logic
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        // Agar message nahi hai, ya bot ne khud bheja hai toh ignore karein
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        
        // Har tarah ka text nikalne ka solid tareeqa
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || "";
                     
        const lowerText = text.toLowerCase().trim();
        if (!lowerText) return;

        // --- MENU COMMAND ---
        if (lowerText === 'menu' || lowerText === '.menu' || lowerText === 'help') {
            const menuText = `✨ *RSS BRAND AI SYSTEM* ✨\n\n` +
                             `👤 *Developer:* RSS BRAND\n` +
                             `🤖 *AI Model:* GLM-4.5 Air (Free)\n\n` +
                             `*COMMANDS:* \n` +
                             `📝 Direct message - AI se baat karein\n` +
                             `📋 .menu - Commands list dekhne ke liye\n\n` +
                             `_System Auto-Reply is Active._`;
            
            await sock.sendMessage(sender, { text: menuText }, { quoted: msg });
            return;
        }

        // --- AI AUTO-REPLY ---
        try {
            // Fake Recording & Typing
            await sock.sendPresenceUpdate('recording', sender);
            await new Promise(res => setTimeout(res, 1500));
            await sock.sendPresenceUpdate('composing', sender);

            // API Call
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: AI_MODEL,
                    messages: [{ role: 'user', content: text }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://github.com/rssbrand',
                        'X-Title': 'RSS Brand WhatsApp Bot'
                    }
                }
            );

            // Extract Response
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiReply = response.data.choices[0].message.content;
                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
            }

            await sock.sendPresenceUpdate('paused', sender);

        } catch (error) {
            console.error("AI Error:", error.response?.data || error.message);
            await sock.sendPresenceUpdate('paused', sender);
        }
    });
}

// Run bot
startBot();
