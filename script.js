// Game configuration
const CONFIG = {
    snakes: {
        16: 6,
        47: 26,
        49: 11,
        56: 53,
        62: 19,
        64: 60,
        87: 24,
        93: 73,
        95: 75,
        98: 78
    },
    ladders: {
        1: 38,
        4: 14,
        9: 31,
        21: 42,
        28: 84,
        36: 44,
        51: 67,
        71: 91,
        80: 100
    },
    gameModes: {
        VS_FRIEND: 'friend',
        VS_AI: 'ai',
        ONLINE: 'online'
    }
};

// Online simulation (using localStorage as a simple "server")
class OnlineManager {
    constructor() {
        this.rooms = new Map();
        this.currentRoom = null;
        this.playerId = this.generateId();
        this.isHost = false;
    }

    generateId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    generateRoomCode() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    createRoom(playerName) {
        const roomCode = this.generateRoomCode();
        const room = {
            code: roomCode,
            players: [
                { id: this.playerId, name: playerName, position: 1, isHost: true }
            ],
            currentPlayer: this.playerId,
            gameState: 'waiting',
            diceValue: 1,
            lastUpdate: Date.now()
        };
        
        this.rooms.set(roomCode, room);
        this.currentRoom = roomCode;
        this.isHost = true;
        
        this.saveToStorage();
        return roomCode;
    }

    joinRoom(roomCode, playerName) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }
        
        if (room.players.length >= 2) {
            throw new Error('Room is full');
        }
        
        room.players.push({
            id: this.playerId,
            name: playerName,
            position: 1,
            isHost: false
        });
        
        room.gameState = 'playing';
        this.currentRoom = roomCode;
        this.isHost = false;
        
        this.saveToStorage();
        return room;
    }

    leaveRoom() {
        if (!this.currentRoom) return;
        
        const room = this.rooms.get(this.currentRoom);
        if (room) {
            room.players = room.players.filter(p => p.id !== this.playerId);
            if (room.players.length === 0) {
                this.rooms.delete(this.currentRoom);
            }
        }
        
        this.currentRoom = null;
        this.isHost = false;
        this.saveToStorage();
    }

    makeMove(diceValue) {
        if (!this.currentRoom) return;
        
        const room = this.rooms.get(this.currentRoom);
        if (!room || room.currentPlayer !== this.playerId) return;
        
        const player = room.players.find(p => p.id === this.playerId);
        if (!player) return;
        
        // Calculate new position
        let newPosition = player.position + diceValue;
        
        // Check for win
        if (newPosition === 100) {
            room.gameState = 'finished';
        } else if (newPosition > 100) {
            newPosition = player.position; // Stay in place if overshoot
        } else {
            // Check for snakes and ladders
            if (CONFIG.snakes[newPosition]) {
                newPosition = CONFIG.snakes[newPosition];
            } else if (CONFIG.ladders[newPosition]) {
                newPosition = CONFIG.ladders[newPosition];
            }
        }
        
        player.position = newPosition;
        player.moved = true;
        
        // Switch turns if game isn't over
        if (room.gameState !== 'finished') {
            const currentIndex = room.players.findIndex(p => p.id === room.currentPlayer);
            room.currentPlayer = room.players[(currentIndex + 1) % room.players.length].id;
        }
        
        room.diceValue = diceValue;
        room.lastUpdate = Date.now();
        
        this.saveToStorage();
        return room;
    }

    getRoomState() {
        if (!this.currentRoom) return null;
        return this.rooms.get(this.currentRoom);
    }

    saveToStorage() {
        const data = {
            rooms: Object.fromEntries(this.rooms),
            timestamp: Date.now()
        };
        localStorage.setItem('snakes_ladders_online', JSON.stringify(data));
    }

    loadFromStorage() {
        const data = localStorage.getItem('snakes_ladders_online');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                // Clean up old rooms (older than 1 hour)
                const oneHourAgo = Date.now() - 3600000;
                if (parsed.timestamp && parsed.timestamp > oneHourAgo && parsed.rooms) {
                    this.rooms = new Map(Object.entries(parsed.rooms));
                }
            } catch (e) {
                console.log('No previous online data found');
            }
        }
    }

    checkForOpponentMove() {
        if (!this.currentRoom) return null;
        
        const room = this.rooms.get(this.currentRoom);
        if (!room || room.currentPlayer === this.playerId) return null;
        
        // Simulate AI move if opponent left
        if (room.players.length === 1) {
            this.simulateAIMove(room);
            return room;
        }
        
        return room;
    }

    simulateAIMove(room) {
        const diceValue = Math.floor(Math.random() * 6) + 1;
        const aiPlayer = room.players.find(p => p.id !== this.playerId);
        
        if (!aiPlayer) return;
        
        let newPosition = aiPlayer.position + diceValue;
        
        if (newPosition === 100) {
            room.gameState = 'finished';
        } else if (newPosition > 100) {
            newPosition = aiPlayer.position;
        } else {
            if (CONFIG.snakes[newPosition]) {
                newPosition = CONFIG.snakes[newPosition];
            } else if (CONFIG.ladders[newPosition]) {
                newPosition = CONFIG.ladders[newPosition];
            }
        }
        
        aiPlayer.position = newPosition;
        aiPlayer.moved = true;
        room.currentPlayer = this.playerId;
        room.diceValue = diceValue;
        room.lastUpdate = Date.now();
        
        this.saveToStorage();
    }
}

