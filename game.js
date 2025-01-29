// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const timerBar = document.getElementById('timerBar');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');
const pauseButton = document.getElementById('pauseButton'); // Добавлено

// Локализация
const localization = {
    currentLang: localStorage.getItem('lang') || 'ru',
    translations: {
        ru: {
            score: 'Счёт: ',
            level: 'Уровень: ',
            gameOver: 'ИГРА ОКОНЧЕНА',
            finalScore: 'Ваш результат: ',
            newRecord: 'Новый рекорд! 🎉',
            resume: 'Продолжить',
            sound: 'Звук: ',
            restart: 'Рестарт',
            mainMenu: 'Главное меню',
            difficulty: 'Сложность: '
        },
        en: {
            score: 'Score: ',
            level: 'Level: ',
            gameOver: 'GAME OVER',
            finalScore: 'Your score: ',
            newRecord: 'New Record! 🎉',
            resume: 'Resume',
            sound: 'Sound: ',
            restart: 'Restart',
            mainMenu: 'Main Menu',
            difficulty: 'Difficulty: '
        }
    }
};

function t(key) {
    return localization.translations[localization.currentLang][key] || key;
}

// Звуковые эффекты
const sounds = {
    collect: new Audio('sounds/collect.wav'),
    special: new Audio('sounds/special.wav'),
    gameOver: new Audio('sounds/gameover.wav')
};

let isSoundEnabled = localStorage.getItem('sound') !== 'false'; // Добавлено
let mouseX = 0;
let mouseY = 0;
let rotation = 0;

canvas.width = 800;
canvas.height = 600;

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 40,
    speed: 6
};

let targets = [];
let particles = [];
let score = 0;
let level = 1;
let timeLeft = 30;
let isGameActive = true;
let bestScore = localStorage.getItem('bestScore') || 0;
let difficulty = 'medium';
let timerIntervalId;
let spawnTimeout;
let isPaused = false; // Добавлено

const DIFFICULTY_SETTINGS = {
    easy: {
        playerSpeed: 5,
        targetSpeed: 1.5,
        hunterChance: 0.05,    // Частота появления (5%)
        hunterLifetime: 3000,  // Время жизни (3 сек)
        time: 40,
        spawnInterval: 2000,
        timerInterval: 1000
    },
    medium: {
        playerSpeed: 6,
        targetSpeed: 2.0,
        hunterChance: 0.15,    // 15%
        hunterLifetime: 2000,  // 2 сек
        time: 30,
        spawnInterval: 1500,
        timerInterval: 800
    },
    hard: {
        playerSpeed: 7,
        targetSpeed: 2.5,
        hunterChance: 0.25,    // 25%
        hunterLifetime: 1500,  // 1.5 сек
        time: 20,
        spawnInterval: 1000,
        timerInterval: 600
    }
};

const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    arrowup: false,
    arrowdown: false,
    arrowleft: false,
    arrowright: false
};

document.addEventListener('keydown', (e) => {
    if (isPaused) return; // Блокировка ввода при паузе
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }
});

function createTarget() {
    if (targets.length > 20) return;
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const isSpecial = Math.random() < 0.1;
    const direction = Math.random() * Math.PI * 2;
    const hue = Math.random() * 360;
    
    const safeX = Math.max(20, Math.min(canvas.width - 20, Math.random() * canvas.width));
    const safeY = Math.max(20, Math.min(canvas.height - 20, Math.random() * canvas.height));

   if (Math.random() < settings.hunterChance) {
    targets.push({
        x: safeX,
        y: safeY,
        size: 20,
        color: '#ff0000',
        shape: 'triangle',
        lifeTime: settings.hunterLifetime, // Используем настройку
        spawnTime: Date.now(),
        isHunter: true,
        speed: 2
    });
    playSound(sounds.special);
    return;
}

    targets.push({
        x: safeX,
        y: safeY,
        size: isSpecial ? 35 : 25,
        color: isSpecial ? `hsl(${hue}, 80%, 50%)` : `hsl(${hue}, 70%, 60%)`,
        scale: 0,
        speed: isSpecial ? 0 : Math.random() * settings.targetSpeed + level/2,
        direction: direction,
        isSpecial: isSpecial,
        isHunter: false
    });
}
function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').classList.toggle('hidden', !isPaused);
    if(isPaused) {
        clearInterval(timerIntervalId);
        clearTimeout(spawnTimeout);
    } else {
        startTimers();
        requestAnimationFrame(update); // Возобновляем анимацию
    }
}

function startTimers() {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    timerIntervalId = setInterval(() => {
        if (isGameActive && !isPaused) {
            timeLeft -= 1;
            if(timeLeft <= 0) showGameOver();
        }
    }, settings.timerInterval);
    spawnTarget();
}

