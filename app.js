import { db } from './firebase-config.js';
import { ref, onValue, set, update } from "firebase/database";

// Configuration
const PASSWORDS = {
    him: "10654",
    her: "191396"
};

// State
let currentRole = null; // 'him' or 'her'
let isPasswordVerified = {
    him: localStorage.getItem('verified_him') === 'true',
    her: localStorage.getItem('verified_her') === 'true'
};

// DOM Elements
const himDisplay = document.getElementById('him-display');
const himTime = document.getElementById('him-time');
const himRelative = document.getElementById('him-relative');

const herDisplay = document.getElementById('her-display');
const herTime = document.getElementById('her-time');
const herRelative = document.getElementById('her-relative');

const himSeen = document.getElementById('him-seen');
const herSeen = document.getElementById('her-seen');

const editHimBtn = document.getElementById('edit-him');
const editHerBtn = document.getElementById('edit-her');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const passwordArea = document.getElementById('password-area');
const statusArea = document.getElementById('status-area');
const passInput = document.getElementById('pass-input');
const statusInput = document.getElementById('status-input');
const charCount = document.getElementById('char-count');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');

// Audio context and buffers
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = async (url) => {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(0);
    } catch (e) { console.error("Audio play error", e); }
};

// Global state for timestamps and seen status
let lastTimestamps = { him: null, her: null };
let currentStatuses = { him: null, her: null };

function formatTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function getRelativeTimeStr(ts) {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "Just now";
    const mins = Math.floor(diff / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    
    if (hrs > 0) {
        return `${hrs}h ${remainingMins}m ago`;
    }
    return `${mins}m ago`;
}

function updateRelativeDisplays() {
    if (lastTimestamps.him) himRelative.textContent = getRelativeTimeStr(lastTimestamps.him);
    if (lastTimestamps.her) herRelative.textContent = getRelativeTimeStr(lastTimestamps.her);
}

function adjustFontSize(element, text) {
    if (!text) {
        element.style.fontSize = "2rem";
        return;
    }
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    // Base 2rem, reduce by 0.25rem for every 15 words, min 0.9rem
    let size = 2 - (Math.floor(words / 15) * 0.25);
    size = Math.max(size, 0.9);
    element.style.fontSize = `${size}rem`;
}

// Update relative time every 30 seconds
setInterval(updateRelativeDisplays, 30000);

// Firebase Listeners
const himRef = ref(db, 'v2/statuses/him');
const herRef = ref(db, 'v2/statuses/her');

onValue(himRef, (snapshot) => {
    const data = snapshot.val();
    currentStatuses.him = data;
    if (data) {
        const text = data.text || "No status yet";
        himDisplay.textContent = text;
        adjustFontSize(himDisplay, text);
        himTime.textContent = formatTime(data.timestamp);
        lastTimestamps.him = data.timestamp;
        himRelative.textContent = getRelativeTimeStr(data.timestamp);
        himSeen.classList.toggle('seen', !!data.seen);
    } else {
        himDisplay.textContent = "No status yet";
        himDisplay.style.fontSize = "2rem";
        himSeen.classList.remove('seen');
    }
});

onValue(herRef, (snapshot) => {
    const data = snapshot.val();
    currentStatuses.her = data;
    if (data) {
        const text = data.text || "No status yet";
        herDisplay.textContent = text;
        adjustFontSize(herDisplay, text);
        herTime.textContent = formatTime(data.timestamp);
        lastTimestamps.her = data.timestamp;
        herRelative.textContent = getRelativeTimeStr(data.timestamp);
        herSeen.classList.toggle('seen', !!data.seen);
    } else {
        herDisplay.textContent = "No status yet";
        herDisplay.style.fontSize = "2rem";
        herSeen.classList.remove('seen');
    }
});

// UI Logic
function openModal(role) {
    currentRole = role;
    modal.classList.remove('hidden');
    modalTitle.textContent = `Update ${role.toUpperCase()}'s Status`;
    
    passInput.value = "";
    statusInput.value = "";

    if (isPasswordVerified[role]) {
        passwordArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        // Pre-fill with current status
        statusInput.value = (role === 'him' ? himDisplay.textContent : herDisplay.textContent);
        if (statusInput.value === "No status yet") statusInput.value = "";
        charCount.textContent = `${statusInput.value.length} / 500`;
        statusInput.focus();
    } else {
        passwordArea.classList.remove('hidden');
        statusArea.classList.add('hidden');
        passInput.focus();
    }
}

function closeModal() {
    modal.classList.add('hidden');
    currentRole = null;
}

function handleSubmit() {
    if (!currentRole) return;

    if (!isPasswordVerified[currentRole]) {
        // Password verification step
        const enteredPass = passInput.value.trim();
        if (enteredPass === PASSWORDS[currentRole]) {
            playSound('/success_sound.mp3');
            isPasswordVerified[currentRole] = true;
            localStorage.setItem(`verified_${currentRole}`, 'true');
            
            // Switch to status input
            passwordArea.classList.add('hidden');
            statusArea.classList.remove('hidden');
            statusInput.value = (currentRole === 'him' ? himDisplay.textContent : herDisplay.textContent);
            if (statusInput.value === "No status yet") statusInput.value = "";
            charCount.textContent = `${statusInput.value.length} / 500`;
            statusInput.focus();
        } else {
            playSound('/error_sound.mp3');
            alert("Incorrect password!");
            passInput.value = "";
        }
    } else {
        // Status update step
        const newStatus = statusInput.value.trim();
        if (newStatus.length === 0) {
            alert("Please enter a status");
            return;
        }

        const targetRef = ref(db, `v2/statuses/${currentRole}`);
        set(targetRef, {
            text: newStatus,
            timestamp: Date.now(),
            seen: false
        })
            .then(() => {
                playSound('/click_sound.mp3');
                closeModal();
            })
            .catch((error) => {
                console.error("Data update failed:", error);
                alert("Failed to update status. Check console.");
            });
    }
}

// Toggle seen status logic
async function toggleSeen(role) {
    // Logic: To mark HIM as seen, you must be HER (know her password)
    // To mark HER as seen, you must be HIM (know his password)
    const canMarkHim = (role === 'him' && isPasswordVerified.her);
    const canMarkHer = (role === 'her' && isPasswordVerified.him);

    if (canMarkHim || canMarkHer) {
        const data = currentStatuses[role];
        if (!data) return;
        
        const targetRef = ref(db, `v2/statuses/${role}`);
        try {
            await update(targetRef, { seen: !data.seen });
            playSound('/click_sound.mp3');
        } catch (e) {
            console.error("Failed to toggle seen status", e);
        }
    } else {
        playSound('/error_sound.mp3');
        alert(`You must be verified as ${role === 'him' ? 'HER' : 'HIM'} to mark this as seen!`);
    }
}

// Event Listeners
himSeen.addEventListener('click', () => toggleSeen('him'));
herSeen.addEventListener('click', () => toggleSeen('her'));

editHimBtn.addEventListener('click', () => openModal('him'));
editHerBtn.addEventListener('click', () => openModal('her'));
cancelBtn.addEventListener('click', closeModal);
submitBtn.addEventListener('click', handleSubmit);

// Handle Character Count
statusInput.addEventListener('input', () => {
    charCount.textContent = `${statusInput.value.length} / 500`;
});

// Handle Enter keys
passInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubmit();
});

// Close modal on background click
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});