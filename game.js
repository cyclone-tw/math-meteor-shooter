/**
 * Math Meteor Shooter - 數學隕石射擊遊戲
 * A multiplication table practice game with shooting mechanics
 */

// ==========================================
// Game Configuration
// ==========================================
const CONFIG = {
    difficulties: {
        easy: {
            name: '初級',
            lives: 5,
            startStage: -2, // Negative value = even slower than stage 1
            showHint: true,
            hintThreshold: 0.5 // Show hint when meteor is 50% down
        },
        medium: {
            name: '中級',
            lives: 3,
            startStage: 1, // Was 3, now starts at original stage 1 speed
            showHint: false,
            hintThreshold: 0
        },
        hard: {
            name: '高級',
            lives: 2,
            startStage: 4, // Was 6, slightly adjusted
            showHint: false,
            hintThreshold: 0
        }
    },
    // Stage settings - speed increases per stage
    // Base fall duration in ms (higher = slower)
    baseFallDuration: 7000, // Increased from 5000 for slower initial speed
    minFallDuration: 2000,
    fallDurationDecrement: 150, // Decrease per stage

    // Number ranges per stage group
    numberRanges: [
        { maxStage: 3, min: 1, max: 5 },
        { maxStage: 7, min: 1, max: 7 },
        { maxStage: 12, min: 1, max: 9 },
        { maxStage: 20, min: 1, max: 12 }
    ],

    // Gameplay settings
    totalStages: 20,
    bulletSpeed: 15, // pixels per frame
    bulletInterval: 150, // ms between shots
    meteorSpawnInterval: 1500, // ms between meteor spawns
    meteorWidth: 70,
    meteorMinSpacing: 120, // Minimum horizontal distance between meteors (increased)
    planeSpeed: 12, // pixels per frame (balanced for control)
    touchSpeedMultiplier: 0.6, // Touch controls are slower for better precision
    wrongAnswerCount: 4, // Number of wrong answer meteors (total 5 with correct)
    maxMeteorsOnScreen: 5, // Maximum meteors visible at once
    meteorSpawnDelay: 500, // ms delay between each meteor spawn (increased)
    nextQuestionDelay: 1500, // ms delay before spawning next question meteors

    // Game area
    gameAreaPadding: 50,
    planeBottomMargin: 30, // Min distance from bottom
    planeTopMargin: 200 // Max distance from bottom (can't go too high)
};

// ==========================================
// Audio System
// ==========================================
const AudioSystem = {
    context: null,
    isMuted: false,
    bgmGain: null,
    bgmOscillators: [],

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    },

    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    },

    // Shooting sound - short laser beep
    playShoot() {
        if (this.isMuted || !this.context) return;
        this.resume();

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, this.context.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + 0.1);
    },

    // Hit meteor sound - explosion
    playHit() {
        if (this.isMuted || !this.context) return;
        this.resume();

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.2);

        gain.gain.setValueAtTime(0.15, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);

        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + 0.2);
    },

    // Correct answer - happy ascending arpeggio
    playCorrect() {
        if (this.isMuted || !this.context) return;
        this.resume();

        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.connect(gain);
            gain.connect(this.context.destination);

            osc.type = 'sine';
            osc.frequency.value = freq;

            const startTime = this.context.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

            osc.start(startTime);
            osc.stop(startTime + 0.15);
        });
    },

    // Wrong answer - descending buzz
    playWrong() {
        if (this.isMuted || !this.context) return;
        this.resume();

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.context.currentTime + 0.3);

        gain.gain.setValueAtTime(0.15, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + 0.3);
    },

    // Background music - simple looping melody
    startBGM() {
        if (this.isMuted || !this.context) return;
        this.resume();
        this.stopBGM();

        this.bgmGain = this.context.createGain();
        this.bgmGain.gain.value = 0.05; // Very quiet background
        this.bgmGain.connect(this.context.destination);

        // Simple bass line pattern
        const bassNotes = [65.41, 82.41, 73.42, 87.31]; // C2, E2, D2, F2
        const playBassNote = (noteIndex) => {
            if (this.isMuted || !this.bgmGain) return;

            const osc = this.context.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = bassNotes[noteIndex % bassNotes.length];
            osc.connect(this.bgmGain);

            osc.start(this.context.currentTime);
            osc.stop(this.context.currentTime + 0.4);

            this.bgmOscillators.push(osc);

            // Clean up and schedule next note
            setTimeout(() => {
                const idx = this.bgmOscillators.indexOf(osc);
                if (idx > -1) this.bgmOscillators.splice(idx, 1);
            }, 450);
        };

        let noteIndex = 0;
        const playLoop = () => {
            if (this.isMuted || !gameState.isPlaying) {
                this.stopBGM();
                return;
            }
            playBassNote(noteIndex);
            noteIndex++;
            this.bgmTimeout = setTimeout(playLoop, 500);
        };

        playLoop();
    },

    stopBGM() {
        if (this.bgmTimeout) {
            clearTimeout(this.bgmTimeout);
            this.bgmTimeout = null;
        }
        this.bgmOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) { }
        });
        this.bgmOscillators = [];
        this.bgmGain = null;
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopBGM();
        } else if (gameState.isPlaying) {
            this.startBGM();
        }
        return this.isMuted;
    }
};