function updateUI() {
    scoreElement.textContent = t('score') + score;
    levelElement.textContent = t('level') + level;
    finalScoreElement.textContent = score;
    document.getElementById('soundButton').textContent = t('sound') + (isSoundEnabled ? 'ON' : 'OFF');
    document.getElementById('difficultyLabel').textContent = t('difficulty') + difficulty;
    document.querySelectorAll('[data-lang]').forEach(el => {
        el.textContent = t(el.dataset.lang);
    });
}

function checkCollision(player, target) {
    const dx = player.x - target.x;
    const dy = player.y - target.y;
    return Math.sqrt(dx * dx + dy * dy) < (player.size/2 + target.size/2);
}

function moveTargets() {
    targets.forEach(target => {
        if(typeof target.x !== 'number' || typeof target.y !== 'number') return;

        if(target.isHunter) {
            const angle = Math.atan2(player.y - target.y, player.x - target.x);
            target.x += Math.cos(angle) * target.speed;
            target.y += Math.sin(angle) * target.speed;
            
            target.x = Math.max(10, Math.min(canvas.width - 10, target.x));
            target.y = Math.max(10, Math.min(canvas.height - 10, target.y));
        } else if(!target.isSpecial) {
            target.x += Math.cos(target.direction) * target.speed;
            target.y += Math.sin(target.direction) * target.speed;
            
            if(target.x < 0 || target.x > canvas.width) {
                target.direction = Math.PI - target.direction;
                target.x = Math.max(0, Math.min(canvas.width, target.x));
            }
            if(target.y < 0 || target.y > canvas.height) {
                target.direction = Math.PI*2 - target.direction;
                target.y = Math.max(0, Math.min(canvas.height, target.y));
            }
        }
    });
}

function createParticles(x, y, color) {
    for(let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 4 + 2,
            color: color,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 3 + 2,
            life: 1
        });
    }
}

