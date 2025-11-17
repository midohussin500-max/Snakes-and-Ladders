// Game configuration
const BOARD_SIZE = 100;
const PLAYERS = 2;

// Define snakes and ladders
const snakes = {
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
};

const ladders = {
    1: 38,
    4: 14,
    9: 31,
    21: 42,
    28: 84,
    36: 44,
    51: 67,
    71: 91,
    80: 100
};

// Game state
let currentPlayer = 0;
let playerPositions = [0, 0];
let gameOver = false;
let gameMode = 'twoPlayers';
let aiDifficulty = 'medium';
let isAITurn = false;
let playerNames = ['Player 1', 'Player 2'];
let myPlayerId = null;
let isOnlineHost = false;

// Online multiplayer state
let peer = null;
let conn = null;
let roomId = null;
let onlinePlayers = new Map();
let isOnlineGame = false;
let isMyTurn = false;

// DOM elements
const gameBoard = document.getElementById('gameBoard');
const rollDiceBtn = document.getElementById('rollDice');
const diceResult = document.getElementById('diceResult');
const currentPlayerDisplay = document.getElementById('currentPlayer');
const playerPieces = [document.getElementById('piece1'), document.getElementById('piece2')];
const aiPlayerElement = document.getElementById('aiPlayer');
const onlinePlayerElement = document.getElementById('onlinePlayer');
const gameModeSelect = document.getElementById('gameMode');
const aiDifficultySelect = document.getElementById('aiDifficulty');
const themeToggle = document.getElementById('themeToggle');
const playerNamesModal = document.getElementById('playerNamesModal');
const onlineModal = document.getElementById('onlineModal');
const playerNameInput = document.getElementById('playerName');
const startGameBtn = document.getElementById('startGame');
const changeNamesBtn = document.getElementById('changeNames');
const player1Display = document.getElementById('player1Display');
const player2Display = document.getElementById('player2Display');
const onlinePlayerDisplay = document.getElementById('onlinePlayerDisplay');
const connectionIndicator = document.getElementById('connectionIndicator');
const onlineStatus = document.getElementById('onlineStatus');

// Online elements
const connectionStatus = document.getElementById('connectionStatus');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const roomIdInput = document.getElementById('roomId');
const roomInfo = document.getElementById('roomInfo');
const currentRoomId = document.getElementById('currentRoomId');
const playerCount = document.getElementById('playerCount');
const playersList = document.getElementById('playersList');
const startOnlineGameBtn = document.getElementById('startOnlineGame');
const copyRoomIdBtn = document.getElementById('copyRoomId');
const backToMainBtn = document.getElementById('backToMain');

// Initialize the game
function initGame() {
    createBoard();
    setupEventListeners();
    checkThemePreference();
    showMainMenu();
}

// Show main menu
function showMainMenu() {
    onlineModal.classList.add('hidden');
    playerNamesModal.classList.add('hidden');
    resetGameUI();
}

// Show online modal
function showOnlineModal() {
    onlineModal.classList.remove('hidden');
    initializeOnlineMultiplayer();
}

// Initialize online multiplayer
function initializeOnlineMultiplayer() {
    connectionStatus.textContent = "Connecting to server...";
    connectionStatus.className = "connection-status";
    
    // Initialize PeerJS
    peer = new Peer({
        debug: 3,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        myPlayerId = id;
        connectionStatus.textContent = "Connected to server!";
        connectionStatus.classList.add("connected");
        console.log("My peer ID is: " + id);
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection(connection);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        connectionStatus.textContent = "Connection failed. Please refresh.";
        connectionStatus.classList.add("disconnected");
    });

    peer.on('disconnected', () => {
        connectionStatus.textContent = "Disconnected from server";
        connectionStatus.classList.add("disconnected");
    });
}

// Setup connection
function setupConnection(connection) {
    conn = connection;
    
    conn.on('open', () => {
        console.log("Connected to: " + conn.peer);
        addOnlinePlayer(conn.peer, "Opponent");
        updateOnlineUI();
        
        // Send my player info
        sendData({
            type: 'playerInfo',
            playerId: myPlayerId,
            playerName: playerNames[0]
        });
    });

    conn.on('data', (data) => {
        handleOnlineData(data);
    });

    conn.on('close', () => {
        console.log("Connection closed");
        removeOnlinePlayer(conn.peer);
        updateOnlineUI();
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
    });
}