// ==========================================
// Game State
// ==========================================
let gameState = {
    currentScreen: 'start',
    playerName: '',
    difficulty: 'easy',
    meteorsPerStage: 10,
    stage: 1,
    score: 0,
    lives: 5,
    correctAnswers: 0,
    wrongHits: 0,
    totalShots: 0,
    stageProgress: 0,
    currentQuestion: null,
    correctAnswer: null,
    isPlaying: false,
    isPaused: false,
    isVictory: false,

    // Wrong answers tracking
    wrongAnswersList: [], // {question: "2 × 3 = ?", correctAnswer: 6}

    // Game objects
    plane: {
        x: 0,
        y: 0, // Y position from bottom
        width: 60,
        height: 80
    },
    meteors: [],
    bullets: [],

    // Input state
    keys: {
        left: false,
        right: false,
        up: false,
        down: false,
        shoot: false
    },

    // Touch controls
    touch: {
        active: false,
        joystickActive: false,
        joystickStartX: 0,
        joystickStartY: 0,
        joystickCurrentX: 0,
        joystickCurrentY: 0
    },

    // Timers
    lastBulletTime: 0,
    lastMeteorTime: 0,
    gameLoopId: null,

    // Spawn lock to prevent multiple meteor spawning
    isSpawningMeteors: false
};

