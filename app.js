/* ==========================================================================
   PYTHON QUEST — THE CODE BREAKERS
   Core JavaScript Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // ----------------------------------------------------------------------
    const state = {
        studentName: localStorage.getItem('pq_student_name') || '',
        xp: parseInt(localStorage.getItem('pq_xp')) || 0,
        unlockedLevel: parseInt(localStorage.getItem('pq_unlocked')) || 1,
        currentLevel: 1,
        currentStage: 'learn', // 'learn', 'play', 'code', 'boss'
        lives: 30, // 30 LIVES PER LEVEL
        maxLives: 30,
        hints: 3,
        proctorMode: false,
        tabSwitches: 0,
        soundEnabled: true,
        lastErrorMsg: '',
        examScore: 0,
        examLives: 30,
        examAnswers: {},
        examTimerSeconds: 45 * 60,
        pyodide: null,
        pyodideLoading: false,
        mistakeLogs: JSON.parse(localStorage.getItem('pq_mistakes')) || []
    };

    const RANKS = [
        { minXP: 0, name: 'ROOKIE CODER', icon: '🧑‍💻', target: 100 },
        { minXP: 100, name: 'PYTHON EXPLORER', icon: '🥉', target: 350 },
        { minXP: 350, name: 'CODE RUNNER', icon: '🥈', target: 800 },
        { minXP: 800, name: 'PYTHON HACKER', icon: '🥇', target: 1200 },
        { minXP: 1200, name: 'TERM-I CODE MASTER', icon: '👑', target: 2000 }
    ];

    // Pre-populated Classmate Competitors Data Store
    const DEFAULT_CLASSMATES = [
        { name: "Aadhi Kailash", xp: 850, level: 6, lives: 28, mistakes: ["Level 2: Selected 3.4 for 17%5", "Level 4: Missing colon in for loop"] },
        { name: "Anirudh Ram", xp: 620, level: 5, lives: 25, mistakes: ["Level 1: Selected '2number' as identifier"] },
        { name: "Ajay", xp: 940, level: 7, lives: 29, mistakes: ["Level 3: Sliced L[1:3] instead of L[1:4]"] },
        { name: "Mehabob", xp: 480, level: 4, lives: 22, mistakes: ["Level 2: Floating division vs floor division mixup"] },
        { name: "Varshika", xp: 1100, level: 7, lives: 30, mistakes: [] }
    ];

    // ----------------------------------------------------------------------
    // 2. WEB AUDIO SYNTHESIZER
    // ----------------------------------------------------------------------
    const AudioEngine = {
        ctx: null,
        init() {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        playTone(freq, type, duration) {
            if (!state.soundEnabled) return;
            try {
                this.init();
                if (this.ctx.state === 'suspended') this.ctx.resume();
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type || 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {
                console.warn('Audio play error:', e);
            }
        },
        click() { this.playTone(600, 'sine', 0.05); },
        success() {
            if (!state.soundEnabled) return;
            this.playTone(523.25, 'triangle', 0.1);
            setTimeout(() => this.playTone(659.25, 'triangle', 0.1), 100);
            setTimeout(() => this.playTone(783.99, 'triangle', 0.2), 200);
        },
        error() {
            if (!state.soundEnabled) return;
            this.playTone(180, 'sawtooth', 0.2);
            setTimeout(() => this.playTone(140, 'sawtooth', 0.3), 150);
        },
        levelUp() {
            if (!state.soundEnabled) return;
            const notes = [440, 554.37, 659.25, 880];
            notes.forEach((freq, idx) => {
                setTimeout(() => this.playTone(freq, 'square', 0.15), idx * 120);
            });
        }
    };

    // ----------------------------------------------------------------------
    // 3. CURRICULUM DATA
    // ----------------------------------------------------------------------
    const LEVELS_DATA = {
        1: {
            id: 1,
            title: "LEVEL 1 — PYTHON BASE CAMP",
            subtitle: "Basics, Identifiers & Data Types",
            learn: {
                title: "Python Objects & Valid Identifiers",
                body: `
                    <p>Welcome to Python Base Camp! In Python, every variable name must be a valid <strong>Identifier</strong>.</p>
                    <h4>Rules for Python Identifiers:</h4>
                    <ul>
                        <li>Must start with a letter (A-Z, a-z) or an underscore (<code>_</code>).</li>
                        <li>Cannot start with a digit (e.g., <code>2number</code> is ❌ INVALID).</li>
                        <li>Can contain letters, digits, and underscores.</li>
                        <li>Hyphens and spaces are NOT allowed (e.g., <code>student-name</code> is ❌ INVALID).</li>
                        <li>Python Keywords (like <code>class</code>, <code>if</code>, <code>for</code>) cannot be used!</li>
                    </ul>
                    <hr style="margin: 12px 0; opacity: 0.1;">
                    <h4>Core Data Types:</h4>
                    <pre>String:      "Python"               (Immutable)
List:        [10, 20, 30]           (Mutable)
Dictionary:  {"name": "Ravi"}       (Mutable)
Set:         {1, 2, 3}              (Mutable)</pre>
                `
            },
            play: { title: "Identifier Scanner", desc: "Drag valid identifiers into the safe!" },
            code: {
                title: "Declare & Print Identifiers",
                desc: `Write a Python program that creates a variable <code>student_name = "Anu"</code> and prints it using <code>print(student_name)</code>.`,
                initialCode: `# Declare student_name and print it\n`,
                expectedOutput: "Anu"
            },
            boss: {
                title: "Base Camp Boss: Type Mutability Classifier",
                desc: `Write a program that defines an immutable string <code>s = "PYTHON"</code> and a mutable list <code>L = [10, 20]</code>, then prints both on separate lines.`,
                initialCode: `s = "PYTHON"\nL = [10, 20]\nprint(s)\nprint(L)`,
                expectedOutput: "PYTHON\n[10, 20]"
            }
        },
        2: {
            id: 2,
            title: "LEVEL 2 — OPERATOR LAB",
            subtitle: "Arithmetic, Integer Division & Modulus",
            learn: {
                title: "Operators: /, // and %",
                body: `
                    <p>In the Operator Lab, master division operators:</p>
                    <pre>/   Floating Division: 17 / 5  -> 3.4
//  Integer Floor Div: 17 // 5 -> 3
%   Modulus (Remainder): 17 % 5  -> 2
**  Exponentiation:    2 ** 3  -> 8</pre>
                `
            },
            play: { title: "Calculator Reactor", desc: "Predict operator outputs!" },
            code: {
                title: "Reactor Stabilization Code",
                desc: `Write code to compute <code>17 + 5</code>, <code>17 % 5</code>, and <code>17 // 5</code> and print each result on a new line.`,
                initialCode: `a = 17\nb = 5\n# Print sum, modulus, and floor division\n`,
                expectedOutput: "22\n2\n3"
            },
            boss: {
                title: "Operator Lab Boss: Compound Assignment",
                desc: `Initialize <code>num = 10</code>. Add 5 using <code>+=</code>, then compute <code>num % 4</code> and print the result.`,
                initialCode: `num = 10\nnum += 5\nprint(num % 4)`,
                expectedOutput: "3"
            }
        },
        3: {
            id: 3,
            title: "LEVEL 3 — STRING & LIST CITY",
            subtitle: "Indexing, Slicing & List Methods",
            learn: {
                title: "Indexing, Slicing & Methods",
                body: `
                    <p>Lists use zero-based positive indexing and negative indexing from the end:</p>
                    <pre>List:   [ 10,   20,   30,   40,   50 ]
Index:   [0]   [1]   [2]   [3]   [4]
Neg:    [-5]  [-4]  [-3]  [-2]  [-1]</pre>
                `
            },
            play: { title: "Index Train Controller", desc: "Pick passenger by index!" },
            code: {
                title: "List City Repair",
                desc: `Given <code>L = [10, 20, 30, 40, 50]</code>, print the slice <code>L[1:4]</code>, then append <code>60</code> and print the updated list.`,
                initialCode: `L = [10, 20, 30, 40, 50]\nprint(L[1:4])\nL.append(60)\nprint(L)`,
                expectedOutput: "[20, 30, 40]\n[10, 20, 30, 40, 50, 60]"
            },
            boss: {
                title: "List City Boss: Method Battle",
                desc: `Given <code>L = [10, 20]</code>, use <code>L.extend([30, 40])</code> and <code>L.insert(1, 15)</code>. Print the final list.`,
                initialCode: `L = [10, 20]\nL.extend([30, 40])\nL.insert(1, 15)\nprint(L)`,
                expectedOutput: "[10, 15, 20, 30, 40]"
            }
        },
        4: {
            id: 4,
            title: "LEVEL 4 — LOOP FOREST",
            subtitle: "For Loops, range() & Patterns",
            learn: {
                title: "For Loops & range()",
                body: `<p>Use <code>for i in range(1, 6):</code> to iterate from 1 to 5.</p>`
            },
            play: { title: "Range Machine Visualizer", desc: "Configure range parameters!" },
            code: {
                title: "Forest Gate Loop",
                desc: `Write a <code>for</code> loop using <code>range(1, 6)</code> to print numbers 1 to 5.`,
                initialCode: `for i in range(1, 6):\n    print(i)`,
                expectedOutput: "1\n2\n3\n4\n5"
            },
            boss: {
                title: "Loop Boss: Pattern Overlord",
                desc: `Write code to produce the pattern:\n1\n1 2\n1 2 3`,
                initialCode: `for i in range(1, 4):\n    for j in range(1, i + 1):\n        print(j, end=" ")\n    print()`,
                expectedOutput: "1 \n1 2 \n1 2 3 "
            }
        },
        5: {
            id: 5,
            title: "LEVEL 5 — DECISION DUNGEON",
            subtitle: "Conditional Logic: if / elif / else",
            learn: { title: "Branching Logic", body: `<p>Use <code>if / elif / else</code> blocks.</p>` },
            play: { title: "The Three Doors Predictor", desc: "Find largest number!" },
            code: {
                title: "Automated Door Selector",
                desc: `Find largest of <code>a=45, b=72, c=31</code> using <code>if/elif/else</code>.`,
                initialCode: `a = 45\nb = 72\nc = 31\nif a > b and a > c:\n    print(a)\nelif b > a and b > c:\n    print(b)\nelse:\n    print(c)`,
                expectedOutput: "72"
            },
            boss: {
                title: "Dungeon Boss: Even / Odd Classifier",
                desc: `Print "EVEN" or "ODD" for <code>num = 15</code>.`,
                initialCode: `num = 15\nif num % 2 == 0:\n    print("EVEN")\nelse:\n    print("ODD")`,
                expectedOutput: "ODD"
            }
        },
        6: {
            id: 6,
            title: "LEVEL 6 — DICTIONARY VAULT",
            subtitle: "Keys, Values & CRUD",
            learn: { title: "Dictionary Heist", body: `<p>Access values with <code>dict[key]</code>.</p>` },
            play: { title: "Vault Heist Simulator", desc: "Execute dict commands!" },
            code: {
                title: "Vault Hacker Terminal",
                desc: `Add key <code>"city": "Chennai"</code> to <code>student = {"name": "Anu", "mark": 95}</code>.`,
                initialCode: `student = {"name": "Anu", "mark": 95}\nstudent["city"] = "Chennai"\nprint(student)`,
                expectedOutput: "{'name': 'Anu', 'mark': 95, 'city': 'Chennai'}"
            },
            boss: {
                title: "Vault Boss: Dictionary Total",
                desc: `Compute total of <code>marks = {"Math": 90, "CS": 95, "Physics": 85}</code>.`,
                initialCode: `marks = {"Math": 90, "CS": 95, "Physics": 85}\nprint(sum(marks.values()))`,
                expectedOutput: "270"
            }
        },
        7: {
            id: 7,
            title: "LEVEL 7 — HACKER'S CHALLENGE",
            subtitle: "Combined Multi-Concept Programs",
            learn: { title: "Combined Programs", body: `<p>Loops + Lists + Conditions.</p>` },
            play: { title: "Algorithm Analyzer", desc: "Trace multi-step programs." },
            code: {
                title: "Vowel Hunter Mission",
                desc: `Count vowels in <code>s = "PROGRAMMING"</code>.`,
                initialCode: `s = "PROGRAMMING"\ncount = 0\nfor ch in s:\n    if ch.lower() in "aeiou":\n        count += 1\nprint(count)`,
                expectedOutput: "3"
            },
            boss: {
                title: "Hacker Boss: Manual Max Finder",
                desc: `Find maximum value in <code>L = [45, 12, 89, 34]</code> without <code>max()</code>.`,
                initialCode: `L = [45, 12, 89, 34]\nlargest = L[0]\nfor num in L:\n    if num > largest:\n        largest = num\nprint(largest)`,
                expectedOutput: "89"
            }
        },
        8: {
            id: 8,
            title: "LEVEL 8 — TERM-I EXAM ARENA",
            subtitle: "Full Question Paper Simulation",
            learn: { title: "Exam Arena Rules", body: `<p>30 Questions | 5 Rooms</p>` }
        }
    };

    // ----------------------------------------------------------------------
    // 4. PYODIDE ENGINE INITIALIZATION
    // ----------------------------------------------------------------------
    async function initPyodideEngine() {
        const statusEl = document.getElementById('py-engine-status');
        if (window.loadPyodide) {
            try {
                statusEl.textContent = "⏳ Loading Pyodide Engine...";
                state.pyodideLoading = true;
                state.pyodide = await window.loadPyodide();
                state.pyodideLoading = false;
                statusEl.textContent = "⚡ Pyodide 3.11 Ready";
                statusEl.className = "engine-ready";
            } catch (err) {
                statusEl.textContent = "⚡ JS Interpreter Active";
                statusEl.className = "engine-ready";
            }
        }
    }
    initPyodideEngine();

    function runJsPythonFallback(code) {
        let outputLines = [];
        let customConsole = { log: (...args) => outputLines.push(args.join(' ')) };
        try {
            let jsCode = code
                .replace(/print\((.*?)\)/g, (match, p1) => `console.log(${p1});`)
                .replace(/#/g, '//')
                .replace(/len\((.*?)\)/g, '$1.length')
                .replace(/and/g, '&&')
                .replace(/or/g, '||')
                .replace(/not/g, '!');
            let evalFn = new Function('console', jsCode);
            evalFn(customConsole);
            return { success: true, output: outputLines.join('\n') };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async function executePythonCode(code) {
        const consoleEl = document.getElementById('terminal-console');
        const errorBtn = document.getElementById('btn-why-error');
        consoleEl.className = "console-box";
        consoleEl.textContent = "Executing code...";
        errorBtn.classList.add('hidden');

        if (state.pyodide) {
            try {
                state.pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);
                state.pyodide.runPython(code);
                let stdout = state.pyodide.runPython("sys.stdout.getvalue()");
                let stderr = state.pyodide.runPython("sys.stderr.getvalue()");

                if (stderr && stderr.trim()) {
                    consoleEl.className = "console-box error";
                    consoleEl.textContent = stderr.trim();
                    state.lastErrorMsg = stderr.trim();
                    errorBtn.classList.remove('hidden');
                    deductLife(`Syntax/Runtime Error: ${stderr.trim()}`);
                    AudioEngine.error();
                    return { success: false, output: stderr.trim() };
                } else {
                    consoleEl.className = "console-box success";
                    consoleEl.textContent = stdout.trim() || "[Code executed with no output]";
                    AudioEngine.success();
                    return { success: true, output: stdout.trim() };
                }
            } catch (err) {
                consoleEl.className = "console-box error";
                consoleEl.textContent = err.message;
                state.lastErrorMsg = err.message;
                errorBtn.classList.remove('hidden');
                deductLife(`Error: ${err.message}`);
                AudioEngine.error();
                return { success: false, output: err.message };
            }
        } else {
            let res = runJsPythonFallback(code);
            if (res.success) {
                consoleEl.className = "console-box success";
                consoleEl.textContent = res.output;
                AudioEngine.success();
                return { success: true, output: res.output };
            } else {
                consoleEl.className = "console-box error";
                consoleEl.textContent = res.error;
                state.lastErrorMsg = res.error;
                errorBtn.classList.remove('hidden');
                deductLife(`JS Fallback Error: ${res.error}`);
                AudioEngine.error();
                return { success: false, output: res.error };
            }
        }
    }

    // ----------------------------------------------------------------------
    // 5. STUDENT DATA & MISTAKE LOGGING
    // ----------------------------------------------------------------------
    function deductLife(reason) {
        state.lives = Math.max(0, state.lives - 1);
        document.getElementById('lives-count').textContent = state.lives;

        // Log mistake
        if (state.studentName) {
            let logEntry = `Level ${state.currentLevel}: ${reason}`;
            state.mistakeLogs.push(logEntry);
            localStorage.setItem('pq_mistakes', JSON.stringify(state.mistakeLogs));
            syncStudentData();
        }

        if (state.lives <= 0) {
            alert(`💔 You ran out of lives in Level ${state.currentLevel}! Level restarting with 30 fresh lives!`);
            state.lives = 30;
            document.getElementById('lives-count').textContent = state.lives;
        }
    }

    function syncStudentData() {
        if (!state.studentName) return;
        localStorage.setItem('pq_student_name', state.studentName);
        localStorage.setItem('pq_xp', state.xp);
        localStorage.setItem('pq_unlocked', state.unlockedLevel);

        // Save student profile to localStorage database table
        let allStudents = JSON.parse(localStorage.getItem('pq_all_students')) || {};
        allStudents[state.studentName] = {
            name: state.studentName,
            xp: state.xp,
            level: state.unlockedLevel,
            lives: state.lives,
            mistakes: state.mistakeLogs,
            lastActive: new Date().toLocaleTimeString()
        };
        localStorage.setItem('pq_all_students', JSON.stringify(allStudents));
    }

    // ----------------------------------------------------------------------
    // 6. UI RENDERERS & EVENT HANDLERS
    // ----------------------------------------------------------------------
    function updateUIState() {
        if (!state.studentName) {
            document.getElementById('modal-student-login').classList.add('active');
        } else {
            document.getElementById('modal-student-login').classList.remove('active');
            document.getElementById('student-name-tag').textContent = state.studentName;
            document.getElementById('hero-student-name').textContent = state.studentName;
        }

        document.getElementById('current-xp').textContent = state.xp;
        document.getElementById('lives-count').textContent = state.lives;

        let currentRank = RANKS[0];
        for (let r of RANKS) {
            if (state.xp >= r.minXP) currentRank = r;
        }
        document.getElementById('rank-icon').textContent = currentRank.icon;
        document.getElementById('rank-name').textContent = currentRank.name;
        document.getElementById('target-xp').textContent = currentRank.target;

        let pct = Math.min(100, Math.floor((state.xp / currentRank.target) * 100));
        document.getElementById('xp-bar-fill').style.width = pct + '%';

        document.getElementById('current-level-tag').textContent = `L${state.currentLevel}: Zone ${state.currentLevel}`;
        document.getElementById('overall-progress-text').textContent = `${state.unlockedLevel - 1} / 8 Zones Cleared`;

        // Render Map Sidebar List
        const listEl = document.getElementById('level-map-list');
        listEl.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            let lData = LEVELS_DATA[i];
            let item = document.createElement('div');
            let isLocked = i > state.unlockedLevel;
            let isCurrent = i === state.currentLevel;
            let isCompleted = i < state.unlockedLevel;

            item.className = `level-node-item ${isCurrent ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="node-badge">${isCompleted ? '✓' : (isLocked ? '🔒' : i)}</div>
                <div class="node-info">
                    <span class="node-title">Zone ${i}</span>
                    <span class="node-desc">${lData.subtitle}</span>
                </div>
            `;
            if (!isLocked) {
                item.addEventListener('click', () => {
                    AudioEngine.click();
                    loadZoneLevel(i);
                });
            }
            listEl.appendChild(item);
        }

        // Render Roadmap Grid in Map Overview
        const gridEl = document.getElementById('roadmap-grid');
        if (gridEl && gridEl.children.length === 0) {
            for (let i = 1; i <= 8; i++) {
                let lData = LEVELS_DATA[i];
                let card = document.createElement('div');
                card.className = "roadmap-card";
                card.innerHTML = `
                    <span class="level-tag">LEVEL ${i}</span>
                    <h4>${lData.title.split('—')[1] || lData.title}</h4>
                    <p>${lData.subtitle}</p>
                `;
                gridEl.appendChild(card);
            }
        }

        syncStudentData();
    }

    function switchViewPanel(panelId) {
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(panelId).classList.add('active');
    }

    function loadZoneLevel(levelId) {
        state.currentLevel = levelId;
        state.currentStage = 'learn';
        state.lives = 30; // Reset to 30 lives per level!
        updateUIState();

        if (levelId === 8) {
            switchViewPanel('exam-arena-view');
            initExamArena();
            return;
        }

        switchViewPanel('zone-gameplay-view');
        let lData = LEVELS_DATA[levelId];
        document.getElementById('zone-title').textContent = lData.title;
        document.getElementById('zone-subtitle').textContent = lData.subtitle;

        document.getElementById('learn-card-title').textContent = lData.learn.title;
        document.getElementById('learn-card-body').innerHTML = lData.learn.body;

        renderMiniGame(levelId);

        let stageData = (state.currentStage === 'boss') ? lData.boss : lData.code;
        document.getElementById('code-mission-title').textContent = stageData.title;
        document.getElementById('code-mission-desc').innerHTML = `<p>${stageData.desc}</p>`;
        document.getElementById('code-editor-input').value = stageData.initialCode;
        updateLineNumbers();

        setMissionStage('learn');
    }

    function setMissionStage(stage) {
        state.currentStage = stage;
        document.querySelectorAll('.step-node').forEach(n => n.classList.remove('active'));
        document.getElementById(`step-${stage}`).classList.add('active');

        document.querySelectorAll('.stage-container').forEach(c => c.classList.remove('active'));
        document.getElementById(`stage-${stage}`).classList.add('active');

        if (stage === 'code' || stage === 'boss') {
            let lData = LEVELS_DATA[state.currentLevel];
            let targetData = (stage === 'boss') ? lData.boss : lData.code;
            document.getElementById('code-mission-title').textContent = targetData.title;
            document.getElementById('code-mission-desc').innerHTML = `<p>${targetData.desc}</p>`;
            document.getElementById('code-editor-input').value = targetData.initialCode;
            updateLineNumbers();
        }
    }

    // Line numbers sync
    const codeEditor = document.getElementById('code-editor-input');
    const lineNumbers = document.getElementById('line-numbers');

    function updateLineNumbers() {
        const lines = codeEditor.value.split('\n').length;
        lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    }

    codeEditor.addEventListener('input', updateLineNumbers);
    codeEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeEditor.selectionStart;
            const end = codeEditor.selectionEnd;
            codeEditor.value = codeEditor.value.substring(0, start) + "    " + codeEditor.value.substring(end);
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
            updateLineNumbers();
        }
    });

    function addXP(amount, msg) {
        state.xp += amount;
        AudioEngine.levelUp();
        updateUIState();
    }

    // ----------------------------------------------------------------------
    // 7. STUDENT LOGIN & NAME SELECTION LOGIC
    // ----------------------------------------------------------------------
    const dropdown = document.getElementById('student-name-dropdown');
    const customInput = document.getElementById('custom-name-input');
    const confirmBtn = document.getElementById('btn-confirm-student-login');

    dropdown.addEventListener('change', (e) => {
        if (e.target.value === '__custom__') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
        }
    });

    confirmBtn.addEventListener('click', () => {
        let chosenName = dropdown.value;
        if (chosenName === '__custom__') {
            chosenName = customInput.value.trim();
        }
        if (!chosenName) {
            alert("Please enter or select a valid student name!");
            return;
        }

        state.studentName = chosenName;
        updateUIState();
        AudioEngine.success();
    });

    document.getElementById('btn-change-student-name').addEventListener('click', () => {
        document.getElementById('modal-student-login').classList.add('active');
    });

    // ----------------------------------------------------------------------
    // 8. MINI-GAMES ENGINE
    // ----------------------------------------------------------------------
    function renderMiniGame(levelId) {
        const viewport = document.getElementById('mini-game-viewport');
        const nextBtn = document.getElementById('btn-next-to-code');
        nextBtn.disabled = true;

        if (levelId === 1) {
            document.getElementById('mini-game-title').textContent = "Identifier Scanner & Safe";
            document.getElementById('mini-game-desc').textContent = "Drag the VALID Python identifier into the Code Safe!";

            viewport.innerHTML = `
                <div class="drag-game-container">
                    <div class="safe-box" id="safe-dropzone">
                        <span style="font-size: 2rem;">🔒</span>
                        <span>DROP VALID IDENTIFIER HERE</span>
                    </div>
                    <div class="draggable-items">
                        <div class="drag-item" draggable="true" data-valid="false">2number</div>
                        <div class="drag-item" draggable="true" data-valid="true">student_name</div>
                        <div class="drag-item" draggable="true" data-valid="false">class</div>
                        <div class="drag-item" draggable="true" data-valid="false">student-name</div>
                    </div>
                </div>
            `;

            const dropzone = document.getElementById('safe-dropzone');
            document.querySelectorAll('.drag-item').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', item.dataset.valid);
                    e.dataTransfer.setData('item-text', item.textContent);
                });
            });

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('drag-over');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                const isValid = e.dataTransfer.getData('text/plain') === 'true';
                const text = e.dataTransfer.getData('item-text');

                if (isValid) {
                    dropzone.innerHTML = `<span style="font-size: 2.5rem; color: var(--neon-green);">🔓</span><span style="color: var(--neon-green); font-weight:700;">VALID: ${text}!</span>`;
                    AudioEngine.success();
                    nextBtn.disabled = false;
                    addXP(10, "Cleared Mini-Game");
                } else {
                    dropzone.innerHTML = `<span style="font-size: 2.5rem; color: var(--neon-red);">❌</span><span style="color: var(--neon-red); font-weight:700;">INVALID IDENTIFIER! RETRY</span>`;
                    deductLife(`Selected invalid identifier '${text}'`);
                    AudioEngine.error();
                    setTimeout(() => renderMiniGame(1), 1500);
                }
            });
        } else if (levelId === 2) {
            document.getElementById('mini-game-title').textContent = "Calculator Reactor";
            document.getElementById('mini-game-desc').textContent = "Predict the value of 17 % 5 to stabilize the reactor!";

            viewport.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <div style="font-size: 3rem; animation: floatPulse 1s infinite alternate;">⚡</div>
                    <h3>What is 17 % 5 in Python?</h3>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn-cyber opt-btn" data-ans="3.4">3.4</button>
                        <button class="btn-cyber opt-btn" data-ans="3">3</button>
                        <button class="btn-cyber opt-btn" data-ans="2">2</button>
                    </div>
                </div>
            `;

            viewport.querySelectorAll('.opt-btn').forEach(b => {
                b.addEventListener('click', (e) => {
                    if (e.target.dataset.ans === "2") {
                        AudioEngine.success();
                        e.target.style.background = "var(--neon-green)";
                        e.target.style.color = "#000";
                        nextBtn.disabled = false;
                        addXP(10, "Reactor Stabilized!");
                    } else {
                        deductLife(`Selected ${e.target.dataset.ans} for 17%5`);
                        AudioEngine.error();
                        e.target.style.background = "var(--neon-red)";
                    }
                });
            });
        } else if (levelId === 3) {
            document.getElementById('mini-game-title').textContent = "Index Train Controller";
            document.getElementById('mini-game-desc').textContent = "Pick passenger at index L[-1] for L = [10, 20, 30, 40, 50]";

            viewport.innerHTML = `
                <div class="train-container">
                    <div class="train-car"><span class="train-val">10</span><span class="train-idx">[0]</span></div>
                    <div class="train-car"><span class="train-val">20</span><span class="train-idx">[1]</span></div>
                    <div class="train-car"><span class="train-val">30</span><span class="train-idx">[2]</span></div>
                    <div class="train-car"><span class="train-val">40</span><span class="train-idx">[3]</span></div>
                    <div class="train-car"><span class="train-val">50</span><span class="train-idx">[4]</span></div>
                </div>
                <p>Which value is returned by <code>L[-1]</code>?</p>
                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button class="btn-cyber opt-btn" data-ans="10">10</button>
                    <button class="btn-cyber opt-btn" data-ans="50">50</button>
                    <button class="btn-cyber opt-btn" data-ans="40">40</button>
                </div>
            `;

            viewport.querySelectorAll('.opt-btn').forEach(b => {
                b.addEventListener('click', (e) => {
                    if (e.target.dataset.ans === "50") {
                        AudioEngine.success();
                        e.target.style.background = "var(--neon-green)";
                        e.target.style.color = "#000";
                        nextBtn.disabled = false;
                        addXP(10, "Train Slicing Cleared!");
                    } else {
                        deductLife(`Selected L[${e.target.dataset.ans}] instead of L[-1]`);
                        AudioEngine.error();
                        e.target.style.background = "var(--neon-red)";
                    }
                });
            });
        } else {
            viewport.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 14px;">
                    <span style="font-size: 3rem;">🎮</span>
                    <h3>Zone ${levelId} Concept Check</h3>
                    <p>Click "VERIFY" to validate your readiness for coding!</p>
                    <button id="btn-generic-verify" class="btn-cyber primary">VERIFY READINESS</button>
                </div>
            `;
            document.getElementById('btn-generic-verify').addEventListener('click', () => {
                AudioEngine.success();
                nextBtn.disabled = false;
                addXP(10, "Readiness Verified!");
            });
        }
    }

    // ----------------------------------------------------------------------
    // 9. STUDENT LEADERBOARD & TEACHER DASHBOARD
    // ----------------------------------------------------------------------
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        AudioEngine.click();
        renderLeaderboard();
        document.getElementById('modal-leaderboard').classList.add('active');
    });

    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
        document.getElementById('modal-leaderboard').classList.remove('active');
    });
    document.getElementById('btn-close-leaderboard-ok').addEventListener('click', () => {
        document.getElementById('modal-leaderboard').classList.remove('active');
    });

    function getCombinedRoster() {
        let storedStudents = JSON.parse(localStorage.getItem('pq_all_students')) || {};
        let list = [...DEFAULT_CLASSMATES];

        Object.values(storedStudents).forEach(st => {
            let existingIdx = list.findIndex(c => c.name.toLowerCase() === st.name.toLowerCase());
            if (existingIdx !== -1) {
                list[existingIdx] = st;
            } else {
                list.push(st);
            }
        });

        // Ensure current user is in list
        if (state.studentName) {
            let curIdx = list.findIndex(c => c.name.toLowerCase() === state.studentName.toLowerCase());
            let curObj = {
                name: state.studentName,
                xp: state.xp,
                level: state.unlockedLevel,
                lives: state.lives,
                mistakes: state.mistakeLogs
            };
            if (curIdx !== -1) list[curIdx] = curObj;
            else list.push(curObj);
        }

        list.sort((a, b) => b.xp - a.xp);
        return list;
    }

    function renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-tbody');
        let roster = getCombinedRoster();

        tbody.innerHTML = roster.map((s, idx) => {
            let isCurrent = (s.name.toLowerCase() === state.studentName.toLowerCase());
            let rankBadge = (idx === 0) ? '👑' : (idx === 1 ? '🥇' : (idx === 2 ? '🥈' : (idx === 3 ? '🥉' : `#${idx + 1}`)));
            return `
                <tr style="${isCurrent ? 'background:rgba(0,242,254,0.15); font-weight:700; color:var(--neon-cyan);' : ''}">
                    <td>${rankBadge}</td>
                    <td>${s.name} ${isCurrent ? '(YOU)' : ''}</td>
                    <td><strong style="color:var(--neon-yellow);">${s.xp} XP</strong></td>
                    <td>Zone ${s.level}</td>
                    <td>${s.xp >= 1200 ? '👑 Code Master' : (s.xp >= 800 ? '🥇 Hacker' : '🥉 Explorer')}</td>
                    <td><span style="color:var(--neon-green);">Active</span></td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('btn-teacher-dash').addEventListener('click', () => {
        AudioEngine.click();
        renderTeacherDashboard();
        document.getElementById('modal-teacher-dash').classList.add('active');
    });

    document.getElementById('btn-close-teacher').addEventListener('click', () => {
        document.getElementById('modal-teacher-dash').classList.remove('active');
    });

    function renderTeacherDashboard() {
        const tbody = document.getElementById('teacher-roster-tbody');
        let roster = getCombinedRoster();

        tbody.innerHTML = roster.map(s => {
            let mCount = (s.mistakes && s.mistakes.length) || 0;
            return `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.xp} XP</td>
                    <td>Zone ${s.level}</td>
                    <td>❤️ ${s.lives || 30}</td>
                    <td><span style="${mCount > 0 ? 'color:var(--neon-pink);' : 'color:var(--neon-green);'}">${mCount} error(s)</span></td>
                    <td><button class="btn-cyber outline small btn-view-log" data-name="${s.name}">View Log</button></td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-view-log').forEach(btn => {
            btn.addEventListener('click', (e) => {
                let sName = e.target.dataset.name;
                inspectStudentMistakes(sName);
            });
        });

        const bars = document.getElementById('concept-mastery-bars');
        bars.innerHTML = `
            <div class="mastery-row"><div class="mastery-meta"><span>Identifiers</span><span>92%</span></div><div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:92%;"></div></div></div>
            <div class="mastery-row"><div class="mastery-meta"><span>Operators</span><span>86%</span></div><div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:86%;"></div></div></div>
            <div class="mastery-row"><div class="mastery-meta"><span>Strings & Lists</span><span>78%</span></div><div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:78%;"></div></div></div>
            <div class="mastery-row"><div class="mastery-meta"><span>Loops</span><span>64%</span></div><div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:64%;"></div></div></div>
            <div class="mastery-row"><div class="mastery-meta"><span>Dictionaries</span><span>55%</span></div><div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:55%; background:var(--neon-pink);"></div></div></div>
        `;
    }

    function inspectStudentMistakes(studentName) {
        let roster = getCombinedRoster();
        let target = roster.find(s => s.name.toLowerCase() === studentName.toLowerCase());
        const logBox = document.getElementById('student-mistake-log-list');
        document.getElementById('mistake-log-title').textContent = `Mistake & Error History Log: ${studentName}`;

        if (!target || !target.mistakes || target.mistakes.length === 0) {
            logBox.innerHTML = `<span style="color:var(--neon-green);">✓ No errors or mistakes recorded for ${studentName}! Perfect performance!</span>`;
        } else {
            logBox.innerHTML = target.mistakes.map(m => `<div>⚠️ ${m}</div>`).join('');
        }
    }

    // Export CSV Report
    document.getElementById('btn-export-report').addEventListener('click', () => {
        let roster = getCombinedRoster();
        let csvContent = "data:text/csv;charset=utf-8,Student Name,XP,Zone Level,Lives,Mistake Count\n";
        roster.forEach(s => {
            csvContent += `"${s.name}",${s.xp},${s.level},${s.lives || 30},${(s.mistakes && s.mistakes.length) || 0}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Python_Quest_Class_Report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if (confirm("Reset all local game and student roster data?")) {
            localStorage.clear();
            location.reload();
        }
    });

    // ----------------------------------------------------------------------
    // 10. EXAM ARENA ENGINE (LEVEL 8)
    // ----------------------------------------------------------------------
    const EXAM_QUESTIONS = {
        A: [
            { q: "1. Which of the following is a valid Python identifier?", opts: ["2count", "student_name", "class", "student-name"], ans: 1 },
            { q: "2. What is the output of 17 // 5 in Python?", opts: ["3.4", "3", "2", "3.0"], ans: 1 },
            { q: "3. Which data type is immutable?", opts: ["List", "Dictionary", "String", "Set"], ans: 2 },
            { q: "4. What does L.append(20) do?", opts: ["Adds 20 to start", "Adds 20 to end", "Replaces index 20", "Deletes 20"], ans: 1 },
            { q: "5. What is the result of 'PYTHON'[2]?", opts: ["P", "Y", "T", "H"], ans: 2 }
        ],
        B: [
            { q: "6. Predict output of: for i in range(1, 4): print(i, end=' ')", opts: ["1 2 3", "1 2 3 4", "0 1 2 3", "1 4"], ans: 0 },
            { q: "7. Predict output of: len([10, 20, 30])", opts: ["2", "3", "4", "30"], ans: 1 }
        ],
        C: [
            { q: "8. Identify error in: student = {'name':'Arun'}; print(student['mark'])", opts: ["SyntaxError", "KeyError", "IndexError", "TypeError"], ans: 1 }
        ],
        D: [
            { q: "9. Command to remove key 'age' from dict 'd':", opts: ["d.remove('age')", "del d['age']", "d.pop()", "delete d['age']"], ans: 1 }
        ],
        E: [
            { q: "10. Write code to compute total of marks = {'Math': 90, 'CS': 95}", codeRequired: true, expectedOutput: "185" }
        ]
    };

    let activeExamRoom = 'A';

    function initExamArena() {
        state.examScore = 0;
        state.examLives = 30;
        document.getElementById('exam-lives-display').textContent = state.examLives;
        document.getElementById('exam-score-display').textContent = state.examScore;

        renderExamRoom('A');

        document.querySelectorAll('.room-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                AudioEngine.click();
                document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeExamRoom = tab.dataset.room;
                renderExamRoom(activeExamRoom);
            });
        });
    }

    function renderExamRoom(roomKey) {
        const container = document.getElementById('exam-room-container');
        const qList = EXAM_QUESTIONS[roomKey] || [];

        container.innerHTML = `<h3>ROOM ${roomKey} QUESTIONS</h3>`;

        qList.forEach((qObj, idx) => {
            let card = document.createElement('div');
            card.className = "exam-question-card";

            if (qObj.codeRequired) {
                card.innerHTML = `
                    <p><strong>${qObj.q}</strong></p>
                    <textarea class="exam-code-input" style="width: 100%; height: 80px; background:#090d16; color:var(--neon-green); font-family:var(--font-code); padding:10px;" placeholder="Type Python code here..."></textarea>
                    <button class="btn-cyber primary small btn-run-exam-code">Run & Submit Code</button>
                `;
                card.querySelector('.btn-run-exam-code').addEventListener('click', async () => {
                    let userCode = card.querySelector('.exam-code-input').value;
                    let res = await executePythonCode(userCode);
                    if (res.success && res.output.trim() === qObj.expectedOutput) {
                        AudioEngine.success();
                        state.examScore += 20;
                        document.getElementById('exam-score-display').textContent = state.examScore;
                        alert("Correct Boss Code! +20 Marks");
                    } else {
                        deductLife("Failed Exam Arena Code Question");
                        AudioEngine.error();
                        alert("Incorrect output. Expected: " + qObj.expectedOutput);
                    }
                });
            } else {
                card.innerHTML = `
                    <p><strong>${qObj.q}</strong></p>
                    <div class="mcq-options">
                        ${qObj.opts.map((opt, oIdx) => `<div class="mcq-opt" data-qidx="${idx}" data-oidx="${oIdx}">${opt}</div>`).join('')}
                    </div>
                `;

                card.querySelectorAll('.mcq-opt').forEach(optEl => {
                    optEl.addEventListener('click', (e) => {
                        card.querySelectorAll('.mcq-opt').forEach(o => o.classList.remove('selected'));
                        optEl.classList.add('selected');
                        let chosen = parseInt(optEl.dataset.oidx);
                        if (chosen === qObj.ans) {
                            AudioEngine.success();
                            state.examScore += 10;
                            document.getElementById('exam-score-display').textContent = state.examScore;
                        } else {
                            deductLife(`Exam Arena MCQ Wrong Choice: ${optEl.textContent}`);
                            AudioEngine.error();
                        }
                    });
                });
            }

            container.appendChild(card);
        });
    }

    // ----------------------------------------------------------------------
    // 11. DIAGNOSTIC MODAL & CHEAT CARDS
    // ----------------------------------------------------------------------
    document.getElementById('btn-why-error').addEventListener('click', () => {
        AudioEngine.click();
        const modal = document.getElementById('modal-error-diagnostic');
        const body = document.getElementById('diagnostic-modal-body');
        let err = state.lastErrorMsg || "IndexError: list index out of range";

        let html = `<h4>Error Caught: <code>${err}</code></h4>`;
        if (err.includes('IndexError')) {
            html += `
                <p>⚠️ <strong>IndexError Explained:</strong> You tried to access an index that does not exist in the list!</p>
                <div style="background:#090d16; padding:12px; border-radius:8px; font-family:var(--font-code); color:var(--neon-yellow);">
                    List: [10, 20, 30]<br>
                    Valid Positive Indices: 0, 1, 2<br>
                    Your Code Requested Index: 5 (Out of range!)
                </div>
            `;
        } else if (err.includes('KeyError')) {
            html += `
                <p>⚠️ <strong>KeyError Explained:</strong> Key does not exist in dictionary!</p>
            `;
        } else {
            html += `<p>⚠️ <strong>Syntax Error Tip:</strong> Check missing colons <code>:</code> or syntax.</p>`;
        }

        body.innerHTML = html;
        modal.classList.add('active');
    });

    document.getElementById('btn-close-diagnostic').addEventListener('click', () => {
        document.getElementById('modal-error-diagnostic').classList.remove('active');
    });
    document.getElementById('btn-got-it-diagnostic').addEventListener('click', () => {
        document.getElementById('modal-error-diagnostic').classList.remove('active');
    });

    // Cheat Cards
    document.getElementById('btn-cheat-cards').addEventListener('click', () => {
        AudioEngine.click();
        document.getElementById('modal-cheat-cards').classList.add('active');
        renderCheatContent('basics');
    });
    document.getElementById('btn-close-cheat').addEventListener('click', () => {
        document.getElementById('modal-cheat-cards').classList.remove('active');
    });
    document.querySelectorAll('.cheat-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cheat-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCheatContent(btn.dataset.cheat);
        });
    });

    function renderCheatContent(topic) {
        const body = document.getElementById('cheat-card-body');
        if (topic === 'basics') {
            body.innerHTML = `<h4>Identifiers Quick Cheat:</h4><p>✓ Starts with letter or <code>_</code></p><p>❌ No digits at start, no hyphens, no spaces, no keywords.</p>`;
        } else if (topic === 'operators') {
            body.innerHTML = `<h4>Operators:</h4><pre>17 / 5  -> 3.4\n17 // 5 -> 3\n17 % 5  -> 2</pre>`;
        } else if (topic === 'strings') {
            body.innerHTML = `<h4>Lists & Slicing:</h4><pre>L = [10, 20, 30]\nL[0]    -> 10\nL[-1]   -> 30\nL.append(40)</pre>`;
        } else {
            body.innerHTML = `<p>Refer to concept cards inside each level!</p>`;
        }
    }

    // ----------------------------------------------------------------------
    // 12. PROCTORING ANTI-CHEAT
    // ----------------------------------------------------------------------
    const proctorBtn = document.getElementById('btn-proctor-toggle');
    proctorBtn.addEventListener('click', () => {
        AudioEngine.click();
        state.proctorMode = !state.proctorMode;
        document.getElementById('proctor-status-text').textContent = state.proctorMode ? "ON" : "OFF";
        proctorBtn.classList.toggle('outline', !state.proctorMode);
        proctorBtn.classList.toggle('danger', state.proctorMode);

        if (state.proctorMode && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => {});
        }
    });

    window.addEventListener('visibilitychange', () => {
        if (state.proctorMode && document.hidden) {
            state.tabSwitches++;
            state.xp = Math.max(0, state.xp - 20);
            updateUIState();
            document.getElementById('proctor-switch-count').textContent = state.tabSwitches;
            document.getElementById('modal-proctor-warning').classList.add('active');
            AudioEngine.error();
        }
    });

    document.getElementById('btn-proctor-ack').addEventListener('click', () => {
        document.getElementById('modal-proctor-warning').classList.remove('active');
    });

    // Navigation buttons
    document.getElementById('btn-start-quest').addEventListener('click', () => {
        AudioEngine.click();
        loadZoneLevel(state.currentLevel);
    });

    document.getElementById('btn-back-to-map').addEventListener('click', () => {
        AudioEngine.click();
        switchViewPanel('map-overview-view');
    });

    document.getElementById('btn-next-to-play').addEventListener('click', () => {
        AudioEngine.click();
        addXP(5, "Learned Concept");
        setMissionStage('play');
    });

    document.getElementById('btn-next-to-code').addEventListener('click', () => {
        AudioEngine.click();
        setMissionStage('code');
    });

    document.getElementById('btn-run-code').addEventListener('click', async () => {
        AudioEngine.click();
        const code = codeEditor.value;
        let lData = LEVELS_DATA[state.currentLevel];
        let targetData = (state.currentStage === 'boss') ? lData.boss : lData.code;

        let result = await executePythonCode(code);

        if (result.success && result.output.trim() === targetData.expectedOutput.trim()) {
            if (state.currentStage === 'code') {
                addXP(30, "Coding Mission Complete!");
                alert("🎉 MISSION CLEAR! Proceeding to BOSS Challenge!");
                setMissionStage('boss');
            } else if (state.currentStage === 'boss') {
                addXP(100, "Zone Boss Defeated!");
                alert(`👑 ZONE ${state.currentLevel} CLEARED! +100 XP!`);
                if (state.unlockedLevel === state.currentLevel) {
                    state.unlockedLevel = Math.min(8, state.unlockedLevel + 1);
                }
                updateUIState();
                switchViewPanel('map-overview-view');
            }
        }
    });

    document.getElementById('btn-reset-code').addEventListener('click', () => {
        let lData = LEVELS_DATA[state.currentLevel];
        let targetData = (state.currentStage === 'boss') ? lData.boss : lData.code;
        codeEditor.value = targetData.initialCode;
        updateLineNumbers();
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        document.getElementById('sound-icon').textContent = state.soundEnabled ? "🔊" : "🔇";
    });

    // Initial render
    updateUIState();
});
