// Backend API Endpoint
const API_URL = '/api/chat';

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const voiceNoteBtn = document.getElementById('voiceNoteBtn');
const voiceStatus = document.getElementById('voiceStatus');
const vnStatus = document.getElementById('vnStatus');
const welcomeScreen = document.getElementById('welcomeScreen');

// File Upload Elements
const fileUpload = document.getElementById('fileUpload');
const filePreview = document.getElementById('filePreview');
const fileNameDisplay = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFileBtn');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const voiceSelect = document.getElementById('voiceSelect');
const initVoiceBtn = document.getElementById('initVoiceBtn');
const themeColorInput = document.getElementById('themeColor');
const resetThemeBtn = document.getElementById('resetThemeBtn');

// State
let chatHistory = [];
let synth = window.speechSynthesis;
let voices = [];
let recognition = null;
let isLiveVoice = false;
let selectedFile = null;

// Media Recorder (Voice Notes)
let mediaRecorder;
let audioChunks = [];
let isRecordingVN = false;

// Default Settings
let currentThemeColor = localStorage.getItem('aquaThemeColor') || '#00f3ff';
let currentVoiceURI = localStorage.getItem('aquaVoiceURI') || null;

// Initialize
function init() {
    applyThemeColor(currentThemeColor);
    themeColorInput.value = currentThemeColor;
    
    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
    
    setupSpeechRecognition();
    setupMediaRecorder(); // For Voice Notes
}

// UI Event Listeners
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message || selectedFile) {
        sendMessage(message || 'Please see the attached file.');
    }
});

// File Management
fileUpload.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        fileNameDisplay.textContent = selectedFile.name;
        filePreview.style.display = 'block';
    }
});

clearFileBtn.addEventListener('click', () => {
    clearFileSelection();
});

function clearFileSelection() {
    fileUpload.value = '';
    selectedFile = null;
    filePreview.style.display = 'none';
}

// Settings Handlers
settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
closeSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === settingsModal) { settingsModal.style.display = 'none'; } });

themeColorInput.addEventListener('input', (e) => { applyThemeColor(e.target.value); });
themeColorInput.addEventListener('change', (e) => { localStorage.setItem('aquaThemeColor', e.target.value); });

resetThemeBtn.addEventListener('click', () => {
    const defaultColor = '#00f3ff';
    applyThemeColor(defaultColor);
    themeColorInput.value = defaultColor;
    localStorage.setItem('aquaThemeColor', defaultColor);
});

voiceSelect.addEventListener('change', () => {
    currentVoiceURI = voiceSelect.value;
    localStorage.setItem('aquaVoiceURI', currentVoiceURI);
});

initVoiceBtn.addEventListener('click', () => {
    speak("AQUA SLOVIC AI voice module online and ready.");
});

function applyThemeColor(color) {
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--primary-glow', color + '80');
}

// Voice Population (TTS)
function populateVoiceList() {
    voices = synth.getVoices();
    voiceSelect.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Default System Voice';
    defaultOption.value = 'default';
    voiceSelect.appendChild(defaultOption);

    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.voiceURI;
        if (voice.voiceURI === currentVoiceURI) { option.selected = true; }
        voiceSelect.appendChild(option);
    });
}

// Live Speech Recognition
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isLiveVoice = true;
            voiceBtn.classList.add('recording');
            voiceStatus.classList.add('visible');
            voiceStatus.textContent = "Listening to Live Voice...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            voiceStatus.textContent = "Processing logic...";
            setTimeout(() => {
                sendMessage(transcript);
            }, 500); 
        };

        recognition.onerror = (event) => {
            console.error("Speech Rec Error:", event.error);
            stopLiveVoiceUI();
            voiceStatus.textContent = "Error: " + event.error;
            setTimeout(() => { voiceStatus.classList.remove('visible'); }, 2000);
        };

        recognition.onend = () => {
            stopLiveVoiceUI();
            if(messageInput.value === "") {
               setTimeout(() => { voiceStatus.classList.remove('visible'); }, 500);
            }
        };

        voiceBtn.addEventListener('click', () => {
            if (isLiveVoice) {
                recognition.stop();
            } else {
                try { recognition.start(); } catch(e) { console.error("Mic error:", e); }
            }
        });
    } else {
        voiceBtn.style.display = 'none';
        console.warn("Speech recognition not supported in this browser.");
    }
}

function stopLiveVoiceUI() {
    isLiveVoice = false;
    voiceBtn.classList.remove('recording');
}

// Voice Notes Setup (Audio Recording)
async function setupMediaRecorder() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = [];
                // Send the voice note
                sendVoiceNote(audioBlob);
            };

            voiceNoteBtn.addEventListener('mousedown', startVoiceNote);
            voiceNoteBtn.addEventListener('mouseup', stopVoiceNote);
            voiceNoteBtn.addEventListener('mouseleave', stopVoiceNote);
            
            // Touch support for mobile
            voiceNoteBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceNote(); });
            voiceNoteBtn.addEventListener('touchend', stopVoiceNote);

        } catch (err) {
            console.error("Mic access denied for voice notes:", err);
            voiceNoteBtn.style.display = 'none';
        }
    } else {
        console.warn("MediaRecorder not supported");
        voiceNoteBtn.style.display = 'none';
    }
}