// ==========================================
// DOM Elements
// ==========================================
const elements = {
    screens: {
        start: document.getElementById('start-screen'),
        game: document.getElementById('game-screen'),
        results: document.getElementById('results-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
    },
    inputs: {
        playerName: document.getElementById('player-name')
    },
    buttons: {
        difficultyBtns: document.querySelectorAll('.difficulty-btn'),
        countBtns: document.querySelectorAll('.count-btn'),
        startBtn: document.getElementById('start-btn'),
        resumeBtn: document.getElementById('resume-btn'),
        quitBtn: document.getElementById('quit-btn'),
        downloadResultBtn: document.getElementById('download-result-btn'),
        finishBtn: document.getElementById('finish-btn'),
        playAgainBtn: document.getElementById('play-again-btn'),
        backHomeBtn: document.getElementById('back-home-btn')
    },
    hud: {
        stage: document.getElementById('stage-display'),
        score: document.getElementById('score-display'),
        lives: document.getElementById('lives-display'),
        progress: document.getElementById('progress-display'),
        progressMax: document.getElementById('progress-max'),
        question: document.querySelector('.question-text')
    },
    game: {
        area: document.getElementById('game-area'),
        meteorsContainer: document.getElementById('meteors-container'),
        bulletsContainer: document.getElementById('bullets-container'),
        plane: document.getElementById('player-plane'),
        stageTransition: document.getElementById('stage-transition'),
        stageNumber: document.getElementById('stage-number'),
        pauseOverlay: document.getElementById('pause-overlay')
    },
    results: {
        title: document.getElementById('results-title'),
        playerName: document.getElementById('results-player-name'),
        date: document.getElementById('results-date'),
        stage: document.getElementById('result-stage'),
        score: document.getElementById('result-score'),
        accuracy: document.getElementById('result-accuracy'),
        wrongAnswersList: document.getElementById('wrong-answers-list'),
        noWrongAnswers: document.getElementById('no-wrong-answers'),
        downloadArea: document.getElementById('results-download-area')
    },
    leaderboard: {
        body: document.getElementById('leaderboard-body'),
        loading: document.getElementById('leaderboard-loading'),
        empty: document.getElementById('leaderboard-empty')
    },
    touch: {
        controls: document.getElementById('touch-controls'),
        joystickArea: document.getElementById('joystick-area'),
        joystickKnob: document.getElementById('joystick-knob'),
        fireButton: document.getElementById('fire-button')
    }
};

// ==========================================
// Utility Functions
// ==========================================
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getNumberRange(stage) {
    for (const range of CONFIG.numberRanges) {
        if (stage <= range.maxStage) {
            return { min: range.min, max: range.max };
        }
    }
    return { min: 1, max: 12 };
}

function getFallDuration(stage) {
    const duration = CONFIG.baseFallDuration - (stage - 1) * CONFIG.fallDurationDecrement;
    return Math.max(duration, CONFIG.minFallDuration);
}

function getEffectiveStage() {
    const diffConfig = CONFIG.difficulties[gameState.difficulty];
    return gameState.stage + (diffConfig.startStage - 1);
}

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function generateQuestion() {
    const effectiveStage = getEffectiveStage();
    const range = getNumberRange(effectiveStage);
    const num1 = getRandomInt(range.min, range.max);
    const num2 = getRandomInt(range.min, range.max);
    const answer = num1 * num2;

    gameState.currentQuestion = `${num1} × ${num2} = ?`;
    gameState.correctAnswer = answer;

    elements.hud.question.textContent = gameState.currentQuestion;

    return answer;
}

function generateWrongAnswers(correctAnswer, count) {
    const wrongAnswers = new Set();
    const range = getNumberRange(getEffectiveStage());
    const maxPossible = range.max * range.max;

    while (wrongAnswers.size < count) {
        let wrong;
        const variation = getRandomInt(-10, 10);
        wrong = correctAnswer + variation;

        if (wrong !== correctAnswer && wrong > 0 && wrong <= maxPossible && !wrongAnswers.has(wrong)) {
            wrongAnswers.add(wrong);
        }
    }

    return Array.from(wrongAnswers);
}

// ==========================================
// Screen Management
// ==========================================
function showScreen(screenName) {
    Object.values(elements.screens).forEach(screen => screen.classList.remove('active'));
    elements.screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;

    // Show/hide touch controls
    if (elements.touch.controls) {
        if (screenName === 'game' && isTouchDevice()) {
            elements.touch.controls.classList.remove('hidden');
        } else {
            elements.touch.controls.classList.add('hidden');
        }
    }
}

// ==========================================
// Game Initialization
// ==========================================
function initGame() {
    // Validate player name
    const playerNameInput = elements.inputs.playerName;
    if (playerNameInput) {
        gameState.playerName = playerNameInput.value.trim() || '匿名玩家';
    }

    const diffConfig = CONFIG.difficulties[gameState.difficulty];

    gameState.stage = 1;
    gameState.score = 0;
    gameState.lives = diffConfig.lives;
    gameState.correctAnswers = 0;
    gameState.wrongHits = 0;
    gameState.totalShots = 0;
    gameState.stageProgress = 0;
    gameState.meteors = [];
    gameState.bullets = [];
    gameState.wrongAnswersList = [];
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.isVictory = false;
    gameState.isSpawningMeteors = false;

    // Clear containers
    elements.game.meteorsContainer.innerHTML = '';
    elements.game.bulletsContainer.innerHTML = '';

    // Update HUD
    updateHUD();

    // Generate first question
    generateQuestion();

    // Show game screen first (so game-area has correct dimensions)
    showScreen('game');

    // Reset plane to center (after screen is visible)
    resetPlanePosition();

    // Start audio
    AudioSystem.init();
    AudioSystem.startBGM();

    // Start game loop
    startGameLoop();

    // Spawn initial meteors with staggered timing
    spawnMeteorSet();
}

function resetPlanePosition() {
    const gameArea = elements.game.area.getBoundingClientRect();
    gameState.plane.x = gameArea.width / 2;
    gameState.plane.y = CONFIG.planeBottomMargin;
    updatePlanePosition();
}

function updatePlanePosition() {
    elements.game.plane.style.left = `${gameState.plane.x}px`;
    elements.game.plane.style.bottom = `${gameState.plane.y}px`;
    elements.game.plane.style.transform = 'translateX(-50%)';
}

function updateHUD() {
    elements.hud.stage.textContent = gameState.stage;
    elements.hud.score.textContent = gameState.score;
    elements.hud.progress.textContent = gameState.stageProgress;
    elements.hud.progressMax.textContent = `/ ${gameState.meteorsPerStage}`;

    // Update lives display
    const hearts = '❤️'.repeat(gameState.lives) + '🖤'.repeat(Math.max(0, CONFIG.difficulties[gameState.difficulty].lives - gameState.lives));
    elements.hud.lives.textContent = hearts;
}

// ==========================================
// Meteor Management
// ==========================================
function createMeteorElement(value, isCorrect) {
    const meteor = document.createElement('div');
    meteor.className = 'meteor';
    meteor.textContent = value;
    meteor.dataset.value = value;
    meteor.dataset.isCorrect = isCorrect;

    return meteor;
}

function spawnMeteorSet() {
    const gameArea = elements.game.area.getBoundingClientRect();
    const correctAnswer = gameState.correctAnswer;

    // Detect mobile: if screen width is less than 600px, use fewer meteors
    const isMobile = gameArea.width < 600;
    const maxMeteors = isMobile ? 4 : 5;  // 4 on mobile, 5 on desktop

    // Generate wrong answers
    const wrongAnswers = generateWrongAnswers(correctAnswer, maxMeteors - 1);
    const allAnswers = [correctAnswer, ...wrongAnswers.slice(0, maxMeteors - 1)];

    // Ensure we have enough answers
    while (allAnswers.length < maxMeteors) {
        const extra = correctAnswer + allAnswers.length + Math.floor(Math.random() * 10);
        if (!allAnswers.includes(extra)) {
            allAnswers.push(extra);
        }
    }

    // Limit to max
    const finalAnswers = allAnswers.slice(0, maxMeteors);

    // Shuffle answers
    for (let i = finalAnswers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalAnswers[i], finalAnswers[j]] = [finalAnswers[j], finalAnswers[i]];
    }

    const meteorWidth = CONFIG.meteorWidth;
    // Use larger padding on mobile for better spacing
    const padding = isMobile ? 30 : CONFIG.gameAreaPadding;
    const effectiveStage = getEffectiveStage();
    const fallDuration = getFallDuration(effectiveStage);

    // Calculate positions with guaranteed minimum spacing
    const availableWidth = gameArea.width - (padding * 2);
    const minSpacing = isMobile ? 25 : 15;  // Extra spacing between sections on mobile
    const totalSpacing = minSpacing * (maxMeteors - 1);
    const sectionWidth = (availableWidth - totalSpacing) / maxMeteors;

    const positions = [];
    for (let i = 0; i < finalAnswers.length; i++) {
        // Center each meteor in its section
        const sectionStart = padding + (i * (sectionWidth + minSpacing));
        const x = sectionStart + (sectionWidth - meteorWidth) / 2;
        positions.push(Math.max(padding, Math.min(x, gameArea.width - meteorWidth - padding)));
    }

    // Spawn each meteor with staggered timing AND vertical offset
    // IMPORTANT: Do NOT skip any meteor based on current count - all answers including correct must spawn
    finalAnswers.forEach((answer, index) => {
        // Stagger spawn timing more on mobile
        const spawnDelay = isMobile ? CONFIG.meteorSpawnDelay * 1.5 : CONFIG.meteorSpawnDelay;

        setTimeout(() => {
            if (!gameState.isPlaying || gameState.isPaused) return;

            // REMOVED the maxMeteors check here - it was blocking correct answers!
            // All meteors in finalAnswers array must spawn

            const isCorrect = answer === correctAnswer;
            const meteorElement = createMeteorElement(answer, isCorrect);

            const x = positions[index];
            // Vertical stagger: each meteor starts at different Y position
            // This prevents them from being on the same horizontal line
            const yOffset = index * (isMobile ? 60 : 40);  // More vertical spread on mobile
            const startY = -80 - yOffset;

            meteorElement.style.left = `${x}px`;
            meteorElement.style.top = `${startY}px`;

            elements.game.meteorsContainer.appendChild(meteorElement);

            const meteorObj = {
                element: meteorElement,
                x: x,
                y: startY,
                value: answer,
                isCorrect: isCorrect,
                fallDuration: fallDuration,
                startTime: Date.now(),
                hintShown: false
            };

            gameState.meteors.push(meteorObj);

            // Debug log to verify correct answer is being spawned
            if (isCorrect) {
                console.log('✓ Correct answer meteor spawned:', answer);
            }
        }, index * spawnDelay);
    });
}

