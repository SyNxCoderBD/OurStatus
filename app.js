import { db } from './firebase-config.js';
import { ref, onValue, set, update, push, remove, serverTimestamp } from "firebase/database";

// Configuration
const PASSWORDS = { him: "10654", her: "191396" };

// State
let isPasswordVerified = {
    him: localStorage.getItem('verified_him') === 'true',
    her: localStorage.getItem('verified_her') === 'true'
};
let currentRole = null; 
let currentStatuses = { him: null, her: null };
let lastTimestamps = { him: null, her: null };

// DOM Elements
const himDisplay = document.getElementById('him-display');
const himTime = document.getElementById('him-time');
const himRelative = document.getElementById('him-relative');
const herDisplay = document.getElementById('her-display');
const herTime = document.getElementById('her-time');
const herRelative = document.getElementById('her-relative');
const himSeen = document.getElementById('him-seen');
const herSeen = document.getElementById('her-seen');
const himSeenTime = document.getElementById('him-seen-time');
const herSeenTime = document.getElementById('her-seen-time');
const editHimBtn = document.getElementById('edit-him');
const editHerBtn = document.getElementById('edit-her');
const addHimHighlightBtn = document.getElementById('add-him-highlight');
const addHerHighlightBtn = document.getElementById('add-her-highlight');
const viewHimHighlightsBtn = document.getElementById('view-him-highlights');
const viewHerHighlightsBtn = document.getElementById('view-her-highlights');
const viewAllHighlightsBtn = document.getElementById('view-all-highlights');
const openChatBtn = document.getElementById('open-chat-btn');

const modal = document.getElementById('modal');
const highlightsModal = document.getElementById('highlights-modal');
const confirmModal = document.getElementById('confirm-modal');
const chatModal = document.getElementById('chat-modal');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const typingIndicator = document.getElementById('typing-indicator');
const editingBanner = document.getElementById('editing-banner');
const cancelEditBtn = document.getElementById('cancel-edit');

const highlightsList = document.getElementById('highlights-list');
const highlightsTitle = document.getElementById('highlights-title');
const modalTitle = document.getElementById('modal-title');
const passwordArea = document.getElementById('password-area');
const statusArea = document.getElementById('status-area');
const passInput = document.getElementById('pass-input');
const statusInput = document.getElementById('status-input');
const charCount = document.getElementById('char-count');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');

const closeHighlightsBtn = document.getElementById('close-highlights-btn');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

// Audio
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
    } catch (e) { console.error("Audio error", e); }
};

// Utils
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
    if (hrs > 0) return `${hrs}h ${mins % 60}m ago`;
    return `${mins}m ago`;
}

function adjustFontSize(element, text) {
    if (!text) { element.style.fontSize = "2rem"; return; }
    const words = text.trim().split(/\s+/).length;
    let size = 2 - (Math.floor(words / 15) * 0.25);
    element.style.fontSize = `${Math.max(size, 0.9)}rem`;
}

function updateVisibility() {
    addHimHighlightBtn.classList.toggle('hidden', !isPasswordVerified.him);
    addHerHighlightBtn.classList.toggle('hidden', !isPasswordVerified.her);
    
    // Update seen time visibility based on verification
    if (currentStatuses.him && currentStatuses.him.seen && isPasswordVerified.him) {
        himSeenTime.textContent = `Seen at ${formatTime(currentStatuses.him.seen)}`;
        himSeenTime.classList.remove('hidden');
    } else {
        himSeenTime.classList.add('hidden');
    }

    if (currentStatuses.her && currentStatuses.her.seen && isPasswordVerified.her) {
        herSeenTime.textContent = `Seen at ${formatTime(currentStatuses.her.seen)}`;
        herSeenTime.classList.remove('hidden');
    } else {
        herSeenTime.classList.add('hidden');
    }
}

// Firebase Listeners (Statuses)
onValue(ref(db, 'v2/statuses/him'), (snapshot) => {
    const data = snapshot.val();
    currentStatuses.him = data;
    if (data) {
        himDisplay.textContent = data.text;
        adjustFontSize(himDisplay, data.text);
        himTime.textContent = formatTime(data.timestamp);
        lastTimestamps.him = data.timestamp;
        himRelative.textContent = getRelativeTimeStr(data.timestamp);
        himSeen.classList.toggle('seen', !!data.seen);
    } else {
        himDisplay.textContent = "No status yet";
        himSeen.classList.remove('seen');
    }
    updateVisibility();
});