// Game state
let gameState = {
    players: {
        player1: { position: 1, name: 'Player 1', isAI: false, id: null },
        player2: { position: 1, name: 'Player 2', isAI: false, id: null }
    },
    currentPlayer: 'player1',
    gameOver: false,
    diceValue: 1,
    gameMode: CONFIG.gameModes.VS_FRIEND,
    stats: {
        player1Wins: 0,
        player2Wins: 0,
        totalGames: 0
    },
    online: {
        isOnline: false,
        roomCode: null,
        isHost: false
    }
};

// Initialize online manager
const onlineManager = new OnlineManager();

// DOM Elements
const elements = {
    // Screens
    setupScreen: document.getElementById('setupScreen'),
    waitingScreen: document.getElementById('waitingScreen'),
    gameScreen: document.getElementById('gameScreen'),
    
    // Setup elements
    player1Name: document.getElementById('player1Name'),
    player2Name: document.getElementById('player2Name'),
    startGameBtn: document.getElementById('startGameBtn'),
    gameModeRadios: document.getElementsByName('gameMode'),
    onlineOptions: document.getElementById('onlineOptions'),
    roomCode: document.getElementById('roomCode'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    
    // Waiting screen elements
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    waitingPlayer1: document.getElementById('waitingPlayer1'),
    waitingPlayer2: document.getElementById('waitingPlayer2'),
    cancelWaitingBtn: document.getElementById('cancelWaitingBtn'),
    
    // Game elements
    onlineStatus: document.getElementById('onlineStatus'),
    roomInfo: document.getElementById('roomInfo'),
    board: document.getElementById('board'),
    status: document.getElementById('status'),
    rollBtn: document.getElementById('rollBtn'),
    restartBtn: document.getElementById('restartBtn'),
    themeToggle: document.getElementById('themeToggle'),
    setupBtn: document.getElementById('setupBtn'),
    player1: document.getElementById('player1'),
    player2: document.getElementById('player2'),
    player1Display: document.getElementById('player1Display'),
    player2Display: document.getElementById('player2Display'),
    dice: document.getElementById('dice'),
    player1Wins: document.getElementById('player1Wins'),
    player2Wins: document.getElementById('player2Wins'),
    player1WinsName: document.getElementById('player1WinsName'),
    player2WinsName: document.getElementById('player2WinsName'),
    totalGames: document.getElementById('totalGames')
};

// Initialize the game
function initGame() {
    onlineManager.loadFromStorage();
    setupEventListeners();
    showSetupScreen();
    
    // Check for online game state every second
    setInterval(checkOnlineState, 1000);
}

// Show setup screen
function showSetupScreen() {
    elements.setupScreen.classList.add('active');
    elements.waitingScreen.classList.remove('active');
    elements.gameScreen.classList.remove('active');
    
    // Leave any online room
    onlineManager.leaveRoom();
    
    // Reset game state
    resetGame();
}

// Handle game mode change
function handleGameModeChange() {
    const selectedMode = getSelectedGameMode();
    elements.onlineOptions.classList.toggle('hidden', selectedMode !== CONFIG.gameModes.ONLINE);
    
    // Disable player 2 name input in AI mode
    elements.player2Name.disabled = (selectedMode === CONFIG.gameModes.VS_AI);
    if (selectedMode === CONFIG.gameModes.VS_AI) {
        elements.player2Name.value = 'AI Player';
    } else if (selectedMode === CONFIG.gameModes.VS_FRIEND) {
        elements.player2Name.value = elements.player2Name.value === 'AI Player' ? 'Player 2' : elements.player2Name.value;
    }
}

// Get selected game mode
function getSelectedGameMode() {
    for (const radio of elements.gameModeRadios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return CONFIG.gameModes.VS_FRIEND;
}

// Start the game with player settings
function startGame() {
    const player1Name = elements.player1Name.value.trim() || 'Player 1';
    const player2Name = elements.player2Name.value.trim() || 'Player 2';
    const selectedMode = getSelectedGameMode();
    
    if (selectedMode === CONFIG.gameModes.ONLINE) {
        startOnlineGame(player1Name);
    } else {
        startLocalGame(player1Name, player2Name, selectedMode);
    }
}

// Start local game (VS Friend or VS AI)
function startLocalGame(player1Name, player2Name, gameMode) {
    gameState.players.player1.name = player1Name;
    gameState.players.player2.name = player2Name;
    gameState.gameMode = gameMode;
    
    // Set AI status based on game mode
    if (gameMode === CONFIG.gameModes.VS_AI) {
        gameState.players.player2.isAI = true;
        gameState.players.player2.name = 'AI Player';
    } else {
        gameState.players.player2.isAI = false;
    }
    
    // Update display
    updatePlayerDisplays();
    resetGame();
    showGameScreen();
}

// Start online game
function startOnlineGame(playerName) {
    const roomCode = elements.roomCode.value.trim().toUpperCase();
    
    try {
        if (roomCode) {
            // Join existing room
            const room = onlineManager.joinRoom(roomCode, playerName);
            setupOnlineGame(room, playerName, false);
            showGameScreen();
        } else {
            // Create new room
            const newRoomCode = onlineManager.createRoom(playerName);
            setupOnlineGame(onlineManager.getRoomState(), playerName, true);
            showWaitingScreen(newRoomCode);
        }
    } catch (error) {
        alert(error.message);
    }
}

// Setup online game
function setupOnlineGame(room, playerName, isHost) {
    gameState.online.isOnline = true;
    gameState.online.roomCode = room.code;
    gameState.online.isHost = isHost;
    
    const player1 = room.players[0];
    const player2 = room.players[1] || { name: 'Waiting...', position: 1 };
    
    // Determine which player is the current user
    if (player1.id === onlineManager.playerId) {
        gameState.players.player1 = { ...player1, isAI: false };
        gameState.players.player2 = { ...player2, isAI: !player2.id };
        gameState.players.player2.id = player2.id;
    } else {
        gameState.players.player1 = { ...player2, isAI: false };
        gameState.players.player2 = { ...player1, isAI: false };
    }
    
    gameState.players.player1.id = onlineManager.playerId;
    gameState.currentPlayer = room.currentPlayer === onlineManager.playerId ? 'player1' : 'player2';
    gameState.diceValue = room.diceValue;
    gameState.gameOver = room.gameState === 'finished';
    
    updatePlayerDisplays();
    updateOnlineStatus();
}

// Show waiting screen
function showWaitingScreen(roomCode) {
    elements.setupScreen.classList.remove('active');
    elements.waitingScreen.classList.add('active');
    elements.gameScreen.classList.remove('active');
    
    elements.roomCodeDisplay.textContent = roomCode;
    elements.waitingPlayer1.textContent = gameState.players.player1.name;
    elements.waitingPlayer2.textContent = 'Waiting for player...';
}

// Show game screen
function showGameScreen() {
    elements.setupScreen.classList.remove('active');
    elements.waitingScreen.classList.remove('active');
    elements.gameScreen.classList.add('active');
    
    createBoard();
    updateGameInfo();
}

// Update online status display
function updateOnlineStatus() {
    if (gameState.online.isOnline) {
        elements.onlineStatus.classList.remove('hidden');
        elements.roomInfo.textContent = `Room: ${gameState.online.roomCode}`;
    } else {
        elements.onlineStatus.classList.add('hidden');
    }
}

// Check for online state updates
function checkOnlineState() {
    if (!gameState.online.isOnline) return;
    
    const room = onlineManager.checkForOpponentMove();
    if (room) {
        // Update game state from online room
        const currentPlayerId = room.currentPlayer;
        gameState.currentPlayer = currentPlayerId === onlineManager.playerId ? 'player1' : 'player2';
        gameState.diceValue = room.diceValue;
        gameState.gameOver = room.gameState === 'finished';
        
        // Update player positions
        room.players.forEach(player => {
            if (player.id === onlineManager.playerId) {
                gameState.players.player1.position = player.position;
                if (player.moved) {
                    gameState.players.player1.moved = true;
                }
            } else {
                gameState.players.player2.position = player.position;
                gameState.players.player2.name = player.name;
                if (player.moved) {
                    gameState.players.player2.moved = true;
                }
            }
        });
        
        updatePlayerDisplays();
        updatePlayerPositions();
        updateGameInfo();
        
        // Play sounds for opponent's moves
        if (room.diceValue > 0 && currentPlayerId !== onlineManager.playerId) {
            document.getElementById('diceSound').play();
        }
    }
}

// Update player displays
function updatePlayerDisplays() {
    elements.player1Display.textContent = gameState.players.player1.name;
    elements.player2Display.textContent = gameState.players.player2.name;
    elements.player1WinsName.textContent = gameState.players.player1.name;
    elements.player2WinsName.textContent = gameState.players.player2.name;
}

// Reset game state
function resetGame() {
    gameState.players.player1.position = 1;
    gameState.players.player2.position = 1;
    gameState.currentPlayer = 'player1';
    gameState.gameOver = false;
    gameState.diceValue = 1;
    gameState.online.isOnline = false;
    gameState.online.roomCode = null;
    gameState.online.isHost = false;
    
    updateOnlineStatus();
}

// Create the game board
function createBoard() {
    elements.board.innerHTML = '';
    
    // Create cells from 100 to 1 (zigzag pattern)
    for (let row = 9; row >= 0; row--) {
        const isReverse = row % 2 === 1; // Odd rows go right to left
        
        for (let col = 0; col < 10; col++) {
            const cellNumber = isReverse ? 
                (row * 10) + (9 - col) + 1 : 
                (row * 10) + col + 1;
                
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${cellNumber}`;
            cell.dataset.number = cellNumber;
            
            const cellNumberSpan = document.createElement('span');
            cellNumberSpan.className = 'cell-number';
            cellNumberSpan.textContent = cellNumber;
            cell.appendChild(cellNumberSpan);
            
            // Add snakes and ladders
            if (CONFIG.snakes[cellNumber]) {
                cell.classList.add('snake');
                cell.title = `Snake to ${CONFIG.snakes[cellNumber]}`;
            } else if (CONFIG.ladders[cellNumber]) {
                cell.classList.add('ladder');
                cell.title = `Ladder to ${CONFIG.ladders[cellNumber]}`;
            }
            
            elements.board.appendChild(cell);
        }
    }
    
    updatePlayerPositions();
}

// Update player positions on the board
function updatePlayerPositions() {
    // Remove all previous player pieces
    document.querySelectorAll('.player-piece-on-board').forEach(el => el.remove());
    
    // Add player pieces at their new positions
    for (const player in gameState.players) {
        const position = gameState.players[player].position;
        const cell = document.getElementById(`cell-${position}`);
        
        if (cell) {
            const piece = document.createElement('div');
            piece.className = `player-piece-on-board ${player}-piece`;
            piece.dataset.player = player;
            
            cell.style.position = 'relative';
            cell.appendChild(piece);
            
            // Add moving animation if the player just moved
            if (gameState.players[player].moved) {
                piece.classList.add('moving');
                setTimeout(() => {
                    piece.classList.remove('moving');
                    gameState.players[player].moved = false;
                }, 500);
            }
        }
    }
}

// Update game information display
function updateGameInfo() {
    const player1Element = elements.player1;
    const player2Element = elements.player2;
    
    // Update active player
    player1Element.classList.toggle('active', gameState.currentPlayer === 'player1');
    player2Element.classList.toggle('active', gameState.currentPlayer === 'player2');
    
    // Update game status
    if (gameState.gameOver) {
        const winner = gameState.currentPlayer === 'player1' ? 
            gameState.players.player1.name : 
            gameState.players.player2.name;
        elements.status.textContent = `${winner} wins! 🎉`;
        elements.rollBtn.disabled = true;
        
        // Play win sound
        if (!gameState.soundPlayed) {
            document.getElementById('winSound').play();
            gameState.soundPlayed = true;
        }
    } else {
        const currentPlayerName = gameState.currentPlayer === 'player1' ? 
            gameState.players.player1.name : 
            gameState.players.player2.name;
        elements.status.textContent = `${currentPlayerName}'s turn - Rolled: ${gameState.diceValue}`;
        
        // Enable/disable roll button based on turn and game mode
        if (gameState.online.isOnline) {
            elements.rollBtn.disabled = gameState.currentPlayer !== 'player1';
        } else {
            elements.rollBtn.disabled = gameState.players[gameState.currentPlayer].isAI;
        }
        
        gameState.soundPlayed = false;
    }
}

// Update game statistics
function updateStats() {
    elements.player1Wins.textContent = gameState.stats.player1Wins;
    elements.player2Wins.textContent = gameState.stats.player2Wins;
    elements.totalGames.textContent = gameState.stats.totalGames;
}

// Set up event listeners
function setupEventListeners() {
    // Setup screen events
    elements.startGameBtn.addEventListener('click', startGame);
    
    // Game mode change events
    elements.gameModeRadios.forEach(radio => {
        radio.addEventListener('change', handleGameModeChange);
    });
    
    // Online buttons
    elements.createRoomBtn.addEventListener('click', () => {
        elements.roomCode.value = '';
    });
    
    elements.joinRoomBtn.addEventListener('click', () => {
        // Focus on room code input
        elements.roomCode.focus();
    });
    
    // Waiting screen events
    elements.cancelWaitingBtn.addEventListener('click', showSetupScreen);
    
    // Game screen events
    elements.rollBtn.addEventListener('click', rollDice);
    elements.restartBtn.addEventListener('click', restartGame);
    elements.themeToggle.addEventListener('click', toggleDarkMode);
    elements.setupBtn.addEventListener('click', showSetupScreen);
    
    // Allow Enter key to start game
    elements.player1Name.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGame();
    });
    elements.player2Name.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGame();
    });
    elements.roomCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startGame();
    });
}