function updateMeteors() {
    const gameArea = elements.game.area.getBoundingClientRect();
    const diffConfig = CONFIG.difficulties[gameState.difficulty];
    const planeRect = elements.game.plane.getBoundingClientRect();

    gameState.meteors = gameState.meteors.filter(meteor => {
        const elapsed = Date.now() - meteor.startTime;
        const progress = elapsed / meteor.fallDuration;

        // Calculate Y position
        meteor.y = -80 + (gameArea.height + 80) * progress;
        meteor.element.style.top = `${meteor.y}px`;

        // Show hint for correct answer in easy mode
        if (diffConfig.showHint && meteor.isCorrect && !meteor.hintShown && progress >= diffConfig.hintThreshold) {
            meteor.element.classList.add('correct-hint');
            meteor.hintShown = true;
        }

        // Check plane-meteor collision
        const meteorRect = meteor.element.getBoundingClientRect();
        if (isColliding(planeRect, meteorRect)) {
            // Plane hit by meteor - lose life
            AudioSystem.playWrong();
            meteor.element.classList.add('explode');
            setTimeout(() => meteor.element.remove(), 300);
            loseLife();
            return false;
        }

        // Check if meteor reached bottom
        if (meteor.y > gameArea.height) {
            if (meteor.isCorrect) {
                // Correct answer reached bottom - lose life
                loseLife();
                // Mark for respawn after loop
                meteor.needsRespawn = true;
            }
            meteor.element.remove();
            return false;
        }

        return true;
    });

    // Check if any meteor needed respawn (correct answer fell)
    // This is done outside the filter loop to avoid issues
    // Use isSpawningMeteors flag to prevent multiple spawns
    if (gameState.meteors.length === 0 && gameState.isPlaying && !gameState.isPaused && !gameState.isSpawningMeteors) {
        // All meteors are gone, spawn new ones
        gameState.isSpawningMeteors = true;
        generateQuestion();
        setTimeout(() => {
            if (gameState.isPlaying && !gameState.isPaused) {
                spawnMeteorSet();
            }
            gameState.isSpawningMeteors = false;
        }, 500);
    }
}

function clearAllMeteors() {
    gameState.meteors.forEach(meteor => {
        meteor.element.remove();
    });
    gameState.meteors = [];
}