onValue(ref(db, 'v2/statuses/her'), (snapshot) => {
    const data = snapshot.val();
    currentStatuses.her = data;
    if (data) {
        herDisplay.textContent = data.text;
        adjustFontSize(herDisplay, data.text);
        herTime.textContent = formatTime(data.timestamp);
        lastTimestamps.her = data.timestamp;
        herRelative.textContent = getRelativeTimeStr(data.timestamp);
        herSeen.classList.toggle('seen', !!data.seen);
    } else {
        herDisplay.textContent = "No status yet";
        herSeen.classList.remove('seen');
    }
    updateVisibility();
});

// Chat Logic
let editingMessageId = null;
let typingTimeout = null;

function getVerifiedRole() {
    if (isPasswordVerified.him) return 'him';
    if (isPasswordVerified.her) return 'her';
    return null;
}

function openChat() {
    if (!getVerifiedRole()) {
        alert("Please verify yourself as Him or Her first by clicking Update Status!");
        return;
    }
    chatModal.classList.remove('hidden');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function closeChat() {
    chatModal.classList.add('hidden');
    cancelEdit();
}

function cancelEdit() {
    editingMessageId = null;
    editingBanner.classList.add('hidden');
    chatInput.value = "";
}

async function sendMessage() {
    const role = getVerifiedRole();
    const text = chatInput.value.trim();
    if (!text || !role) return;

    if (editingMessageId) {
        await update(ref(db, `v2/chat/${editingMessageId}`), {
            text: text,
            edited: true,
            editTimestamp: serverTimestamp()
        });
        editingMessageId = null;
        editingBanner.classList.add('hidden');
    } else {
        await push(ref(db, 'v2/chat'), {
            sender: role,
            text: text,
            timestamp: serverTimestamp(),
            deleted: false
        });
    }
    chatInput.value = "";
    playSound('/click_sound.mp3');
}

async function deleteMessage(id) {
    const role = getVerifiedRole();
    if (!role) return;
    await update(ref(db, `v2/chat/${id}`), {
        deleted: true,
        text: "This message was deleted"
    });
    playSound('/error_sound.mp3');
}

function startEditMessage(id, text) {
    editingMessageId = id;
    chatInput.value = text;
    editingBanner.classList.remove('hidden');
    chatInput.focus();
}

async function reactToMessage(id, emoji) {
    const role = getVerifiedRole();
    if (!role) return;
    const reactionRef = ref(db, `v2/chat/${id}/reactions/${emoji}/${role}`);
    // Simple toggle
    let currentVal = false;
    onValue(reactionRef, (snap) => currentVal = !!snap.val(), { onlyOnce: true });
    await set(reactionRef, !currentVal);
}

// Watch Typing
chatInput.addEventListener('input', () => {
    const role = getVerifiedRole();
    if (!role) return;
    set(ref(db, `v2/typing/${role}`), true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        set(ref(db, `v2/typing/${role}`), false);
    }, 2000);
});

// Typing Indicator Listener
onValue(ref(db, 'v2/typing'), (snapshot) => {
    const data = snapshot.val() || {};
    const role = getVerifiedRole();
    const other = role === 'him' ? 'her' : 'him';
    if (data[other]) {
        typingIndicator.textContent = `${other.toUpperCase()} is typing...`;
    } else {
        typingIndicator.textContent = "";
    }
});