// Roll the dice
function rollDice() {
    if (gameState.gameOver) return;
    
    const dice = elements.dice;
    const rollBtn = elements.rollBtn;
    
    // Disable button during roll
    rollBtn.disabled = true;
    
    // Dice rolling animation
    dice.classList.add('dice-rolling');
    
    // Multiple rapid rolls for animation effect
    let rolls = 0;
    const rollInterval = setInterval(() => {
        const randomValue = Math.floor(Math.random() * 6) + 1;
        updateDiceFace(randomValue);
        rolls++;
        
        if (rolls > 10) {
            clearInterval(rollInterval);
            const finalValue = Math.floor(Math.random() * 6) + 1;
            gameState.diceValue = finalValue;
            updateDiceFace(finalValue);
            dice.classList.remove('dice-rolling');
            
            // Play dice sound
            document.getElementById('diceSound').play();
            
            // Process player movement
            setTimeout(() => {
                if (gameState.online.isOnline) {
                    makeOnlineMove(finalValue);
                } else {
                    movePlayer(gameState.currentPlayer, finalValue);
                }
            }, 500);
        }
    }, 100);
}

// Make online move
function makeOnlineMove(diceValue) {
    const room = onlineManager.makeMove(diceValue);
    if (room) {
        // Update local game state from room
        gameState.players.player1.position = room.players.find(p => p.id === onlineManager.playerId).position;
        const opponent = room.players.find(p => p.id !== onlineManager.playerId);
        if (opponent) {
            gameState.players.player2.position = opponent.position;
        }
        gameState.currentPlayer = room.currentPlayer === onlineManager.playerId ? 'player1' : 'player2';
        gameState.gameOver = room.gameState === 'finished';
        
        updatePlayerPositions();
        updateGameInfo();
        
        // Update statistics if game over
        if (gameState.gameOver) {
            gameState.stats.totalGames++;
            if (room.currentPlayer === onlineManager.playerId) {
                gameState.stats.player1Wins++;
            } else {
                gameState.stats.player2Wins++;
            }
            updateStats();
        }
    }
}