function clearAllBullets() {
    gameState.bullets.forEach(bullet => {
        bullet.element.remove();
    });
    gameState.bullets = [];
}

// ==========================================
// Bullet Management
// ==========================================
function createBullet() {
    const now = Date.now();
    if (now - gameState.lastBulletTime < CONFIG.bulletInterval) return;

    gameState.lastBulletTime = now;

    // Play shoot sound
    AudioSystem.playShoot();

    const bullet = document.createElement('div');
    bullet.className = 'bullet';

    const planeRect = elements.game.plane.getBoundingClientRect();
    const gameRect = elements.game.area.getBoundingClientRect();

    const x = planeRect.left - gameRect.left + planeRect.width / 2 - 3;
    const y = planeRect.top - gameRect.top;

    bullet.style.left = `${x}px`;
    bullet.style.top = `${y}px`;

    elements.game.bulletsContainer.appendChild(bullet);

    gameState.bullets.push({
        element: bullet,
        x: x,
        y: y
    });
}

function updateBullets() {
    const gameArea = elements.game.area.getBoundingClientRect();

    gameState.bullets = gameState.bullets.filter(bullet => {
        bullet.y -= CONFIG.bulletSpeed;
        bullet.element.style.top = `${bullet.y}px`;

        // Check if bullet is off screen
        if (bullet.y < -30) {
            bullet.element.remove();
            return false;
        }

        // Check collision with meteors
        const bulletRect = bullet.element.getBoundingClientRect();

        for (let i = 0; i < gameState.meteors.length; i++) {
            const meteor = gameState.meteors[i];
            const meteorRect = meteor.element.getBoundingClientRect();

            if (isColliding(bulletRect, meteorRect)) {
                // Hit!
                gameState.totalShots++;
                bullet.element.remove();

                if (meteor.isCorrect) {
                    // Correct answer hit
                    handleCorrectHit(meteor);
                } else {
                    // Wrong answer hit
                    handleWrongHit(meteor);
                }

                return false;
            }
        }

        return true;
    });
}

function isColliding(rect1, rect2) {
    return !(rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom);
}

function handleCorrectHit(meteor) {
    gameState.correctAnswers++;
    gameState.score += 10 * gameState.stage;
    gameState.stageProgress++;

    // Play correct sound
    AudioSystem.playCorrect();
    AudioSystem.playHit();

    // Explode animation
    meteor.element.classList.add('explode');
    setTimeout(() => meteor.element.remove(), 300);

    // Remove meteor from array
    gameState.meteors = gameState.meteors.filter(m => m !== meteor);

    // Clear remaining meteors and bullets
    clearAllMeteors();
    clearAllBullets();

    updateHUD();

    // Check stage progress
    if (gameState.stageProgress >= gameState.meteorsPerStage) {
        if (gameState.stage >= CONFIG.totalStages) {
            // Victory!
            gameOver(true);
        } else {
            // Next stage
            nextStage();
        }
    } else {
        // Next question with delay to prevent accidental hits
        generateQuestion();
        setTimeout(() => spawnMeteorSet(), CONFIG.nextQuestionDelay);
    }
}

function handleWrongHit(meteor) {
    // Play wrong sound
    AudioSystem.playWrong();
    AudioSystem.playHit();

    // Record wrong answer
    gameState.wrongHits++;
    gameState.wrongAnswersList.push({
        question: gameState.currentQuestion,
        correctAnswer: gameState.correctAnswer
    });

    // Deduct score (no life loss for wrong hit)
    gameState.score = Math.max(0, gameState.score - 10);

    // Show correct answer in question display
    showCorrectAnswer();

    // Explode animation
    meteor.element.classList.add('explode');
    setTimeout(() => meteor.element.remove(), 300);

    // Remove meteor from array
    gameState.meteors = gameState.meteors.filter(m => m !== meteor);

    updateHUD();
}

function showCorrectAnswer() {
    const questionBox = document.getElementById('question-display');
    const questionText = elements.hud.question;

    // Replace ? with correct answer
    const currentQuestion = gameState.currentQuestion;
    const answerDisplay = currentQuestion.replace('?', gameState.correctAnswer);
    questionText.textContent = answerDisplay;
    questionText.classList.add('show-answer');
    questionBox.classList.add('wrong-answer');

    // Reset after delay
    setTimeout(() => {
        questionText.classList.remove('show-answer');
        questionBox.classList.remove('wrong-answer');
    }, 1000);
}

function loseLife() {
    gameState.lives--;
    updateHUD();

    // Flash effect
    elements.game.area.classList.add('damage-flash');
    setTimeout(() => elements.game.area.classList.remove('damage-flash'), 300);

    if (gameState.lives <= 0) {
        gameOver(false);
    }
}

// ==========================================
// Stage Management
// ==========================================
function nextStage() {
    gameState.stage++;
    gameState.stageProgress = 0;

    // Show stage transition
    elements.game.stageTransition.classList.remove('hidden');
    elements.game.stageNumber.textContent = gameState.stage;

    gameState.isPaused = true;

    // Reset plane to center
    resetPlanePosition();

    setTimeout(() => {
        elements.game.stageTransition.classList.add('hidden');
        gameState.isPaused = false;
        updateHUD();
        generateQuestion();
        spawnMeteorSet();
    }, 1500);
}