// Handle online data
function handleOnlineData(data) {
    console.log("Received data:", data);
    
    switch (data.type) {
        case 'playerInfo':
            addOnlinePlayer(data.playerId, data.playerName);
            updateOnlineUI();
            break;
            
        case 'gameStart':
            startOnlineGame(data);
            break;
            
        case 'diceRoll':
            handleOpponentDiceRoll(data);
            break;
            
        case 'playerMove':
            handleOpponentMove(data);
            break;
            
        case 'chatMessage':
            showChatMessage(data);
            break;
    }
}

// Send data to opponent
function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

// Add online player
function addOnlinePlayer(playerId, playerName) {
    onlinePlayers.set(playerId, {
        name: playerName,
        connected: true
    });
    connectionIndicator.classList.add('connected');
    onlineStatus.textContent = "Connected to opponent";
}

// Remove online player
function removeOnlinePlayer(playerId) {
    onlinePlayers.delete(playerId);
    connectionIndicator.classList.remove('connected');
    onlineStatus.textContent = "Opponent disconnected";
}

// Update online UI
function updateOnlineUI() {
    const playerCountValue = onlinePlayers.size + 1; // +1 for myself
    playerCount.textContent = `${playerCountValue}/2`;
    
    // Update players list
    playersList.innerHTML = '';
    playersList.innerHTML += `<div class="player-item">You (${playerNames[0]})</div>`;
    onlinePlayers.forEach((player, id) => {
        playersList.innerHTML += `<div class="player-item">${player.name}</div>`;
    });
    
    // Show start button if host and 2 players
    if (isOnlineHost && playerCountValue === 2) {
        startOnlineGameBtn.classList.remove('hidden');
    } else {
        startOnlineGameBtn.classList.add('hidden');
    }
}

// Create room
function createRoom() {
    roomId = generateRoomId();
    isOnlineHost = true;
    currentRoomId.textContent = roomId;
    roomInfo.classList.remove('hidden');
    updateOnlineUI();
}

// Join room
function joinRoom() {
    const joinId = roomIdInput.value.trim();
    if (!joinId) {
        alert("Please enter a room ID");
        return;
    }
    
    roomId = joinId;
    isOnlineHost = false;
    
    // Connect to the host
    conn = peer.connect(joinId);
    setupConnection(conn);
    
    currentRoomId.textContent = roomId;
    roomInfo.classList.remove('hidden');
}

// Generate room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Start online game
function startOnlineGame(data = null) {
    if (data) {
        // We are the client receiving game start
        playerNames[1] = data.opponentName;
        isMyTurn = false;
    } else {
        // We are the host starting the game
        const opponent = Array.from(onlinePlayers.values())[0];
        sendData({
            type: 'gameStart',
            opponentName: playerNames[0]
        });
        isMyTurn = true;
    }
    
    isOnlineGame = true;
    onlineModal.classList.add('hidden');
    startGameWithNames();
    updateOnlineGameUI();
}

// Start game with names
function startGameWithNames() {
    updatePlayerDisplayNames();
    updatePlayerDisplay();
    rollDiceBtn.classList.remove('hidden');
    onlineStatus.classList.remove('hidden');
    
    if (isOnlineGame) {
        if (isMyTurn) {
            onlineStatus.textContent = "Your turn!";
            rollDiceBtn.disabled = false;
        } else {
            onlineStatus.textContent = "Opponent's turn...";
            rollDiceBtn.disabled = true;
        }
    }
}

// Update online game UI
function updateOnlineGameUI() {
    if (isOnlineGame) {
        player1Display.textContent = playerNames[0];
        onlinePlayerDisplay.textContent = playerNames[1];
        onlinePlayerElement.classList.remove('hidden');
        player2Display.parentElement.classList.add('hidden');
        aiPlayerElement.classList.add('hidden');
    }
}

// Handle opponent dice roll
function handleOpponentDiceRoll(data) {
    diceResult.textContent = `Dice: ${data.value}`;
    setTimeout(() => {
        movePlayer(data.value, true);
    }, 1000);
}

// Handle opponent move
function handleOpponentMove(data) {
    playerPositions[1] = data.position;
    updatePlayerPositions();
    
    if (!data.gameOver) {
        isMyTurn = true;
        onlineStatus.textContent = "Your turn!";
        rollDiceBtn.disabled = false;
        currentPlayer = 0;
        updatePlayerDisplay();
    } else {
        gameOver = true;
        declareWinnerOnline(data.winner);
    }
}

