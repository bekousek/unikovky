// ====== AI CONFIG ======
const AI_WORKER_URL = 'https://unikovky-ai.ondrejbek8.workers.dev';

// ====== FIREBASE CONFIG ======
const firebaseConfig = FIREBASE_CONFIG;

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ====== ENCODING / DECODING (for share URLs) ======
function encodeRoom(config) {
    const json = JSON.stringify(config);
    const utf8 = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeRoom(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const utf8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) utf8[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(utf8));
}

// ====== AUTH ======
let currentUser = null;
let guestMode = false;

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        guestMode = false;
        updateUserUI(user);
    }
    route();
});

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error('Sign-in error:', err);
        alert('Přihlášení se nezdařilo. Zkuste to znovu.');
    });
}

function continueAsGuest() {
    guestMode = true;
    currentUser = null;
    route();
}

function signOut() {
    guestMode = false;
    auth.signOut();
}

function isLoggedIn() {
    return currentUser || guestMode;
}

function updateUserUI(user) {
    const el = document.getElementById('user-info');
    if (!el) return;
    if (guestMode) {
        el.innerHTML = `
            <span class="user-name">Bez přihlášení</span>
            <button class="btn-logout" onclick="signInWithGoogle()">Přihlásit se</button>
        `;
    } else if (user) {
        el.innerHTML = `
            <img class="user-avatar" src="${user.photoURL || ''}" alt="" referrerpolicy="no-referrer">
            <span class="user-name">${escapeHtml(user.displayName || user.email)}</span>
            <button class="btn-logout" onclick="signOut()">Odhlásit</button>
        `;
    }
}

// ====== FIRESTORE HELPERS ======
function roomsCollection() {
    return db.collection('users').doc(currentUser.uid).collection('rooms');
}