function drawParticles() {
    particles = particles.filter(p => {
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.life -= 0.03;

        if(p.life <= 0) return false;
        
        const radius = Math.max(0, p.size * p.life);
        if(radius <= 0) return false;

        ctx.fillStyle = `${p.color}${Math.floor(p.life * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        return true;
    });
}

function drawPlayer() {
    rotation += 0.02;
    
    ctx.save();
    ctx.shadowColor = 'rgba(0,255,200,0.5)';
    ctx.shadowBlur = 30;
    
    ctx.transform(
        1 + mouseY * 0.1, 
        mouseX * 0.1, 
        mouseY * 0.1, 
        1 - mouseX * 0.1, 
        mouseX * 20, 
        mouseY * 20
    );

    ctx.fillStyle = createPlayerGradient();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.arc(0, 0, player.size/2 * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.restore();

    ctx.restore();
}

function drawTarget(target) {
    if (target.shape === 'triangle') {
        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.rotate(Math.atan2(player.y - target.y, player.x - target.x));
        ctx.fillStyle = target.color;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    } else {
        if (typeof target.x !== 'number' || typeof target.y !== 'number' || 
            isNaN(target.x) || isNaN(target.y)) {
            return;
        }

        ctx.save();
        const parallaxX = mouseX * target.size * 0.2;
        const parallaxY = mouseY * target.size * 0.2;
        
        const gradient = ctx.createRadialGradient(
            target.x + parallaxX,
            target.y + parallaxY,
            0,
            target.x,
            target.y,
            Math.max(0, target.size/2 * target.scale)
        );
        
        gradient.addColorStop(0, target.color);
        gradient.addColorStop(1, target.color.replace(/\)/g, ', 0.5)'));
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.arc(
            target.x + parallaxX/2, 
            target.y + parallaxY/2, 
            (target.size/2) * target.scale, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }
}

let lastTime = 0;
const timeStep = 1000/60;

function update(timestamp) {
    if (!isGameActive || isPaused) return;
    
    try {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;

        if (deltaTime >= timeStep) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            canvas.style.setProperty('--mouse-x', mouseX);
            canvas.style.setProperty('--mouse-y', mouseY);

            if (keys.arrowup) mouseY = Math.max(-1, mouseY - 0.03);
            if (keys.arrowdown) mouseY = Math.min(1, mouseY + 0.03);
            if (keys.arrowleft) mouseX = Math.max(-1, mouseX - 0.03);
            if (keys.arrowright) mouseX = Math.min(1, mouseX + 0.03);

            if (keys.w) player.y -= player.speed;
            if (keys.s) player.y += player.speed;
            if (keys.a) player.x -= player.speed;
            if (keys.d) player.x += player.speed;

            player.x = Math.max(player.size/2, Math.min(canvas.width - player.size/2, player.x));
            player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y));
            
            moveTargets();

            targets.forEach(target => {
                if (typeof target.scale === 'number' && target.scale < 1) {
                    target.scale += 0.1;
                } else {
                    target.scale = 1;
                }
            });

        targets = targets.filter(target => {
                if(checkCollision(player, target)) {
                    if(target.isHunter) {
                        showGameOver();
                        return false;
                    }
                    
                    if(target.isSpecial) {
                        playSound(sounds.special);
                        score += 50;
                        timeLeft += 5;
                    } else {
                        playSound(sounds.collect);
                        score += 15;
                    }
                    
                    scoreElement.textContent = t('score') + score;
                    
                    if(score >= level * 100) {
                        level++;
                        levelElement.textContent = t('level') + level;
                        // ... анимация уровня ...
                    }
                    createParticles(target.x, target.y, target.color);
                    return false;
                }
                
                // Проверка времени жизни охотника
                if (target.isHunter && Date.now() - target.spawnTime > target.lifeTime) {
                    createParticles(target.x, target.y, target.color);
                    return false;
                }
    
    return true;
});

            drawPlayer();
            targets.forEach(target => drawTarget(target));
            drawParticles();
            
            const timerPercent = timeLeft / DIFFICULTY_SETTINGS[difficulty].time * 100;
            timerBar.style.width = `${timerPercent > 0 ? timerPercent : 0}%`;
            
            lastTime = timestamp - (deltaTime % timeStep);
        }
    } catch (error) {
        console.error('Game error:', error);
        isGameActive = false;
    }
   if (!isPaused) { // Запрос нового кадра только если не на паузе
        requestAnimationFrame(update);
    }
}

function createPlayerGradient() {
    const gradient = ctx.createRadialGradient(
        player.x, player.y, 5,
        player.x, player.y, player.size/2
    );
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(1, '#0077ff');
    return gradient;
}

function showGameOver() {
    isGameActive = false;
    clearInterval(timerIntervalId);
    clearTimeout(spawnTimeout);
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.innerHTML = score;
    
    if(score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        finalScoreElement.innerHTML += `<br>${t('newRecord')}`;
    }
    
    playSound(sounds.gameOver); // Используем playSound вместо прямого вызова
}

function playSound(sound) {
    if(isSoundEnabled) {
        sound.play().catch(() => {});
    }
}
function startGame(selectedDifficulty) {
    difficulty = selectedDifficulty;
    const settings = DIFFICULTY_SETTINGS[difficulty];
    timeLeft = settings.time;
    mouseX = 0;
    mouseY = 0;
    canvas.style.setProperty('--mouse-x', 0);
    canvas.style.setProperty('--mouse-y', 0);
    document.getElementById('difficultyScreen').classList.add('hidden');
    restartButton.classList.remove('hidden');
    restartGame();
}

function restartGame() {
    clearInterval(timerIntervalId);
    clearTimeout(spawnTimeout);
    
    gameOverScreen.classList.add('hidden');
    const settings = DIFFICULTY_SETTINGS[difficulty];
    timeLeft = settings.time;
    player.speed = settings.playerSpeed;
    
    score = 0;
    level = 1;
    targets = [];
    particles = [];
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    
    scoreElement.textContent = `Счёт: 0`;
    levelElement.textContent = `Уровень: 1`;
    timerBar.style.width = '100%';
    
    isPaused = false;
    isGameActive = true;
    spawnTarget();
    
    timerIntervalId = setInterval(() => {
        if (isGameActive) {
            timeLeft -= 1;
            if(timeLeft <= 0) showGameOver();
        }
    }, settings.timerInterval);
    
    requestAnimationFrame(update);
}

function spawnTarget(){
    if(!isGameActive) return;
    createTarget();
    spawnTimeout = setTimeout(spawnTarget, DIFFICULTY_SETTINGS[difficulty].spawnInterval);
}

document.getElementById('resumeButton').addEventListener('click', togglePause);
document.getElementById('soundButton').addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('sound', isSoundEnabled);
    updateUI();
});
document.getElementById('languageButton').addEventListener('click', () => {
    localization.currentLang = localization.currentLang === 'ru' ? 'en' : 'ru';
    localStorage.setItem('lang', localization.currentLang);
    updateUI();
});
document.getElementById('mainMenuButton').addEventListener('click', () => {
    window.location.reload();
});


// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    updateUI(); // Добавлено
    document.getElementById('startEasy').addEventListener('click', () => startGame('easy'));
    document.getElementById('startMedium').addEventListener('click', () => startGame('medium'));
    document.getElementById('startHard').addEventListener('click', () => startGame('hard'));
    restartButton.addEventListener('click', () => restartGame());
    pauseButton.addEventListener('click', togglePause); // Добавлено
});
