const TASKS = {
    1: {
        title: "📝 Tabule - Druhý Newtonův zákon",
        object: "blackboard",
        code: "7",
        content: `
            <div class="task-header"><h3>📝 Newtonův zákon síly</h3></div>
            <div class="task-description">
                Na tabuli je napsán vzorec:<br>
                <strong>F = m &middot; a</strong><br><br>
                Těleso o hmotnosti <strong>3,5 kg</strong> zrychluje se zrychlením <strong>2 m/s²</strong>.
                <br><br>Jaká síla na těleso působí?
            </div>
            <div class="task-formula">F = m &middot; a = 3,5 &middot; 2 = ?</div>
            <div class="task-hint">💡 Nápověda: Síla se počítá jako součin hmotnosti a zrychlení. Výsledek zaokrouhli na celé číslo.</div>
            <div class="task-options">
                <div class="task-option" onclick="checkAnswer(1, this, false)">A) 5 N</div>
                <div class="task-option" onclick="checkAnswer(1, this, true)">B) 7 N</div>
                <div class="task-option" onclick="checkAnswer(1, this, false)">C) 1,5 N</div>
                <div class="task-option" onclick="checkAnswer(1, this, false)">D) 10 N</div>
            </div>
            <div class="task-feedback" id="feedback-1"></div>
        `
    },
    2: {
        title: "⚖️ Váhy - Gravitační síla",
        object: "scales",
        code: "3",
        content: `
            <div class="task-header"><h3>⚖️ Gravitační síla</h3></div>
            <div class="task-description">
                Na váhách leží závaží. Víš, že gravitační zrychlení na Zemi je přibližně <strong>g = 10 m/s²</strong>.
                <br><br>
                Jaká gravitační síla (tíha) působí na těleso o hmotnosti <strong>500 g</strong>?
            </div>
            <div class="task-formula">F<sub>g</sub> = m &middot; g</div>
            <div class="task-hint">💡 Nápověda: Pozor na jednotky! Hmotnost musí být v kilogramech.</div>
            <div class="task-input-group">
                <input type="number" class="task-input" id="answer-2" placeholder="Zadej výsledek v N" step="any">
                <button class="task-submit" onclick="checkInputAnswer(2, 5)">Ověřit</button>
            </div>
            <div class="task-feedback" id="feedback-2"></div>
        `
    },
    3: {
        title: "📚 Police - Rovnoměrný pohyb",
        object: "bookshelf",
        code: "9",
        content: `
            <div class="task-header"><h3>📚 Rovnoměrný pohyb</h3></div>
            <div class="task-description">
                V jedné z knih jsi našel/a úlohu:<br><br>
                Auto jede rovnoměrnou rychlostí <strong>90 km/h</strong>. Jakou dráhu urazí za <strong>20 minut</strong>?
            </div>
            <div class="task-formula">s = v &middot; t</div>
            <div class="task-hint">💡 Nápověda: Převeď si jednotky — buď rychlost na m/s a čas na sekundy, nebo čas na hodiny. Výsledek zadej v km.</div>
            <div class="task-input-group">
                <input type="number" class="task-input" id="answer-3" placeholder="Zadej výsledek v km" step="any">
                <button class="task-submit" onclick="checkInputAnswer(3, 30)">Ověřit</button>
            </div>
            <div class="task-feedback" id="feedback-3"></div>
        `
    },
    4: {
        title: "⏱️ Kyvadlo - Přeměna energie",
        object: "pendulum",
        code: "1",
        content: `
            <div class="task-header"><h3>⏱️ Přeměna energie kyvadla</h3></div>
            <div class="task-description">
                Kyvadlo na zdi se kýve sem a tam. Při pohybu se neustále přeměňuje energie.
                <br><br>
                Seřaď správně, co se děje s energií kyvadla, když se kýve z <strong>nejvyššího bodu</strong> do <strong>nejnižšího bodu</strong>:
            </div>
            <div class="task-image">🔄</div>
            <div class="task-options">
                <div class="task-option" onclick="checkAnswer(4, this, true)">A) Polohová energie se mění na pohybovou</div>
                <div class="task-option" onclick="checkAnswer(4, this, false)">B) Pohybová energie se mění na polohovou</div>
                <div class="task-option" onclick="checkAnswer(4, this, false)">C) Tepelná energie se mění na polohovou</div>
                <div class="task-option" onclick="checkAnswer(4, this, false)">D) Energie se nikam nepřeměňuje</div>
            </div>
            <div class="task-feedback" id="feedback-4"></div>
        `
    },
    5: {
        title: "🔬 Nakloněná rovina - Tření",
        object: "microscope-table",
        code: "5",
        content: `
            <div class="task-header"><h3>🔬 Nakloněná rovina a tření</h3></div>
            <div class="task-description">
                Na stole je nakloněná rovina s kuličkou. Kulička po ní sjíždí dolů.
                <br><br>
                Jaké <strong>tři síly</strong> na kuličku při sjíždění působí?
            </div>
            <div class="task-image">⚾📐</div>
            <div class="task-options">
                <div class="task-option" onclick="checkAnswer(5, this, false)">A) Gravitační, magnetická, odstředivá</div>
                <div class="task-option" onclick="checkAnswer(5, this, false)">B) Gravitační, vztlaková, elektrická</div>
                <div class="task-option" onclick="checkAnswer(5, this, true)">C) Gravitační, třecí, normálová (kolmá reakce podložky)</div>
                <div class="task-option" onclick="checkAnswer(5, this, false)">D) Třecí, magnetická, gravitační</div>
            </div>
            <div class="task-feedback" id="feedback-5"></div>
        `
    }
};