async function loadRooms() {
    const snap = await roomsCollection().orderBy('number', 'asc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function saveRoom(roomData) {
    if (roomData.id) {
        await roomsCollection().doc(roomData.id).update({
            config: roomData.config,
            theme: roomData.theme,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return roomData.id;
    } else {
        const rooms = await loadRooms();
        const nextNum = rooms.length > 0 ? Math.max(...rooms.map(r => r.number || 0)) + 1 : 1;
        const ref = await roomsCollection().add({
            number: nextNum,
            config: roomData.config,
            theme: roomData.theme,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ref.id;
    }
}

async function deleteRoomFromDB(docId) {
    await roomsCollection().doc(docId).delete();
}

// ====== ROUTER ======
const router = {
    go(path) {
        window.location.hash = path;
    }
};

function route() {
    const hash = window.location.hash || '#/';
    const path = hash.slice(1);

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

    if (path.startsWith('/play/')) {
        const encoded = path.slice(6);
        try {
            const config = decodeRoom(encoded);
            initGame(config);
        } catch (e) {
            alert('Neplatný odkaz na únikovku.');
            router.go('/');
        }
        return;
    }

    if (!isLoggedIn()) {
        document.getElementById('screen-login').classList.add('active');
        return;
    }

    if (path === '/create') {
        showEditor();
    } else if (path.startsWith('/edit/')) {
        const docId = path.slice(6);
        showEditor(docId);
    } else if (path === '/share') {
        document.getElementById('screen-share').classList.add('active');
    } else {
        showDashboard();
    }
}

window.addEventListener('hashchange', route);

// ====== DASHBOARD ======
function showDashboard() {
    document.getElementById('screen-dashboard').classList.add('active');
    updateUserUI(currentUser);
    renderRoomsList();
}

async function renderRoomsList() {
    const list = document.getElementById('rooms-list');
    const empty = document.getElementById('empty-state');
    const loading = document.getElementById('rooms-loading');

    list.style.display = 'none';
    empty.style.display = 'none';
    loading.style.display = 'none';

    if (guestMode) {
        empty.style.display = 'block';
        empty.querySelector('h2').textContent = 'Režim bez přihlášení';
        empty.querySelector('p').textContent = 'Vytvořené únikovky se neukládají. Pro uložení se přihlaste Google účtem.';
        return;
    }

    loading.style.display = 'block';

    try {
        const rooms = await loadRooms();

        loading.style.display = 'none';

        if (rooms.length === 0) {
            empty.style.display = 'block';
            return;
        }

        list.style.display = 'grid';
        list.innerHTML = rooms.map(room => {
            const theme = THEMES[room.theme] || THEMES.physics;
            const num = String(room.number || 0).padStart(3, '0');
            const date = room.createdAt?.toDate ? room.createdAt.toDate().toLocaleDateString('cs-CZ') : '';
            const taskCount = room.config.q.length;
            const url = buildShareUrl(room.config);

            return `
            <div class="room-card">
                <span class="room-card-number">#${num}</span>
                <div class="room-card-header">
                    <span class="room-card-icon">${theme.icon}</span>
                    <span class="room-card-title">${escapeHtml(room.config.t)}</span>
                </div>
                <div class="room-card-meta">${theme.name} · ${taskCount} úloh · ${date}</div>
                <div class="room-card-actions">
                    <button class="btn-card-copy" onclick="copyUrl('${escapeAttr(url)}', this)">Kopírovat odkaz</button>
                    <button onclick="previewFromDash('${escapeAttr(room.id)}')">Vyzkoušet</button>
                    <button onclick="editRoom('${escapeAttr(room.id)}')">Upravit</button>
                    <button class="btn-card-delete" onclick="deleteRoom('${escapeAttr(room.id)}')">Smazat</button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        loading.style.display = 'none';
        list.style.display = 'none';
        empty.style.display = 'block';
        console.error('Error loading rooms:', err);
    }
}

function buildShareUrl(config) {
    const encoded = encodeRoom(config);
    const base = window.location.origin + window.location.pathname;
    return base + '#/play/' + encoded;
}

function copyUrl(url, btn) {
    navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Zkopírováno!';
        setTimeout(() => btn.textContent = orig, 2000);
    });
}

async function previewFromDash(docId) {
    const doc = await roomsCollection().doc(docId).get();
    if (!doc.exists) return;
    const encoded = encodeRoom(doc.data().config);
    window.open('#/play/' + encoded, '_blank');
}

function editRoom(docId) {
    router.go('/edit/' + docId);
}

async function deleteRoom(docId) {
    if (!confirm('Opravdu chcete smazat tuto únikovku?')) return;
    await deleteRoomFromDB(docId);
    renderRoomsList();
}

// ====== EDITOR ======
let editorState = {
    theme: 'physics',
    questions: [],
    editingId: null
};

async function showEditor(editDocId) {
    document.getElementById('screen-editor').classList.add('active');

    if (editDocId && !guestMode && currentUser) {
        try {
            const doc = await roomsCollection().doc(editDocId).get();
            if (doc.exists) {
                const data = doc.data();
                editorState.theme = data.config.e;
                editorState.editingId = editDocId;
                document.getElementById('room-title').value = data.config.t;
                document.getElementById('editor-title').textContent = `Upravit #${String(data.number || 0).padStart(3, '0')}`;
                editorState.questions = data.config.q.map(q => ({
                    title: q.t,
                    description: q.d,
                    formula: q.f || '',
                    hint: q.h || '',
                    type: q.y,
                    options: q.o || ['', '', '', ''],
                    correct: q.c
                }));
                renderThemePicker();
                renderQuestions();
                return;
            }
        } catch (e) {
            console.error('Error loading room for edit:', e);
        }
    }

    editorState.theme = 'physics';
    editorState.questions = [];
    editorState.editingId = null;
    document.getElementById('room-title').value = '';
    document.getElementById('editor-title').textContent = 'Nová únikovka';
    renderThemePicker();
    renderQuestions();
}

function renderThemePicker() {
    const picker = document.getElementById('theme-picker');
    picker.innerHTML = Object.values(THEMES).map(theme => `
        <div class="theme-card ${editorState.theme === theme.id ? 'selected' : ''}" onclick="selectTheme('${theme.id}')">
            <div class="theme-card-icon">${theme.icon}</div>
            <div class="theme-card-name">${theme.name}</div>
        </div>
    `).join('');
}

function selectTheme(id) {
    editorState.theme = id;
    renderThemePicker();
}

function addQuestion() {
    if (editorState.questions.length >= 5) return;
    editorState.questions.push({
        title: '',
        description: '',
        formula: '',
        hint: '',
        type: 'c',
        options: ['', '', '', ''],
        correct: 0
    });
    renderQuestions();
    const list = document.getElementById('questions-list');
    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeQuestion(index) {
    editorState.questions.splice(index, 1);
    renderQuestions();
}

function renderQuestions() {
    const list = document.getElementById('questions-list');
    document.getElementById('task-count').textContent = `(${editorState.questions.length}/5)`;
    document.getElementById('add-question-btn').style.display = editorState.questions.length >= 5 ? 'none' : '';

    list.innerHTML = editorState.questions.map((q, i) => `
        <div class="question-card" data-index="${i}">
            <div class="question-card-header">
                <span class="question-number">Otázka ${i + 1}</span>
                <button class="question-remove" onclick="removeQuestion(${i})" title="Odebrat">&times;</button>
            </div>
            <div class="field-group">
                <label class="field-label">Název / nadpis otázky</label>
                <input type="text" class="input-small" placeholder="např. Newtonův zákon síly" value="${escapeAttr(q.title)}" onchange="updateQ(${i},'title',this.value)">
            </div>
            <div class="field-group">
                <label class="field-label">Zadání úlohy</label>
                <textarea class="input-small" placeholder="Popište úlohu, kterou mají žáci vyřešit..." onchange="updateQ(${i},'description',this.value)">${escapeHtml(q.description)}</textarea>
            </div>
            <div class="field-group">
                <label class="field-label">Vzorec (nepovinné)</label>
                <input type="text" class="input-small" placeholder="např. F = m · a" value="${escapeAttr(q.formula)}" onchange="updateQ(${i},'formula',this.value)">
            </div>
            <div class="field-group">
                <label class="field-label">Nápověda (nepovinné)</label>
                <input type="text" class="input-small" placeholder="Krátká nápověda pro žáky..." value="${escapeAttr(q.hint)}" onchange="updateQ(${i},'hint',this.value)">
            </div>
            <div class="field-group">
                <label class="field-label">Typ odpovědi</label>
                <div class="type-selector">
                    <button class="type-btn ${q.type === 'c' ? 'active' : ''}" onclick="setQType(${i},'c')">Výběr z možností</button>
                    <button class="type-btn ${q.type === 'n' ? 'active' : ''}" onclick="setQType(${i},'n')">Číslo</button>
                    <button class="type-btn ${q.type === 't' ? 'active' : ''}" onclick="setQType(${i},'t')">Text</button>
                </div>
            </div>
            ${q.type === 'c' ? renderChoiceFields(i, q) : ''}
            ${q.type === 'n' ? renderNumberField(i, q) : ''}
            ${q.type === 't' ? renderTextField(i, q) : ''}
        </div>
    `).join('');
}

function renderChoiceFields(i, q) {
    return `
        <div class="field-group">
            <label class="field-label">Možnosti (označte správnou odpověď)</label>
            <div class="options-grid">
                ${q.options.map((opt, oi) => `
                    <div class="option-row">
                        <input type="radio" class="option-radio" name="correct-${i}" ${q.correct === oi ? 'checked' : ''} onchange="updateQ(${i},'correct',${oi})">
                        <input type="text" class="input-small" placeholder="Možnost ${String.fromCharCode(65 + oi)}" value="${escapeAttr(opt)}" onchange="updateOption(${i},${oi},this.value)">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderNumberField(i, q) {
    return `
        <div class="field-group">
            <label class="field-label">Správná odpověď (číslo)</label>
            <input type="number" class="input-small" placeholder="např. 7" value="${q.correct || ''}" onchange="updateQ(${i},'correct',parseFloat(this.value))" step="any">
        </div>
    `;
}

function renderTextField(i, q) {
    return `
        <div class="field-group">
            <label class="field-label">Správná odpověď (text, bez ohledu na velká/malá písmena)</label>
            <input type="text" class="input-small" placeholder="např. Newton" value="${escapeAttr(q.correct || '')}" onchange="updateQ(${i},'correct',this.value)">
        </div>
    `;
}

function updateQ(index, field, value) {
    editorState.questions[index][field] = value;
}

function updateOption(qi, oi, value) {
    editorState.questions[qi].options[oi] = value;
}

function setQType(index, type) {
    editorState.questions[index].type = type;
    if (type === 'c') {
        editorState.questions[index].options = editorState.questions[index].options || ['', '', '', ''];
        editorState.questions[index].correct = typeof editorState.questions[index].correct === 'number' && editorState.questions[index].correct < 4 ? editorState.questions[index].correct : 0;
    } else {
        editorState.questions[index].correct = '';
    }
    renderQuestions();
}

async function generateRoom() {
    const title = document.getElementById('room-title').value.trim();
    const qs = editorState.questions;

    const errors = [];
    if (!title) errors.push('Zadejte název únikovky.');
    if (qs.length < 3) errors.push('Přidejte alespoň 3 otázky.');
    if (qs.length > 5) errors.push('Maximum je 5 otázek.');

    qs.forEach((q, i) => {
        if (!q.title.trim()) errors.push(`Otázka ${i + 1}: chybí název.`);
        if (!q.description.trim()) errors.push(`Otázka ${i + 1}: chybí zadání.`);
        if (q.type === 'c') {
            const filledOpts = q.options.filter(o => o.trim());
            if (filledOpts.length < 2) errors.push(`Otázka ${i + 1}: vyplňte alespoň 2 možnosti.`);
        }
        if (q.type === 'n' && (q.correct === '' || q.correct === null || isNaN(q.correct))) {
            errors.push(`Otázka ${i + 1}: zadejte správnou číselnou odpověď.`);
        }
        if (q.type === 't' && !String(q.correct).trim()) {
            errors.push(`Otázka ${i + 1}: zadejte správnou textovou odpověď.`);
        }
    });

    if (errors.length > 0) {
        alert(errors.join('\n'));
        return;
    }

    const btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.textContent = 'Ukládám...';

    const code = Array.from({ length: qs.length }, () => Math.floor(Math.random() * 9) + 1).join('');

    const config = {
        t: title,
        e: editorState.theme,
        k: code,
        q: qs.map(q => {
            const out = { t: q.title.trim(), d: q.description.trim(), y: q.type, c: q.correct };
            if (q.formula.trim()) out.f = q.formula.trim();
            if (q.hint.trim()) out.h = q.hint.trim();
            if (q.type === 'c') out.o = q.options.filter(o => o.trim());
            return out;
        })
    };

    try {
        if (!guestMode && currentUser) {
            await saveRoom({
                id: editorState.editingId,
                config,
                theme: editorState.theme
            });
        }

        const url = buildShareUrl(config);
        document.getElementById('share-url').value = url;
        document.getElementById('copy-feedback').textContent = '';
        currentShareConfig = config;
        router.go('/share');
    } catch (err) {
        console.error('Error saving room:', err);
        alert('Nepodařilo se uložit únikovku. Zkuste to znovu.');
    } finally {
        btn.disabled = false;
        btn.textContent = editorState.editingId ? 'Uložit změny' : 'Vytvořit únikovku';
    }
}

let currentShareConfig = null;

function copyShareUrl() {
    const input = document.getElementById('share-url');
    navigator.clipboard.writeText(input.value).then(() => {
        document.getElementById('copy-feedback').textContent = 'Odkaz zkopírován do schránky!';
    });
}

function previewRoom() {
    if (currentShareConfig) {
        const encoded = encodeRoom(currentShareConfig);
        window.open('#/play/' + encoded, '_blank');
    }
}

// ====== GAME ENGINE ======
let gameState = {
    config: null,
    solved: {},
    startTime: null
};

function initGame(config) {
    gameState.config = config;
    gameState.solved = {};
    gameState.startTime = null;

    const theme = THEMES[config.e] || THEMES.physics;

    document.getElementById('game-theme-icon').textContent = theme.icon;
    document.getElementById('game-title').textContent = config.t;
    document.getElementById('game-theme-name').textContent = theme.name;
    document.getElementById('game-task-count').textContent = config.q.length;

    document.getElementById('screen-game-intro').classList.add('active');
}

function startGame() {
    gameState.startTime = Date.now();
    document.getElementById('screen-game-intro').classList.remove('active');
    document.getElementById('screen-game-room').classList.add('active');

    const config = gameState.config;
    const theme = THEMES[config.e] || THEMES.physics;

    document.getElementById('room-header-title').textContent = `${theme.headerIcon} ${config.t}`;

    let codesHtml = '<span class="code-label">Kódy:</span>';
    for (let i = 0; i < config.q.length; i++) {
        codesHtml += `<span class="code-slot" id="code-${i}">?</span>`;
    }
    codesHtml += '<button class="btn-unlock" id="unlock-btn" onclick="showDoorLock()" style="display:none;">🔓 Odemknout</button>';
    document.getElementById('codes-display').innerHTML = codesHtml;

    document.getElementById('room-svg-container').innerHTML = generateRoomSVG(config.e, config.q.length);

    document.querySelectorAll('.clickable-object').forEach(el => {
        el.addEventListener('click', () => {
            const taskIdx = parseInt(el.dataset.task);
            if (!gameState.solved[taskIdx]) openGameTask(taskIdx);
        });
    });
}

function openGameTask(index) {
    const q = gameState.config.q[index];
    const theme = THEMES[gameState.config.e] || THEMES.physics;
    const obj = theme.objects[index] || { icon: '❓', label: 'Úkol' };

    let html = `<div class="task-header"><h3>${obj.icon} ${escapeHtml(q.t)}</h3></div>`;
    html += `<div class="task-description">${escapeHtml(q.d).replace(/\n/g, '<br>')}</div>`;

    if (q.f) html += `<div class="task-formula">${escapeHtml(q.f)}</div>`;
    if (q.h) html += `<div class="task-hint">💡 ${escapeHtml(q.h)}</div>`;

    if (q.y === 'c') {
        html += '<div class="task-options">';
        const labels = ['A', 'B', 'C', 'D'];
        (q.o || []).forEach((opt, oi) => {
            const isCorrect = oi === q.c;
            html += `<div class="task-option" onclick="checkGameChoice(${index},this,${isCorrect})">${labels[oi]}) ${escapeHtml(opt)}</div>`;
        });
        html += '</div>';
    } else if (q.y === 'n') {
        html += `<div class="task-input-group">
            <input type="number" class="task-input" id="game-answer-${index}" placeholder="Zadej číslo" step="any">
            <button class="task-submit" onclick="checkGameNumber(${index})">Ověřit</button>
        </div>`;
    } else if (q.y === 't') {
        html += `<div class="task-input-group">
            <input type="text" class="task-input" id="game-answer-${index}" placeholder="Zadej odpověď">
            <button class="task-submit" onclick="checkGameText(${index})">Ověřit</button>
        </div>`;
    }

    html += `<div class="task-feedback" id="game-feedback-${index}"></div>`;

    document.getElementById('task-content').innerHTML = html;
    document.getElementById('task-modal').classList.add('active');

    const inputEl = document.getElementById(`game-answer-${index}`);
    if (inputEl) {
        inputEl.focus();
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (gameState.config.q[index].y === 'n') checkGameNumber(index);
                else checkGameText(index);
            }
        });
    }
}

function closeTask() {
    document.getElementById('task-modal').classList.remove('active');
}

function checkGameChoice(taskIndex, element, isCorrect) {
    if (gameState.solved[taskIndex]) return;
    const fb = document.getElementById(`game-feedback-${taskIndex}`);

    if (isCorrect) {
        element.classList.add('correct');
        element.parentElement.querySelectorAll('.task-option').forEach(o => o.style.pointerEvents = 'none');
        solveGameTask(taskIndex, fb);
    } else {
        element.classList.add('wrong');
        element.style.pointerEvents = 'none';
        fb.className = 'task-feedback error';
        fb.textContent = '❌ Špatná odpověď, zkus to znovu!';
    }
}

function checkGameNumber(taskIndex) {
    if (gameState.solved[taskIndex]) return;
    const input = document.getElementById(`game-answer-${taskIndex}`);
    const fb = document.getElementById(`game-feedback-${taskIndex}`);
    const val = parseFloat(input.value);
    const correct = parseFloat(gameState.config.q[taskIndex].c);

    if (isNaN(val)) {
        fb.className = 'task-feedback error';
        fb.textContent = '❌ Zadej prosím číslo!';
        return;
    }

    if (Math.abs(val - correct) < Math.max(0.01, Math.abs(correct) * 0.05)) {
        input.disabled = true;
        solveGameTask(taskIndex, fb);
    } else {
        fb.className = 'task-feedback error';
        fb.textContent = '❌ Špatná odpověď, zkus to znovu!';
        input.value = '';
        input.focus();
    }
}

function checkGameText(taskIndex) {
    if (gameState.solved[taskIndex]) return;
    const input = document.getElementById(`game-answer-${taskIndex}`);
    const fb = document.getElementById(`game-feedback-${taskIndex}`);
    const val = input.value.trim().toLowerCase();
    const correct = String(gameState.config.q[taskIndex].c).trim().toLowerCase();

    if (!val) {
        fb.className = 'task-feedback error';
        fb.textContent = '❌ Zadej odpověď!';
        return;
    }

    if (val === correct) {
        input.disabled = true;
        solveGameTask(taskIndex, fb);
    } else {
        fb.className = 'task-feedback error';
        fb.textContent = '❌ Špatná odpověď, zkus to znovu!';
        input.value = '';
        input.focus();
    }
}

function solveGameTask(taskIndex, fb) {
    gameState.solved[taskIndex] = true;
    const digit = gameState.config.k[taskIndex];

    fb.className = 'task-feedback success';
    fb.textContent = `✅ Správně! Kód z tohoto úkolu je: ${digit}`;

    const slot = document.getElementById(`code-${taskIndex}`);
    if (slot) {
        slot.textContent = digit;
        slot.classList.add('solved');
    }

    const indicator = document.querySelector(`[data-task-ind="${taskIndex}"]`);
    if (indicator) {
        indicator.setAttribute('fill', '#4CAF50');
        indicator.setAttribute('opacity', '1');
    }

    const obj = document.querySelector(`.clickable-object[data-task="${taskIndex}"]`);
    if (obj) obj.classList.add('solved');

    if (Object.keys(gameState.solved).length === gameState.config.q.length) {
        document.getElementById('unlock-btn').style.display = 'inline-block';
    }
}

function showDoorLock() {
    document.getElementById('door-lock-modal').classList.add('active');
    const input = document.getElementById('lock-input');
    input.value = '';
    input.maxLength = gameState.config.k.length;
    document.getElementById('lock-message').textContent = '';
    input.focus();
}

function closeDoorLock() {
    document.getElementById('door-lock-modal').classList.remove('active');
}

function tryUnlock() {
    const input = document.getElementById('lock-input');
    const msg = document.getElementById('lock-message');
    const val = input.value.trim();

    if (val === gameState.config.k) {
        msg.className = 'lock-message success';
        msg.textContent = '✅ Kód je správný! Dveře se otevírají...';
        setTimeout(() => {
            closeDoorLock();
            document.getElementById('screen-game-room').classList.remove('active');
            showVictory();
        }, 1200);
    } else {
        msg.className = 'lock-message error';
        msg.textContent = '❌ Špatný kód! Zkontroluj pořadí číslic.';
        input.value = '';
        input.focus();
    }
}

function showVictory() {
    document.getElementById('screen-victory').classList.add('active');
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    const theme = THEMES[gameState.config.e] || THEMES.physics;

    document.getElementById('victory-text').innerHTML =
        `Všechny úlohy v <strong>${escapeHtml(theme.name)}</strong> jsi vyřešil/a správně a dveře jsou otevřené!`;
    document.getElementById('victory-stats').innerHTML = `
        <p>⏱️ Čas: <strong>${min} min ${sec} s</strong></p>
        <p>✅ Vyřešeno: <strong>${gameState.config.q.length}/${gameState.config.q.length}</strong></p>
    `;
}

// ====== AI GENERATION ======
function openAiModal() {
    document.getElementById('ai-modal').classList.add('active');
    document.getElementById('ai-topic').value = '';
    document.getElementById('ai-grade').value = '';
    document.getElementById('ai-count').value = '4';
    document.getElementById('ai-error').textContent = '';
    document.getElementById('ai-loading').style.display = 'none';
    document.getElementById('ai-generate-btn').disabled = false;
    document.getElementById('ai-topic').focus();
}

function closeAiModal() {
    document.getElementById('ai-modal').classList.remove('active');
}

async function generateWithAi() {
    const topic = document.getElementById('ai-topic').value.trim();
    const grade = document.getElementById('ai-grade').value.trim();
    const count = parseInt(document.getElementById('ai-count').value);
    const errorEl = document.getElementById('ai-error');
    const loadingEl = document.getElementById('ai-loading');
    const btn = document.getElementById('ai-generate-btn');

    if (!topic) {
        errorEl.textContent = 'Zadejte téma pro generování otázek.';
        return;
    }

    errorEl.textContent = '';
    loadingEl.style.display = 'block';
    btn.disabled = true;

    try {
        const res = await fetch(AI_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, questionCount: count, grade }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Nepodařilo se vygenerovat otázky.');
        }

        if (!data.questions || data.questions.length === 0) {
            throw new Error('AI nevrátila žádné otázky. Zkuste jiné téma.');
        }

        editorState.questions = data.questions.map(q => ({
            title: q.t || '',
            description: q.d || '',
            formula: q.f || '',
            hint: q.h || '',
            type: q.y || 'c',
            options: q.o || ['', '', '', ''],
            correct: q.c ?? 0,
        }));

        if (!document.getElementById('room-title').value.trim()) {
            document.getElementById('room-title').value = topic;
        }

        renderQuestions();
        closeAiModal();
    } catch (err) {
        errorEl.textContent = err.message || 'Nepodařilo se spojit s AI službou. Zkuste to znovu.';
    } finally {
        loadingEl.style.display = 'none';
        btn.disabled = false;
    }
}

// ====== UTILITIES ======
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

// ====== FLOATING PANEL & FEEDBACK ======
function toggleFloatingPanel() {
    document.getElementById('floating-menu').classList.toggle('open');
}

function openFeedbackModal() {
    document.getElementById('floating-menu').classList.remove('open');
    document.getElementById('feedback-modal').classList.add('active');
    document.getElementById('feedback-name').value = '';
    document.getElementById('feedback-message').value = '';
    document.getElementById('feedback-status').textContent = '';
    document.getElementById('feedback-status').className = 'feedback-status';
    document.getElementById('feedback-message').focus();
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.remove('active');
}

async function submitFeedback() {
    const name = document.getElementById('feedback-name').value.trim();
    const message = document.getElementById('feedback-message').value.trim();
    const statusEl = document.getElementById('feedback-status');

    if (!message) {
        statusEl.className = 'feedback-status error';
        statusEl.textContent = 'Napište prosím zprávu.';
        return;
    }

    try {
        await db.collection('feedback').add({
            name: name || 'Anonym',
            message,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent
        });
        statusEl.className = 'feedback-status success';
        statusEl.textContent = 'Děkujeme za zpětnou vazbu!';
        document.getElementById('feedback-message').value = '';
        setTimeout(closeFeedbackModal, 1500);
    } catch {
        const subject = encodeURIComponent('Zpětná vazba – Únikovky');
        const body = encodeURIComponent(`${name ? 'Od: ' + name + '\n\n' : ''}${message}`);
        window.open(`mailto:ondrejbek8@gmail.com?subject=${subject}&body=${body}`);
        statusEl.className = 'feedback-status success';
        statusEl.textContent = 'Otevírám e-mail...';
        setTimeout(closeFeedbackModal, 1500);
    }
}

document.addEventListener('click', (e) => {
    const panel = document.getElementById('floating-panel');
    if (panel && !panel.contains(e.target)) {
        document.getElementById('floating-menu').classList.remove('open');
    }
});

// ====== KEYBOARD ======
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTask();
        closeDoorLock();
        closeAiModal();
        closeFeedbackModal();
    }
});

document.getElementById('lock-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
});