function startVoiceNote() {
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start();
        isRecordingVN = true;
        voiceNoteBtn.classList.add('recording-vn');
        vnStatus.classList.add('visible');
    }
}

function stopVoiceNote() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecordingVN = false;
        voiceNoteBtn.classList.remove('recording-vn');
        vnStatus.classList.remove('visible');
    }
}

// Text Synthesis
function speak(text) {
    if (synth.speaking) { synth.cancel(); }
    if (text !== '') {
        const plainText = text.replace(/([*_#>`\\[\\]()])/g, '').trim();
        const utterThis = new SpeechSynthesisUtterance(plainText);
        
        if (currentVoiceURI && currentVoiceURI !== 'default') {
            const selectedVoice = voices.find(v => v.voiceURI === currentVoiceURI);
            if (selectedVoice) { utterThis.voice = selectedVoice; }
        }
        
        utterThis.pitch = 1;
        utterThis.rate = 1;
        synth.speak(utterThis);
    }
}

// Messaging Logic
async function sendMessage(text) {
    hideWelcomeScreen();
    
    messageInput.value = '';
    messageInput.focus();
    voiceStatus.classList.remove('visible');

    let displayMsg = text;
    if (selectedFile) {
        displayMsg += `\n\n*(📎 Attached File: ${selectedFile.name})*`;
    }

    appendMessage(displayMsg, 'user');
    const typingId = showTypingIndicator();
    
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    try {
        const formData = new FormData();
        formData.append('chatHistory', JSON.stringify(chatHistory));
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        clearFileSelection();

        const responseText = await fetchGeminiAPI(formData);
        
        removeTypingIndicator(typingId);
        appendMessage(responseText.reply, 'ai', responseText.grounding);
        speak(responseText.reply);
    } catch (error) {
        clearFileSelection();
        removeTypingIndicator(typingId);
        appendMessage("Error: Could not connect to AQUA SLOVIC network. " + error.message, 'ai');
        console.error(error);
    }
}

async function sendVoiceNote(audioBlob) {
    hideWelcomeScreen();
    
    appendMessage("🎙️ *Sent a voice note...*", 'user');
    const typingId = showTypingIndicator();
    
    // Voice notes count as user input.
    chatHistory.push({ role: "user", parts: [{ text: "[Voice Note]" }] });

    try {
        const formData = new FormData();
        formData.append('chatHistory', JSON.stringify(chatHistory));
        formData.append('file', audioBlob, 'voicenote.webm');

        const responseText = await fetchGeminiAPI(formData);
        
        removeTypingIndicator(typingId);
        appendMessage(responseText.reply, 'ai', responseText.grounding);
        speak(responseText.reply);
    } catch (error) {
        removeTypingIndicator(typingId);
        appendMessage("Error processing voice note: " + error.message, 'ai');
        console.error(error);
    }
}

async function fetchGeminiAPI(formData) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData // No Content-Type header needed for FormData
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.reply) {
        chatHistory.push({ role: "model", parts: [{ text: data.reply }] });
        return data; 
    } else {
        throw new Error("No response candidates found");
    }
}

// UI Helpers
function hideWelcomeScreen() {
    if (welcomeScreen.style.display !== 'none') {
         welcomeScreen.style.display = 'none';
    }
}

function appendMessage(text, sender, grounding = null) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar');
    
    if (sender === 'user') {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    } else {
        avatar.innerHTML = `<img src='./logo.jpeg' onerror="this.src='https://via.placeholder.com/40?text=AS'"/>`;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('msg-content');
    
    if (sender === 'ai') {
        contentDiv.innerHTML = marked.parse(text); 
        
        // Render Grounding if available
        if (grounding && grounding.length > 0) {
            const groundingDiv = document.createElement('div');
            groundingDiv.classList.add('grounding-links');
            groundingDiv.innerHTML = '<strong><i class="fas fa-globe"></i> Web Sources:</strong><ul>' + 
                grounding.map(g => `<li><a href="${g.uri}" target="_blank">${g.title}</a></li>`).join('') +
                '</ul>';
            contentDiv.appendChild(groundingDiv);
        }
    } else {
        contentDiv.innerHTML = marked.parse(text);
    }
    
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

let typingIdCounter = 0;
function showTypingIndicator() {
    const id = `typing-${typingIdCounter++}`;
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    msgDiv.id = id;
    
    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar');
    avatar.innerHTML = `<img src='./logo.jpeg' onerror="this.src='https://via.placeholder.com/40?text=AS'"/>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('msg-content');
    
    const indicator = document.createElement('div');
    indicator.classList.add('typing-indicator');
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    
    contentDiv.appendChild(indicator);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
    
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Run init
init();