// Update dice face display
function updateDiceFace(value) {
    const dice = elements.dice;
    dice.innerHTML = '';
    
    const diceFace = document.createElement('div');
    diceFace.className = 'dice-face';
    diceFace.dataset.value = value;
    
    // Create dots based on dice value
    for (let i = 0; i < value; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        diceFace.appendChild(dot);
    }
    
    dice.appendChild(diceFace);
    dice.style.transform = `rotate(${Math.random() * 360}deg)`;
}

// Move player (for local games)
function movePlayer(player, steps) {
    const currentPosition = gameState.players[player].position;
    let newPosition = currentPosition + steps;
    
    // Check if player won
    if (newPosition === 100) {
        gameState.players[player].position = newPosition;
        gameState.players[player].moved = true;
        updatePlayerPositions();
        endGame(player);
        return;
    }
    
    // If player exceeds 100, they don't move
    if (newPosition > 100) {
        newPosition = currentPosition;
    }
    
    gameState.players[player].position = newPosition;
    gameState.players[player].moved = true;
    
    // Check for snake or ladder
    let specialMove = false;
    if (CONFIG.snakes[newPosition]) {
        document.getElementById('snakeSound').play();
        gameState.players[player].position = CONFIG.snakes[newPosition];
        specialMove = true;
    } else if (CONFIG.ladders[newPosition]) {
        document.getElementById('ladderSound').play();
        gameState.players[player].position = CONFIG.ladders[newPosition];
        specialMove = true;
    }
    
    updatePlayerPositions();
    updateGameInfo();
    
    // If there was a special move, update position again
    if (specialMove) {
        setTimeout(() => {
            gameState.players[player].moved = true;
            updatePlayerPositions();
        }, 600);
    }
    
    // Switch turns if game isn't over
    if (!gameState.gameOver) {
        setTimeout(() => {
            switchTurns();
        }, 1000);
    }
}