// Chat Messages Listener
let prevMessageCount = 0;
onValue(ref(db, 'v2/chat'), (snapshot) => {
    const data = snapshot.val();
    const role = getVerifiedRole();
    
    // Determine if we should scroll to bottom after rendering
    // We scroll if the user was already near the bottom or if a new message was added
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;
    const currentMessageCount = data ? Object.keys(data).length : 0;
    const isNewMessage = currentMessageCount > prevMessageCount;

    chatMessages.innerHTML = "";
    if (!data) {
        prevMessageCount = 0;
        return;
    }

    Object.entries(data).sort((a, b) => a[1].timestamp - b[1].timestamp).forEach(([id, msg]) => {
        const div = document.createElement('div');
        div.className = `msg-bubble ${msg.sender} ${msg.deleted ? 'deleted' : ''}`;
        
        let actionsHtml = "";
        if (!msg.deleted && msg.sender === role) {
            actionsHtml = `
                <div class="msg-actions">
                    <button class="msg-action-btn edit-msg" data-id="${id}">✎</button>
                    <button class="msg-action-btn del-msg" data-id="${id}">✕</button>
                </div>
            `;
        }

        let reactionsHtml = '<div class="reactions-list">';
        if (msg.reactions) {
            Object.entries(msg.reactions).forEach(([emoji, voters]) => {
                const count = Object.values(voters).filter(v => v === true).length;
                if (count > 0) {
                    const active = role && voters[role] ? 'active' : '';
                    reactionsHtml += `<span class="reaction-chip ${active}" data-id="${id}" data-emoji="${emoji}">${emoji} ${count}</span>`;
                }
            });
        }
        reactionsHtml += `<span class="reaction-chip add-reaction" data-id="${id}">+</span></div>`;

        div.innerHTML = `
            ${actionsHtml}
            <div class="msg-sender-label">${msg.sender}</div>
            <div class="msg-text">${msg.text}${msg.edited ? ' <small>(edited)</small>' : ''}</div>
            <span class="msg-meta">${formatTime(msg.timestamp)}</span>
            ${reactionsHtml}
        `;

        // Event delegation or direct listeners
        if (div.querySelector('.edit-msg')) div.querySelector('.edit-msg').onclick = () => startEditMessage(id, msg.text);
        if (div.querySelector('.del-msg')) div.querySelector('.del-msg').onclick = () => deleteMessage(id);
        div.querySelectorAll('.reaction-chip').forEach(chip => {
            if (chip.classList.contains('add-reaction')) {
                chip.onclick = (e) => {
                    e.stopPropagation();
                    const existingPicker = chip.parentElement.querySelector('.reaction-picker');
                    if (existingPicker) {
                        existingPicker.remove();
                        return;
                    }
                    // Close any other open pickers in the chat first
                    document.querySelectorAll('.reaction-picker').forEach(p => p.remove());

                    const picker = document.createElement('div');
                    picker.className = 'reaction-picker';
                    ['❤️', '😂', '😮', '😢', '👍', '🔥'].forEach(emo => {
                        const span = document.createElement('span');
                        span.className = 'picker-emoji';
                        span.textContent = emo;
                        span.onclick = (pe) => { 
                            pe.stopPropagation();
                            reactToMessage(id, emo); 
                            picker.remove(); 
                        };
                        picker.appendChild(span);
                    });
                    chip.parentElement.appendChild(picker);
                };
            } else {
                chip.onclick = () => reactToMessage(id, chip.dataset.emoji);
            }
        });

        chatMessages.appendChild(div);
    });

    if (isAtBottom || isNewMessage) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    prevMessageCount = currentMessageCount;
});