// Show chat message (placeholder for future feature)
function showChatMessage(data) {
    // Could be implemented for chat functionality
    console.log(`Chat from ${data.player}: ${data.message}`);
}

// Copy room ID
function copyRoomIdToClipboard() {
    navigator.clipboard.writeText(roomId).then(() => {
        alert("Room ID copied to clipboard!");
    });
}

// Create the game board
function createBoard() {
    gameBoard.innerHTML = '';
    
    for (let i = BOARD_SIZE; i > 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${i}`;
        
        // Add cell number
        const cellNumber = document.createElement('div');
        cellNumber.className = 'cell-number';
        cellNumber.textContent = i;
        cell.appendChild(cellNumber);
        
        // Check if cell has a snake or ladder
        if (snakes[i]) {
            cell.classList.add('snake');
        } else if (ladders[i]) {
            cell.classList.add('ladder');
        }
        
        // Add player markers container
        const markersContainer = document.createElement('div');
        markersContainer.className = 'markers-container';
        cell.appendChild(markersContainer);
        
        gameBoard.appendChild(cell);
    }
    
    updatePlayerPositions();
}

// Set up event listeners
function setupEventListeners() {
    rollDiceBtn.addEventListener('click', rollDice);
    gameModeSelect.addEventListener('change', handleGameModeChange);
    aiDifficultySelect.addEventListener('change', handleAIDifficultyChange);
    themeToggle.addEventListener('click', toggleTheme);
    startGameBtn.addEventListener('click', startLocalGame);
    changeNamesBtn.addEventListener('click', changePlayerNames);
    
    // Online event listeners
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    startOnlineGameBtn.addEventListener('click', startOnlineGame);
    copyRoomIdBtn.addEventListener('click', copyRoomIdToClipboard);
    backToMainBtn.addEventListener('click', showMainMenu);
    
    // Enter key for name input
    playerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            startLocalGame();
        }
    });
}

// Handle game mode change
function handleGameModeChange() {
    gameMode = gameModeSelect.value;
    
    if (gameMode === 'online') {
        showOnlineModal();
        return;
    }
    
    resetGameUI();
    
    if (gameMode === 'vsAI') {
        aiPlayerElement.style.display = 'flex';
        player2Display.textContent = 'AI';
        document.getElementById('piece2').id = 'pieceAI';
        playerPieces[1] = document.getElementById('pieceAI');
        onlinePlayerElement.classList.add('hidden');
    } else {
        aiPlayerElement.style.display = 'none';
        player2Display.textContent = playerNames[1];
        document.getElementById('pieceAI').id = 'piece2';
        playerPieces[1] = document.getElementById('piece2');
        onlinePlayerElement.classList.add('hidden');
    }
    
    isOnlineGame = false;
    resetGame();
}

// Handle AI difficulty change
function handleAIDifficultyChange() {
    aiDifficulty = aiDifficultySelect.value;
}

// Start local game
function startLocalGame() {
    const name = playerNameInput.value.trim() || 'Player 1';
    playerNames[0] = name;
    
    if (gameMode === 'twoPlayers') {
        playerNames[1] = playerNames[1] || 'Player 2';
    }
    
    localStorage.setItem('snakesLaddersPlayer1', playerNames[0]);
    if (gameMode === 'twoPlayers') {
        localStorage.setItem('snakesLaddersPlayer2', playerNames[1]);
    }
    
    playerNamesModal.classList.add('hidden');
    updatePlayerDisplayNames();
    updatePlayerDisplay();
    rollDiceBtn.classList.remove('hidden');
}

// Roll the dice
function rollDice() {
    if (gameOver || isAITurn || (isOnlineGame && !isMyTurn)) return;
    
    rollDiceBtn.disabled = true;
    
    let rollCount = 0;
    const maxRolls = 10;
    const rollInterval = setInterval(() => {
        const randomValue = Math.floor(Math.random() * 6) + 1;
        diceResult.textContent = `Dice: ${randomValue}`;
        rollCount++;
        
        if (rollCount >= maxRolls) {
            clearInterval(rollInterval);
            const finalValue = Math.floor(Math.random() * 6) + 1;
            diceResult.textContent = `Dice: ${finalValue}`;
            
            if (isOnlineGame) {
                // Send dice result to opponent
                sendData({
                    type: 'diceRoll',
                    value: finalValue
                });
                movePlayer(finalValue, false);
            } else {
                movePlayer(finalValue, false);
                
                if (!gameOver && gameMode === 'vsAI' && currentPlayer === 1) {
                    isAITurn = true;
                    setTimeout(aiPlay, 1000);
                } else {
                    rollDiceBtn.disabled = false;
                }
            }
        }
    }, 100);
}

// AI player logic
function aiPlay() {
    if (gameOver) return;
    
    let diceValue;
    
    switch (aiDifficulty) {
        case 'easy':
            diceValue = Math.floor(Math.random() * 6) + 1;
            break;
        case 'medium':
            if (Math.random() < 0.7) {
                diceValue = strategicAIMove();
            } else {
                diceValue = Math.floor(Math.random() * 6) + 1;
            }
            break;
        case 'hard':
            if (Math.random() < 0.9) {
                diceValue = strategicAIMove();
            } else {
                diceValue = Math.floor(Math.random() * 6) + 1;
            }
            break;
        default:
            diceValue = Math.floor(Math.random() * 6) + 1;
    }
    
    diceResult.textContent = `Dice: ${diceValue}`;
    
    setTimeout(() => {
        movePlayer(diceValue, false);
        isAITurn = false;
        
        if (!gameOver) {
            rollDiceBtn.disabled = false;
        }
    }, 1000);
}

// Strategic AI move calculation
function strategicAIMove() {
    const currentPosition = playerPositions[1];
    let bestMove = 1;
    
    for (let dice = 1; dice <= 6; dice++) {
        const newPosition = currentPosition + dice;
        
        if (newPosition === BOARD_SIZE) {
            return dice;
        }
        
        if (ladders[newPosition]) {
            const ladderEnd = ladders[newPosition];
            if (ladderEnd > currentPosition + bestMove) {
                bestMove = dice;
            }
        }
        
        if (snakes[newPosition]) {
            const snakeEnd = snakes[newPosition];
            if (snakeEnd < currentPosition && bestMove === 1) {
                bestMove = dice;
            }
            continue;
        }
        
        for (let ladderStart in ladders) {
            if (newPosition <= ladderStart && newPosition + 6 >= ladderStart) {
                if (dice > bestMove) {
                    bestMove = dice;
                }
            }
        }
        
        for (let snakeStart in snakes) {
            if (newPosition >= snakeStart - 6 && newPosition < snakeStart) {
                if (dice > bestMove) {
                    bestMove = dice;
                }
            }
        }
    }
    
    return bestMove;
}

// Move the player
function movePlayer(steps, isOpponent = false) {
    const playerIndex = isOpponent ? 1 : currentPlayer;
    const currentPosition = playerPositions[playerIndex];
    let newPosition = currentPosition + steps;
    let landedOnSnake = false;
    let climbedLadder = false;
    
    if (newPosition >= BOARD_SIZE) {
        newPosition = BOARD_SIZE;
        gameOver = true;
        
        if (isOnlineGame) {
            if (!isOpponent) {
                sendData({
                    type: 'playerMove',
                    position: newPosition,
                    gameOver: true,
                    winner: playerNames[0]
                });
            }
            declareWinnerOnline(isOpponent ? playerNames[1] : playerNames[0]);
        } else {
            declareWinner();
        }
    } else {
        if (snakes[newPosition]) {
            newPosition = snakes[newPosition];
            landedOnSnake = true;
            showMessage(`Oh no! ${getPlayerName(playerIndex)} landed on a snake!`);
        } else if (ladders[newPosition]) {
            newPosition = ladders[newPosition];
            climbedLadder = true;
            showMessage(`Great! ${getPlayerName(playerIndex)} climbed a ladder!`);
        }
        
        playerPositions[playerIndex] = newPosition;
        updatePlayerPositions();
        
        if (isOnlineGame && !isOpponent && !gameOver) {
            // Send move to opponent
            sendData({
                type: 'playerMove',
                position: newPosition,
                gameOver: false
            });
            
            isMyTurn = false;
            onlineStatus.textContent = "Opponent's turn...";
            rollDiceBtn.disabled = true;
            currentPlayer = 1;
        } else if (!gameOver && !isOnlineGame) {
            currentPlayer = (currentPlayer + 1) % PLAYERS;
            updatePlayerDisplay();
        }
    }
}

// Get player name for display
function getPlayerName(playerIndex) {
    if (gameMode === 'vsAI' && playerIndex === 1) {
        return 'AI';
    }
    if (isOnlineGame && playerIndex === 1) {
        return playerNames[1];
    }
    return playerNames[playerIndex];
}

// Update player positions on the board
function updatePlayerPositions() {
    document.querySelectorAll('.player-marker').forEach(marker => marker.remove());
    
    for (let i = 0; i < PLAYERS; i++) {
        const position = playerPositions[i];
        if (position > 0) {
            const cell = document.getElementById(`cell-${position}`);
            const markersContainer = cell.querySelector('.markers-container');
            
            const marker = document.createElement('div');
            if (isOnlineGame) {
                marker.className = i === 0 ? 'player-marker player1-marker' : 'player-marker online-marker';
            } else if (gameMode === 'vsAI' && i === 1) {
                marker.className = 'player-marker ai-marker';
            } else {
                marker.className = `player-marker player${i+1}-marker`;
            }
            markersContainer.appendChild(marker);
        }
    }
}

// Update player display
function updatePlayerDisplay() {
    currentPlayerDisplay.textContent = `Current: ${getPlayerName(currentPlayer)}`;
    
    playerPieces.forEach((piece, index) => {
        if (index === currentPlayer) {
            piece.style.transform = 'scale(1.2)';
            piece.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
        } else {
            piece.style.transform = 'scale(1)';
            piece.style.boxShadow = 'none';
        }
    });
}

// Update player display names
function updatePlayerDisplayNames() {
    player1Display.textContent = playerNames[0];
    
    if (isOnlineGame) {
        onlinePlayerDisplay.textContent = playerNames[1];
    } else if (gameMode === 'vsAI') {
        player2Display.textContent = 'AI';
    } else {
        player2Display.textContent = playerNames[1];
    }
}

// Declare winner for online game
function declareWinnerOnline(winnerName) {
    const winnerCell = document.getElementById(`cell-${BOARD_SIZE}`);
    winnerCell.classList.add('winner');
    
    setTimeout(() => {
        alert(`${winnerName} wins the game!`);
        resetGame();
        
        if (isOnlineGame) {
            onlineStatus.textContent = "Game finished";
            rollDiceBtn.disabled = true;
        }
    }, 500);
}

// Declare winner for local game
function declareWinner() {
    const winnerCell = document.getElementById(`cell-${BOARD_SIZE}`);
    winnerCell.classList.add('winner');
    
    setTimeout(() => {
        alert(`${getPlayerName(currentPlayer)} wins the game!`);
        resetGame();
    }, 500);
}

// Show message
function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '50%';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translate(-50%, -50%)';
    messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    messageDiv.style.color = 'white';
    messageDiv.style.padding = '10px 20px';
    messageDiv.style.borderRadius = '5px';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.fontWeight = 'bold';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        document.body.removeChild(messageDiv);
    }, 2000);
}

// Change player names
function changePlayerNames() {
    if (isOnlineGame) {
        alert("Cannot change names during online game");
        return;
    }
    
    playerNameInput.value = playerNames[0];
    playerNamesModal.classList.remove('hidden');
}

// Reset game
function resetGame() {
    currentPlayer = 0;
    playerPositions = [0, 0];
    gameOver = false;
    isAITurn = false;
    
    if (isOnlineGame) {
        isMyTurn = isOnlineHost;
        onlineStatus.textContent = isMyTurn ? "Your turn!" : "Opponent's turn...";
        rollDiceBtn.disabled = !isMyTurn;
    } else {
        rollDiceBtn.disabled = false;
    }
    
    diceResult.textContent = 'Dice: -';
    updatePlayerDisplay();
    updatePlayerPositions();
    
    const winnerCell = document.getElementById(`cell-${BOARD_SIZE}`);
    if (winnerCell) {
        winnerCell.classList.remove('winner');
    }
}

// Reset game UI
function resetGameUI() {
    rollDiceBtn.classList.add('hidden');
    onlineStatus.classList.add('hidden');
    playerNamesModal.classList.add('hidden');
    resetGame();
}

// Theme toggle functionality
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('snakesLaddersTheme', isDarkMode ? 'dark' : 'light');
}

// Check for saved theme preference
function checkThemePreference() {
    const savedTheme = localStorage.getItem('snakesLaddersTheme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️ Light Mode';
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', initGame);