// Switch turns between players (for local games)
function switchTurns() {
    gameState.currentPlayer = gameState.currentPlayer === 'player1' ? 'player2' : 'player1';
    updateGameInfo();
    
    // If next player is AI, make their move automatically
    if (gameState.players[gameState.currentPlayer].isAI && !gameState.gameOver) {
        setTimeout(() => {
            rollDice();
        }, 1000);
    }
}

// End the game
function endGame(winner) {
    gameState.gameOver = true;
    document.getElementById('winSound').play();
    
    // Update statistics
    gameState.stats.totalGames++;
    if (winner === 'player1') {
        gameState.stats.player1Wins++;
    } else {
        gameState.stats.player2Wins++;
    }
    
    updateStats();
    updateGameInfo();
}

// Restart the game
function restartGame() {
    if (gameState.online.isOnline && !gameState.online.isHost) {
        alert('Only the room host can restart the game');
        return;
    }
    
    resetGame();
    updatePlayerPositions();
    updateGameInfo();
    updateDiceFace(1);
    
    // Reset online room if applicable
    if (gameState.online.isOnline) {
        const room = onlineManager.getRoomState();
        if (room) {
            room.players.forEach(player => {
                player.position = 1;
            });
            room.currentPlayer = room.players[0].id;
            room.gameState = 'playing';
            room.diceValue = 1;
            onlineManager.saveToStorage();
        }
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const themeToggle = elements.themeToggle;
    themeToggle.textContent = document.body.classList.contains('dark-mode') ? 
        '☀️ Light Mode' : '🌙 Dark Mode';
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', initGame);