// ==========================================
// Player Controls
// ==========================================
function updatePlane() {
    const gameArea = elements.game.area.getBoundingClientRect();
    const planeWidth = gameState.plane.width;
    const planeHeight = gameState.plane.height;

    // Use slower speed for touch controls
    const isTouchActive = gameState.touch.joystickActive;
    const speedMultiplier = isTouchActive ? CONFIG.touchSpeedMultiplier : 1;
    const currentSpeed = CONFIG.planeSpeed * speedMultiplier;

    // Horizontal movement
    if (gameState.keys.left) {
        gameState.plane.x -= currentSpeed;
    }
    if (gameState.keys.right) {
        gameState.plane.x += currentSpeed;
    }

    // Vertical movement
    if (gameState.keys.up) {
        gameState.plane.y += currentSpeed;
    }
    if (gameState.keys.down) {
        gameState.plane.y -= currentSpeed;
    }

    // Boundary check - horizontal
    gameState.plane.x = Math.max(planeWidth / 2, Math.min(gameArea.width - planeWidth / 2, gameState.plane.x));

    // Boundary check - vertical (from bottom)
    gameState.plane.y = Math.max(CONFIG.planeBottomMargin, Math.min(CONFIG.planeTopMargin, gameState.plane.y));

    updatePlanePosition();

    // Shoot
    if (gameState.keys.shoot) {
        createBullet();
    }
}

// ==========================================
// Touch Controls
// ==========================================
function initTouchControls() {
    if (!elements.touch.joystickArea || !elements.touch.fireButton) return;

    const joystickArea = elements.touch.joystickArea;
    const joystickKnob = elements.touch.joystickKnob;
    const fireButton = elements.touch.fireButton;

    // Joystick touch events
    joystickArea.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickArea.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickArea.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickArea.addEventListener('touchcancel', handleJoystickEnd, { passive: false });

    // Fire button events
    fireButton.addEventListener('touchstart', handleFireStart, { passive: false });
    fireButton.addEventListener('touchend', handleFireEnd, { passive: false });
    fireButton.addEventListener('touchcancel', handleFireEnd, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = elements.touch.joystickArea.getBoundingClientRect();

    gameState.touch.joystickActive = true;
    gameState.touch.joystickStartX = rect.left + rect.width / 2;
    gameState.touch.joystickStartY = rect.top + rect.height / 2;

    handleJoystickMove(e);
}

function handleJoystickMove(e) {
    if (!gameState.touch.joystickActive) return;
    e.preventDefault();

    const touch = e.touches[0];
    const joystickArea = elements.touch.joystickArea;
    const joystickKnob = elements.touch.joystickKnob;
    const rect = joystickArea.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 25; // Knob radius offset

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    // Limit to circular area
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
    }

    // Update knob position
    joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    // Calculate direction (with deadzone) - use larger deadzone for mobile
    const deadzone = 25;

    // Use threshold-based controls instead of binary for smoother movement
    gameState.keys.left = deltaX < -deadzone;
    gameState.keys.right = deltaX > deadzone;
    gameState.keys.up = deltaY < -deadzone;
    gameState.keys.down = deltaY > deadzone;

    // Store joystick intensity for proportional movement
    gameState.touch.intensityX = Math.abs(deltaX) / maxRadius;
    gameState.touch.intensityY = Math.abs(deltaY) / maxRadius;
}

function handleJoystickEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    gameState.touch.joystickActive = false;

    // Reset knob position
    if (elements.touch.joystickKnob) {
        elements.touch.joystickKnob.style.transform = 'translate(0, 0)';
    }

    // Reset all direction keys
    gameState.keys.left = false;
    gameState.keys.right = false;
    gameState.keys.up = false;
    gameState.keys.down = false;
}

function handleFireStart(e) {
    e.preventDefault();
    e.stopPropagation();
    // Only handle fire, don't touch movement keys
    gameState.keys.shoot = true;
    if (elements.touch.fireButton) {
        elements.touch.fireButton.classList.add('active');
    }
}

function handleFireEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    gameState.keys.shoot = false;
    if (elements.touch.fireButton) {
        elements.touch.fireButton.classList.remove('active');
    }
}

// ==========================================
// Game Loop
// ==========================================
function gameLoop() {
    if (!gameState.isPlaying || gameState.isPaused) {
        gameState.gameLoopId = requestAnimationFrame(gameLoop);
        return;
    }

    updatePlane();
    updateMeteors();
    updateBullets();

    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    if (gameState.gameLoopId) {
        cancelAnimationFrame(gameState.gameLoopId);
    }
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
    if (gameState.gameLoopId) {
        cancelAnimationFrame(gameState.gameLoopId);
        gameState.gameLoopId = null;
    }
}

