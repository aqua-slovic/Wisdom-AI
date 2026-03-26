const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for temporarily storing uploaded audio files
// Ensure uploads directory exists (needed on fresh Render deployments)
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/' });

// API Key - set GEMINI_API_KEY environment variable in Render dashboard
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAP5L_LQNimIsyw8vC47K-KWCjz21xOXpI";

// Models
const FAST_MODEL = 'gemini-2.5-flash';

// System Instructions
const SYSTEM_INSTRUCTION = `You are AQUA SLOVIC AI, a futuristic, highly intelligent AI assistant designed to help people in everyday life scenarios like school, coding, and ethical hacking. You think like a hacker and a teacher.

Crucial Information about your Creator & Environment:
1. Owner/Creator: If asked who the owner is, you MUST state that the person must view the portfolio at wisdom-malata.vercel.app. The creator is Wisdom Malata.
2. Best Friends: Shekinah Banda (a girl) and Praise Mwankhwawa (a boy).
3. Programming Friends: Vortex (AKA Tawonga Mkandawire) who learns at NACIT with the creator, and Emprin (AKA Prince Mtipe) who is a web developer and an ethical hacker.
4. Family: Brother is Mtendere Chikwemba (AKA Cleo), Abby Bemeyani, and Amos Bemeyani. Mothers are Lucy Mphande and Hellen Mphande.
5. Contact Info: If someone asks for the creator's number or contact info, you MUST give:
   - Phone: +265992393452, +265880277778
   - Emails: wj00755@gmail.com, AquaSlovic@gmail.com
6. Learning Resources Feature: You MUST proactively suggest relevant learning resources (articles, tutorials, courses) based on the user's queries in school, coding, or ethical hacking.
7. Tone: Futuristic, professional, brilliant, and helpful. Frame responses using Markdown for structure.`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function callGemini(modelName, chatHistory, audioBase64 = null, audioMimeType = null) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    // Construct the payload
    let contents = [...chatHistory];
    
    // If there's an audio file, we append it to the last user message
    if (audioBase64 && audioMimeType) {
        const lastMessage = contents[contents.length - 1];
        lastMessage.parts.push({
            inline_data: {
                mime_type: audioMimeType,
                data: audioBase64
            }
        });
    }

    const payload = {
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        contents: contents,
        tools: [{ googleSearch: {} }], // Enable Web Search Grounding
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        // Return structured error to handle fallback
        return { success: false, status: response.status, body: errorBody };
    }

    const data = await response.json();
    return { success: true, data: data };
}

app.post('/api/chat', upload.single('file'), async (req, res) => {
    try {
        let chatHistory = [];
        try {
            chatHistory = JSON.parse(req.body.chatHistory || "[]");
        } catch (e) {
            chatHistory = [];
        }

        let selectedModel = FAST_MODEL;
        
        let fileBase64 = null;
        let fileMimeType = null;
        
        if (req.file) {
            // Read file to base64
            const fileData = fs.readFileSync(req.file.path);
            fileBase64 = fileData.toString('base64');
            fileMimeType = req.file.mimetype;
            // Clean up temp file
            fs.unlinkSync(req.file.path);
        }

        if (!chatHistory || chatHistory.length === 0) {
            chatHistory.push({ role: "user", parts: [{ text: "Hello" }] });
        }

        // Try the selected model
        let result = await callGemini(selectedModel, chatHistory, fileBase64, fileMimeType);

        if (!result.success) {
            return res.status(result.status).json({ error: "Gemini API Error", details: result.body });
        }

        const data = result.data;
        if (data.candidates && data.candidates.length > 0) {
            const aiText = data.candidates[0].content.parts[0].text;
            let groundingData = null;
            
            // Extract grounding if available
            if (data.candidates[0].groundingMetadata && data.candidates[0].groundingMetadata.groundingChunks) {
                groundingData = data.candidates[0].groundingMetadata.groundingChunks.map(chunk => {
                    return chunk.web?.url ? { title: chunk.web.title, uri: chunk.web.url } : null;
                }).filter(Boolean);
            }

            res.json({ reply: aiText, grounding: groundingData });
        } else {
            throw new Error("No response candidates found");
        }
    } catch (error) {
        console.error("Error communicating with Gemini:", error);
        res.status(500).json({ error: "Could not connect to AI network." });
    }
});

app.listen(PORT, () => {
    console.log(`[SYS] AQUA SLOVIC Backend running on http://localhost:${PORT}`);
});