// UI Dialogs / Modals
function openModal(role) {
    currentRole = role;
    modal.classList.remove('hidden');
    modalTitle.textContent = `Update ${role.toUpperCase()}'s Status`;
    passInput.value = "";
    statusInput.value = "";

    if (isPasswordVerified[role]) {
        passwordArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
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

function handleSubmit() {
    if (!currentRole) return;
    if (!isPasswordVerified[currentRole]) {
        if (passInput.value.trim() === PASSWORDS[currentRole]) {
            playSound('/success_sound.mp3');
            isPasswordVerified[currentRole] = true;
            localStorage.setItem(`verified_${currentRole}`, 'true');
            updateVisibility();
            passwordArea.classList.add('hidden');
            statusArea.classList.remove('hidden');
            statusInput.focus();
        } else {
            playSound('/error_sound.mp3');
            alert("Incorrect password!");
        }
    } else {
        const text = statusInput.value.trim();
        if (!text) return;
        set(ref(db, `v2/statuses/${currentRole}`), { text, timestamp: Date.now(), seen: false })
            .then(() => { playSound('/click_sound.mp3'); modal.classList.add('hidden'); });
    }
}

async function toggleSeen(role) {
    const canMarkHim = (role === 'him' && isPasswordVerified.her);
    const canMarkHer = (role === 'her' && isPasswordVerified.him);
    if (canMarkHim || canMarkHer) {
        const data = currentStatuses[role];
        if (data) {
            const newSeenValue = data.seen ? false : Date.now();
            update(ref(db, `v2/statuses/${role}`), { seen: newSeenValue });
            playSound('/click_sound.mp3');
        }
    } else {
        playSound('/error_sound.mp3');
        alert(`You must be verified as ${role === 'him' ? 'HER' : 'HIM'} to mark this!`);
    }
}

// Highlights & All other logic (omitted for brevity but kept functional as per previous version)
function openHighlights(role) {
    highlightsModal.classList.remove('hidden');
    highlightsTitle.textContent = role === 'all' ? "Combined Highlights" : `${role.toUpperCase()}'s Highlights`;
    highlightsList.innerHTML = "Loading...";
    const render = (himData, herData) => {
        highlightsList.innerHTML = "";
        let items = [];
        if (himData) items = items.concat(Object.entries(himData).map(([id,v])=>({id, role:'him', ...v})));
        if (herData) items = items.concat(Object.entries(herData).map(([id,v])=>({id, role:'her', ...v})));
        if (!items.length) { highlightsList.innerHTML = "No highlights yet."; return; }
        items.sort((a,b)=>b.timestamp - a.timestamp).forEach(item => {
            const d = document.createElement('div');
            d.className = `highlight-item ${item.role}`;
            d.innerHTML = `
                <div class="highlight-owner">${item.role.toUpperCase()}</div>
                <div class="highlight-text">${item.text}</div>
                <div class="highlight-meta"><span>${formatTime(item.timestamp)}</span></div>
                ${isPasswordVerified[item.role] ? `<button class="delete-highlight" data-id="${item.id}" data-role="${item.role}">Delete</button>` : ''}
            `;
            const btn = d.querySelector('.delete-highlight');
            if (btn) btn.onclick = () => remove(ref(db, `v2/highlights/${item.role}/${item.id}`));
            highlightsList.appendChild(d);
        });
    };
    if (role === 'all') {
        onValue(ref(db, 'v2/highlights/him'), (sh) => onValue(ref(db, 'v2/highlights/her'), (sh2) => render(sh.val(), sh2.val())));
    } else {
        onValue(ref(db, `v2/highlights/${role}`), (s) => render(role === 'him' ? s.val() : null, role === 'her' ? s.val() : null));
    }
}

// Events
editHimBtn.onclick = () => openModal('him');
editHerBtn.onclick = () => openModal('her');
himSeen.onclick = () => toggleSeen('him');
herSeen.onclick = () => toggleSeen('her');
viewAllHighlightsBtn.onclick = () => openHighlights('all');
viewHimHighlightsBtn.onclick = () => openHighlights('him');
viewHerHighlightsBtn.onclick = () => openHighlights('her');
openChatBtn.onclick = openChat;
closeChatBtn.onclick = closeChat;
sendChatBtn.onclick = sendMessage;
cancelBtn.onclick = () => modal.classList.add('hidden');
submitBtn.onclick = handleSubmit;
closeHighlightsBtn.onclick = () => highlightsModal.classList.add('hidden');
cancelEditBtn.onclick = cancelEdit;
confirmNoBtn.onclick = () => confirmModal.classList.add('hidden');
confirmYesBtn.onclick = async () => {
    const role = addHimHighlightBtn.classList.contains('hidden') ? 'her' : 'him';
    const status = currentStatuses[role];
    if (status) {
        await push(ref(db, `v2/highlights/${role}`), { text: status.text, timestamp: Date.now() });
        confirmModal.classList.add('hidden');
    }
};
addHimHighlightBtn.onclick = () => confirmModal.classList.remove('hidden');
addHerHighlightBtn.onclick = () => confirmModal.classList.remove('hidden');
chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
window.onclick = (e) => { 
    if (e.target.classList.contains('modal')) e.target.classList.add('hidden'); 
    // Close any reaction pickers when clicking elsewhere
    if (!e.target.closest('.reaction-picker') && !e.target.closest('.add-reaction')) {
        document.querySelectorAll('.reaction-picker').forEach(p => p.remove());
    }
};
updateVisibility();