// ==========================================
// Game Over
// ==========================================
function gameOver(isVictory) {
    gameState.isPlaying = false;
    stopGameLoop();

    gameState.isVictory = isVictory;

    // Show results screen
    showResultsScreen();
}

function showResultsScreen() {
    // Set title
    if (gameState.isVictory) {
        elements.results.title.textContent = '🎉 恭喜通關！';
        elements.results.title.className = 'results-title victory';
    } else {
        elements.results.title.textContent = '📊 遊戲結算';
        elements.results.title.className = 'results-title';
    }

    // Set player name and date
    elements.results.playerName.textContent = gameState.playerName || '匿名玩家';
    elements.results.date.textContent = new Date().toLocaleDateString('zh-TW');

    // Set stats
    elements.results.stage.textContent = gameState.stage;
    elements.results.score.textContent = gameState.score;
    elements.results.accuracy.textContent = `${gameState.correctAnswers} / ${gameState.wrongHits}`;

    // Populate wrong answers list
    const wrongList = elements.results.wrongAnswersList;
    wrongList.innerHTML = '';

    if (gameState.wrongAnswersList.length === 0) {
        elements.results.noWrongAnswers.classList.remove('hidden');
    } else {
        elements.results.noWrongAnswers.classList.add('hidden');
        gameState.wrongAnswersList.forEach(item => {
            const div = document.createElement('div');
            div.className = 'wrong-answer-item';
            div.innerHTML = `
                <span class="wrong-question">${item.question}</span>
                <span class="wrong-correct-answer">= ${item.correctAnswer}</span>
            `;
            wrongList.appendChild(div);
        });
    }

    showScreen('results');
}