const FINAL_CODE = "73915";

let solvedTasks = {};
let gameStartTime = null;

function startGame() {
    document.getElementById("intro-screen").classList.remove("active");
    document.getElementById("room-screen").classList.add("active");
    gameStartTime = Date.now();
}

function openTask(taskId) {
    if (solvedTasks[taskId]) return;
    const task = TASKS[taskId];
    document.getElementById("task-content").innerHTML = task.content;
    document.getElementById("task-modal").classList.add("active");
}

function closeTask() {
    document.getElementById("task-modal").classList.remove("active");
}

function checkAnswer(taskId, element, isCorrect) {
    if (solvedTasks[taskId]) return;

    const options = element.parentElement.querySelectorAll(".task-option");
    const feedback = document.getElementById(`feedback-${taskId}`);

    if (isCorrect) {
        element.classList.add("correct");
        options.forEach(opt => { opt.style.pointerEvents = "none"; });
        solveTask(taskId, feedback);
    } else {
        element.classList.add("wrong");
        element.style.pointerEvents = "none";
        feedback.className = "task-feedback error";
        feedback.textContent = "❌ Špatná odpověď, zkus to znovu!";
    }
}

function checkInputAnswer(taskId, correctValue) {
    if (solvedTasks[taskId]) return;

    const input = document.getElementById(`answer-${taskId}`);
    const feedback = document.getElementById(`feedback-${taskId}`);
    const userValue = parseFloat(input.value);

    if (isNaN(userValue)) {
        feedback.className = "task-feedback error";
        feedback.textContent = "❌ Zadej prosím číslo!";
        return;
    }

    if (Math.abs(userValue - correctValue) < 0.5) {
        input.disabled = true;
        input.parentElement.querySelector(".task-submit").disabled = true;
        solveTask(taskId, feedback);
    } else {
        feedback.className = "task-feedback error";
        feedback.textContent = "❌ Špatná odpověď, zkus to znovu!";
        input.value = "";
        input.focus();
    }
}

function solveTask(taskId, feedback) {
    const task = TASKS[taskId];
    solvedTasks[taskId] = true;

    feedback.className = "task-feedback success";
    feedback.textContent = `✅ Správně! Kód z tohoto úkolu je: ${task.code}`;

    const codeSlot = document.getElementById(`code-${taskId}`);
    codeSlot.textContent = task.code;
    codeSlot.classList.add("solved");

    const indicator = document.getElementById(`task${taskId}-indicator`);
    if (indicator) {
        indicator.setAttribute("fill", "#4CAF50");
        indicator.setAttribute("opacity", "1");
    }

    const objectEl = document.getElementById(task.object);
    if (objectEl) {
        objectEl.classList.add("solved");
    }

    if (Object.keys(solvedTasks).length === 5) {
        document.getElementById("unlock-btn").style.display = "inline-block";
    }
}

function showDoorLock() {
    document.getElementById("door-lock-screen").classList.add("active");
    document.getElementById("lock-input").value = "";
    document.getElementById("lock-message").textContent = "";
    document.getElementById("lock-input").focus();
}

function closeDoorLock() {
    document.getElementById("door-lock-screen").classList.remove("active");
}

function tryUnlock() {
    const input = document.getElementById("lock-input");
    const message = document.getElementById("lock-message");
    const code = input.value.trim();

    if (code === FINAL_CODE) {
        message.className = "lock-message success";
        message.textContent = "✅ Kód je správný! Dveře se otevírají...";
        setTimeout(() => {
            document.getElementById("door-lock-screen").classList.remove("active");
            document.getElementById("room-screen").classList.remove("active");
            showVictory();
        }, 1500);
    } else {
        message.className = "lock-message error";
        message.textContent = "❌ Špatný kód! Podívej se na pořadí kódů.";
        input.value = "";
        input.focus();
    }
}

function showVictory() {
    const screen = document.getElementById("victory-screen");
    screen.classList.add("active");

    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    document.getElementById("victory-stats").innerHTML = `
        <p>⏱️ Čas úniku: <strong>${minutes} min ${seconds} s</strong></p>
        <p>✅ Vyřešené úlohy: <strong>5/5</strong></p>
    `;
}

function resetGame() {
    solvedTasks = {};
    gameStartTime = null;

    for (let i = 1; i <= 5; i++) {
        document.getElementById(`code-${i}`).textContent = "?";
        document.getElementById(`code-${i}`).classList.remove("solved");

        const indicator = document.getElementById(`task${i}-indicator`);
        if (indicator) {
            indicator.setAttribute("fill", "#666");
            indicator.setAttribute("opacity", "0.5");
        }

        const obj = document.getElementById(TASKS[i].object);
        if (obj) obj.classList.remove("solved");
    }

    document.getElementById("unlock-btn").style.display = "none";
    document.getElementById("victory-screen").classList.remove("active");
    document.getElementById("intro-screen").classList.add("active");
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeTask();
        closeDoorLock();
    }
});

document.getElementById("lock-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
});