// Download results as image
async function downloadResultsImage() {
    const downloadArea = elements.results.downloadArea;
    const downloadBtn = elements.buttons.downloadResultBtn;

    // Disable button during processing
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '處理中...';
    }

    try {
        // Use html2canvas to capture the download area
        const canvas = await html2canvas(downloadArea, {
            backgroundColor: '#0a0a20',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        // Create filename
        const safeName = (gameState.playerName || 'player').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `MathMeteor_${safeName}_${dateStr}.png`;

        // Convert canvas to Blob
        canvas.toBlob((blob) => {
            if (!blob) {
                alert('圖片生成失敗，請重試');
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.textContent = '📥 下載成績單';
                }
                return;
            }

            // Create Blob URL
            const blobUrl = URL.createObjectURL(blob);

            // Open in new tab with instructions and download button
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${filename}</title>
                        <meta charset="UTF-8">
                        <style>
                            body { 
                                margin: 0; 
                                display: flex; 
                                justify-content: center; 
                                align-items: center; 
                                min-height: 100vh; 
                                background: #1a1a2e;
                                flex-direction: column;
                                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                                padding: 20px;
                                box-sizing: border-box;
                            }
                            img { 
                                max-width: 100%; 
                                max-height: 70vh;
                                height: auto; 
                                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                                border-radius: 8px;
                            }
                            .download-btn {
                                margin-top: 20px;
                                padding: 15px 40px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                border-radius: 30px;
                                font-size: 18px;
                                cursor: pointer;
                                text-decoration: none;
                                display: inline-block;
                            }
                            .download-btn:hover {
                                transform: scale(1.05);
                            }
                            p {
                                color: #aaa;
                                margin-top: 15px;
                                font-size: 14px;
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${blobUrl}" alt="成績單">
                        <a class="download-btn" href="${blobUrl}" download="${filename}">📥 點此下載圖片</a>
                        <p>如果按鈕無法下載，請右鍵點擊圖片 → 「另存圖片」</p>
                    </body>
                    </html>
                `);
                newWindow.document.close();
            } else {
                // Popup blocked - use direct link
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            }

            // Re-enable button
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = '📥 下載成績單';
            }
        }, 'image/png');

    } catch (error) {
        console.error('Failed to download image:', error);
        alert('下載失敗: ' + error.message);

        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = '📥 下載成績單';
        }
    }
}

// Firebase functions
async function uploadScoreToFirebase() {
    if (!window.FirebaseDB) {
        console.log('Firebase not available');
        return;
    }

    try {
        const { db, collection, addDoc, serverTimestamp } = window.FirebaseDB;

        await addDoc(collection(db, 'leaderboard'), {
            playerName: gameState.playerName || '匿名玩家',
            score: gameState.score,
            stage: gameState.stage,
            difficulty: gameState.difficulty,
            timestamp: serverTimestamp()
        });

        console.log('Score uploaded successfully');
    } catch (error) {
        console.error('Failed to upload score:', error);
    }
}

async function loadLeaderboard() {
    if (!window.FirebaseDB) {
        elements.leaderboard.loading.classList.add('hidden');
        elements.leaderboard.empty.textContent = 'Firebase 未連接';
        elements.leaderboard.empty.classList.remove('hidden');
        return;
    }

    try {
        const { db, collection, query, orderBy, limit, getDocs } = window.FirebaseDB;

        // Simple query with single orderBy to avoid composite index requirement
        // We'll sort by stage first, then sort further client-side
        const q = query(
            collection(db, 'leaderboard'),
            limit(100)
        );

        const querySnapshot = await getDocs(q);
        const leaderboardBody = elements.leaderboard.body;
        leaderboardBody.innerHTML = '';

        elements.leaderboard.loading.classList.add('hidden');

        if (querySnapshot.empty) {
            elements.leaderboard.empty.classList.remove('hidden');
            return;
        }

        elements.leaderboard.empty.classList.add('hidden');

        // Collect all docs and sort client-side
        const entries = [];
        querySnapshot.forEach(doc => {
            entries.push(doc.data());
        });

        // Sort by stage DESC, then score DESC
        entries.sort((a, b) => {
            if (b.stage !== a.stage) return b.stage - a.stage;
            return b.score - a.score;
        });

        // Take top 20
        const topEntries = entries.slice(0, 20);

        let rank = 1;
        topEntries.forEach(data => {
            const row = document.createElement('tr');

            // Highlight current player
            if (data.playerName === gameState.playerName &&
                data.score === gameState.score &&
                data.stage === gameState.stage) {
                row.className = 'current-player';
            }

            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

            row.innerHTML = `
                <td class="rank-cell ${rankClass}">${rankEmoji}</td>
                <td class="player-cell">${data.playerName}</td>
                <td class="stage-cell">${data.stage}</td>
                <td class="score-cell">${data.score}</td>
            `;

            leaderboardBody.appendChild(row);
            rank++;
        });
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        elements.leaderboard.loading.classList.add('hidden');
        elements.leaderboard.empty.textContent = '載入失敗: ' + error.message;
        elements.leaderboard.empty.classList.remove('hidden');
    }
}

async function finishAndShowLeaderboard() {
    // Upload score to Firebase
    await uploadScoreToFirebase();

    // Load and show leaderboard
    showScreen('leaderboard');
    await loadLeaderboard();
}

// ==========================================
// Pause Management
// ==========================================
function togglePause() {
    if (!gameState.isPlaying) return;

    gameState.isPaused = !gameState.isPaused;

    if (gameState.isPaused) {
        elements.game.pauseOverlay.classList.remove('hidden');
    } else {
        elements.game.pauseOverlay.classList.add('hidden');
    }
}

function resumeGame() {
    gameState.isPaused = false;
    elements.game.pauseOverlay.classList.add('hidden');
}

function quitToMenu() {
    gameState.isPlaying = false;
    stopGameLoop();
    AudioSystem.stopBGM();
    // Go to results screen instead of directly to start
    showResultsScreen();
}

// ==========================================
// Event Listeners
// ==========================================
function initEventListeners() {
    // Difficulty buttons
    elements.buttons.difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.buttons.difficultyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.difficulty = btn.dataset.difficulty;
        });
    });

    // Meteor count buttons
    elements.buttons.countBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.buttons.countBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.meteorsPerStage = parseInt(btn.dataset.count);
        });
    });

    // Start button
    elements.buttons.startBtn.addEventListener('click', initGame);

    // Pause menu buttons
    elements.buttons.resumeBtn.addEventListener('click', resumeGame);
    elements.buttons.quitBtn.addEventListener('click', quitToMenu);

    // Results screen buttons
    if (elements.buttons.downloadResultBtn) {
        elements.buttons.downloadResultBtn.addEventListener('click', downloadResultsImage);
    }
    if (elements.buttons.finishBtn) {
        elements.buttons.finishBtn.addEventListener('click', finishAndShowLeaderboard);
    }

    // Leaderboard screen buttons
    if (elements.buttons.playAgainBtn) {
        elements.buttons.playAgainBtn.addEventListener('click', initGame);
    }
    if (elements.buttons.backHomeBtn) {
        elements.buttons.backHomeBtn.addEventListener('click', () => showScreen('start'));
    }

    // Sound toggle button
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            const isMuted = AudioSystem.toggleMute();
            soundToggle.classList.toggle('muted', isMuted);
        });
    }

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (gameState.currentScreen !== 'game') return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                gameState.keys.left = true;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                gameState.keys.right = true;
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                gameState.keys.up = true;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                gameState.keys.down = true;
                break;
            case ' ':
                e.preventDefault();
                gameState.keys.shoot = true;
                break;
            case 'Escape':
            case 'p':
            case 'P':
                togglePause();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                gameState.keys.left = false;
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                gameState.keys.right = false;
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                gameState.keys.up = false;
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                gameState.keys.down = false;
                break;
            case ' ':
                gameState.keys.shoot = false;
                break;
        }
    });

    // Prevent scrolling with arrow keys
    window.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
            if (gameState.currentScreen === 'game') {
                e.preventDefault();
            }
        }
    });

    // Initialize touch controls
    initTouchControls();
}

// ==========================================
// Initialize
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    showScreen('start');
});
