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
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

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
    
    // Load saved names
    const savedName1 = localStorage.getItem('snakesLaddersPlayer1');
    const savedName2 = localStorage.getItem('snakesLaddersPlayer2');
    if (savedName1) playerNames[0] = savedName1;
    if (savedName2) playerNames[1] = savedName2;
    
    updatePlayerDisplayNames();
}

// Show main menu
function showMainMenu() {
    onlineModal.classList.add('hidden');
    playerNamesModal.classList.add('hidden');
    resetGameUI();
    
    // Close any existing connections
    if (conn) {
        conn.close();
        conn = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    isOnlineGame = false;
    onlinePlayers.clear();
}

// Show online modal
function showOnlineModal() {
    onlineModal.classList.remove('hidden');
    initializeOnlineMultiplayer();
}

// Initialize online multiplayer with better error handling
function initializeOnlineMultiplayer() {
    connectionStatus.textContent = "Connecting to server...";
    connectionStatus.className = "connection-status";
    
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    
    try {
        // Initialize PeerJS with better configuration
        peer = new Peer({
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            myPlayerId = id;
            connectionStatus.textContent = "Connected to server! Your ID: " + id.substring(0, 8) + "...";
            connectionStatus.classList.add("connected");
            console.log("My peer ID is: " + id);
            
            createRoomBtn.disabled = false;
            joinRoomBtn.disabled = false;
            reconnectAttempts = 0;
        });

        peer.on('connection', (connection) => {
            if (conn) {
                console.log("Already have a connection, rejecting new one");
                connection.close();
                return;
            }
            conn = connection;
            setupConnection(connection);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            
            if (err.type === 'unavailable-id') {
                connectionStatus.textContent = "ID unavailable. Please try again.";
            } else if (err.type === 'network') {
                connectionStatus.textContent = "Network error. Check your connection.";
            } else if (err.type === 'peer-unavailable') {
                connectionStatus.textContent = "Peer unavailable. Check the Room ID.";
            } else {
                connectionStatus.textContent = "Connection error: " + err.message;
            }
            
            connectionStatus.classList.add("disconnected");
            createRoomBtn.disabled = true;
            joinRoomBtn.disabled = true;
            
            // Try to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(() => {
                    connectionStatus.textContent = `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
                    initializeOnlineMultiplayer();
                }, 2000);
            }
        });

        peer.on('disconnected', () => {
            console.log("Disconnected from signaling server");
            connectionStatus.textContent = "Disconnected. Trying to reconnect...";
            connectionStatus.classList.add("disconnected");
            
            // Try to reconnect to signaling server
            setTimeout(() => {
                peer.reconnect();
            }, 5000);
        });

        peer.on('close', () => {
            console.log("Peer connection closed");
            connectionStatus.textContent = "Connection closed";
            connectionStatus.classList.add("disconnected");
        });

    } catch (error) {
        console.error("Failed to initialize PeerJS:", error);
        connectionStatus.textContent = "Failed to initialize connection";
        connectionStatus.classList.add("disconnected");
    }
}

// Setup connection with better error handling
function setupConnection(connection) {
    conn = connection;
    
    conn.on('open', () => {
        console.log("Connected to peer: " + conn.peer);
        addOnlinePlayer(conn.peer, "Opponent");
        updateOnlineUI();
        
        // Send my player info
        sendData({
            type: 'playerInfo',
            playerId: myPlayerId,
            playerName: playerNames[0],
            isHost: isOnlineHost
        });
    });

    conn.on('data', (data) => {
        handleOnlineData(data);
    });

    conn.on('close', () => {
        console.log("Connection closed with peer: " + conn.peer);
        removeOnlinePlayer(conn.peer);
        updateOnlineUI();
        
        if (isOnlineGame) {
            onlineStatus.textContent = "Opponent disconnected";
            rollDiceBtn.disabled = true;
        }
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        onlineStatus.textContent = "Connection error with opponent";
    });
}

// Handle online data
function handleOnlineData(data) {
    console.log("Received data:", data);
    
    switch (data.type) {
        case 'playerInfo':
            addOnlinePlayer(data.playerId, data.playerName);
            playerNames[1] = data.playerName;
            updateOnlineUI();
            
            // If I'm the host and this is the first connection, start game automatically
            if (isOnlineHost && onlinePlayers.size === 1) {
                setTimeout(() => {
                    startOnlineGame();
                }, 1000);
            }
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
            
        case 'gameState':
            handleGameState(data);
            break;
            
        case 'chatMessage':
            showChatMessage(data);
            break;
            
        case 'ping':
            // Respond to ping
            sendData({ type: 'pong' });
            break;
    }
}

// Send data to opponent with error handling
function sendData(data) {
    if (conn && conn.open) {
        try {
            conn.send(data);
            return true;
        } catch (error) {
            console.error("Failed to send data:", error);
            return false;
        }
    } else {
        console.warn("No active connection to send data");
        return false;
    }
}

// Add online player
function addOnlinePlayer(playerId, playerName) {
    onlinePlayers.set(playerId, {
        name: playerName,
        connected: true,
        joinedAt: new Date()
    });
    connectionIndicator.classList.add('connected');
    onlineStatus.textContent = "Connected to opponent";
}

// Remove online player
function removeOnlinePlayer(playerId) {
    onlinePlayers.delete(playerId);
    if (onlinePlayers.size === 0) {
        connectionIndicator.classList.remove('connected');
        onlineStatus.textContent = "Waiting for opponent...";
    }
}

// Update online UI
function updateOnlineUI() {
    const playerCountValue = onlinePlayers.size + 1; // +1 for myself
    playerCount.textContent = `${playerCountValue}/2`;
    
    // Update players list
    playersList.innerHTML = '';
    playersList.innerHTML += `<div class="player-item">You (${playerNames[0]}) ${isOnlineHost ? '(Host)' : ''}</div>`;
    onlinePlayers.forEach((player, id) => {
        playersList.innerHTML += `<div class="player-item">${player.name} (Connected)</div>`;
    });
    
    // Show start button if host and at least 1 other player
    if (isOnlineHost && playerCountValue >= 2) {
        startOnlineGameBtn.classList.remove('hidden');
    } else {
        startOnlineGameBtn.classList.add('hidden');
    }
}

// Create room
function createRoom() {
    if (!peer || !peer.id) {
        alert("Not connected to server yet. Please wait.");
        return;
    }
    
    roomId = generateRoomId();
    isOnlineHost = true;
    currentRoomId.textContent = roomId;
    roomInfo.classList.remove('hidden');
    updateOnlineUI();
    
    connectionStatus.textContent = `Room created! ID: ${roomId}. Share this with your friend.`;
}

// Join room
function joinRoom() {
    const joinId = roomIdInput.value.trim();
    if (!joinId) {
        alert("Please enter a room ID");
        return;
    }
    
    if (!peer || !peer.id) {
        alert("Not connected to server yet. Please wait.");
        return;
    }
    
    roomId = joinId;
    isOnlineHost = false;
    
    // Close existing connection if any
    if (conn) {
        conn.close();
        conn = null;
    }
    
    connectionStatus.textContent = `Connecting to room ${joinId}...`;
    
    try {
        conn = peer.connect(joinId, {
            reliable: true,
            serialization: 'json'
        });
        
        if (!conn) {
            throw new Error("Failed to create connection");
        }
        
        setupConnection(conn);
        
        currentRoomId.textContent = roomId;
        roomInfo.classList.remove('hidden');
        
    } catch (error) {
        console.error("Failed to connect to room:", error);
        connectionStatus.textContent = "Failed to connect to room. Check the ID and try again.";
        connectionStatus.classList.add("disconnected");
    }
}

// Generate room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Start online game
function startOnlineGame(data = null) {
    if (data) {
        // We are the client receiving game start
        playerNames[1] = data.opponentName || "Opponent";
        isMyTurn = data.isMyTurn !== undefined ? data.isMyTurn : false;
    } else {
        // We are the host starting the game
        const opponent = Array.from(onlinePlayers.values())[0];
        sendData({
            type: 'gameStart',
            opponentName: playerNames[0],
            isMyTurn: false
        });
        isMyTurn = true;
    }
    
    isOnlineGame = true;
    onlineModal.classList.add('hidden');
    startGameWithNames();
    updateOnlineGameUI();
    
    // Send initial game state if host
    if (isOnlineHost) {
        sendData({
            type: 'gameState',
            playerPositions: playerPositions,
            currentPlayer: currentPlayer,
            gameOver: gameOver
        });
    }
}

// Start game with names
function startGameWithNames() {
    updatePlayerDisplayNames();
    updatePlayerDisplay();
    rollDiceBtn.classList.remove('hidden');
    onlineStatus.classList.remove('hidden');
    
    if (isOnlineGame) {
        if (isMyTurn) {
            onlineStatus.textContent = "Your turn! Roll the dice.";
            rollDiceBtn.disabled = false;
        } else {
            onlineStatus.textContent = "Opponent's turn... Waiting...";
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
        document.getElementById('player2').classList.add('hidden');
        aiPlayerElement.classList.add('hidden');
    }
}

// Handle opponent dice roll
function handleOpponentDiceRoll(data) {
    diceResult.textContent = `Opponent rolled: ${data.value}`;
    showMessage(`Opponent rolled: ${data.value}`);
    
    setTimeout(() => {
        movePlayer(data.value, true);
    }, 1500);
}

// Handle opponent move
function handleOpponentMove(data) {
    playerPositions[1] = data.position;
    updatePlayerPositions();
    
    if (data.landedOnSnake) {
        showMessage(`Opponent landed on a snake!`);
    } else if (data.climbedLadder) {
        showMessage(`Opponent climbed a ladder!`);
    }
    
    if (!data.gameOver) {
        isMyTurn = true;
        onlineStatus.textContent = "Your turn! Roll the dice.";
        rollDiceBtn.disabled = false;
        currentPlayer = 0;
        updatePlayerDisplay();
    } else {
        gameOver = true;
        declareWinnerOnline(data.winner);
    }
}

// Handle game state sync
function handleGameState(data) {
    playerPositions = data.playerPositions || [0, 0];
    currentPlayer = data.currentPlayer || 0;
    gameOver = data.gameOver || false;
    
    updatePlayerPositions();
    updatePlayerDisplay();
    
    if (gameOver) {
        declareWinnerOnline("Opponent");
    }
}

// Show chat message (placeholder for future feature)
function showChatMessage(data) {
    // Could be implemented for chat functionality
    console.log(`Chat from ${data.player}: ${data.message}`);
}

// Copy room ID
function copyRoomIdToClipboard() {
    if (!roomId) {
        alert("No room ID to copy");
        return;
    }
    
    navigator.clipboard.writeText(roomId).then(() => {
        alert("Room ID copied to clipboard! Share it with your friend.");
    }).catch(err => {
        // Fallback for older browsers
        roomIdInput.select();
        document.execCommand('copy');
        alert("Room ID copied to clipboard!");
    });
}

// Create the game board
function createBoard() {
    gameBoard.innerHTML = '';
    
    // Create board in zigzag pattern (snakes and ladders style)
    for (let row = 9; row >= 0; row--) {
        const isReverse = row % 2 === 1; // Even rows go left to right, odd rows go right to left
        
        for (let col = 0; col < 10; col++) {
            const cellNumber = isReverse ? (row * 10 + col + 1) : (row * 10 + (9 - col) + 1);
            
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${cellNumber}`;
            cell.dataset.number = cellNumber;
            
            // Add cell number
            const cellNumberElement = document.createElement('div');
            cellNumberElement.className = 'cell-number';
            cellNumberElement.textContent = cellNumber;
            cell.appendChild(cellNumberElement);
            
            // Check if cell has a snake or ladder
            if (snakes[cellNumber]) {
                cell.classList.add('snake');
                const snakeInfo = document.createElement('div');
                snakeInfo.className = 'cell-special';
                snakeInfo.textContent = `🐍→${snakes[cellNumber]}`;
                snakeInfo.style.fontSize = '0.6rem';
                cell.appendChild(snakeInfo);
            } else if (ladders[cellNumber]) {
                cell.classList.add('ladder');
                const ladderInfo = document.createElement('div');
                ladderInfo.className = 'cell-special';
                ladderInfo.textContent = `🪜→${ladders[cellNumber]}`;
                ladderInfo.style.fontSize = '0.6rem';
                cell.appendChild(ladderInfo);
            }
            
            // Add player markers container
            const markersContainer = document.createElement('div');
            markersContainer.className = 'markers-container';
            cell.appendChild(markersContainer);
            
            gameBoard.appendChild(cell);
        }
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
    
    // Enter key for room ID input
    roomIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinRoom();
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
        document.getElementById('player2').classList.remove('hidden');
    } else {
        aiPlayerElement.style.display = 'none';
        player2Display.textContent = playerNames[1];
        document.getElementById('pieceAI').id = 'piece2';
        playerPieces[1] = document.getElementById('piece2');
        onlinePlayerElement.classList.add('hidden');
        document.getElementById('player2').classList.remove('hidden');
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
        const player2Name = prompt("Enter Player 2 name:", playerNames[1]) || 'Player 2';
        playerNames[1] = player2Name;
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
                    winner: playerNames[0],
                    landedOnSnake: false,
                    climbedLadder: false
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
                gameOver: false,
                landedOnSnake: landedOnSnake,
                climbedLadder: climbedLadder
            });
            
            isMyTurn = false;
            onlineStatus.textContent = "Opponent's turn... Waiting...";
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
            if (cell) {
                const markersContainer = cell.querySelector('.markers-container');
                if (markersContainer) {
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
    }
}

// Update player display
function updatePlayerDisplay() {
    currentPlayerDisplay.textContent = `Current: ${getPlayerName(currentPlayer)}`;
    
    playerPieces.forEach((piece, index) => {
        if (piece) {
            if (index === currentPlayer) {
                piece.style.transform = 'scale(1.2)';
                piece.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
            } else {
                piece.style.transform = 'scale(1)';
                piece.style.boxShadow = 'none';
            }
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
    if (winnerCell) {
        winnerCell.classList.add('winner');
    }
    
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
    if (winnerCell) {
        winnerCell.classList.add('winner');
    }
    
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
    messageDiv.style.textAlign = 'center';
    messageDiv.style.maxWidth = '80%';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (document.body.contains(messageDiv)) {
            document.body.removeChild(messageDiv);
        }
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
        onlineStatus.textContent = isMyTurn ? "Your turn! Roll the dice." : "Opponent's turn... Waiting...";
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

// Handle page visibility change for better connection management
document.addEventListener('visibilitychange', function() {
    if (document.hidden && isOnlineGame) {
        // Page is hidden, maybe send a ping to keep connection alive
        if (conn && conn.open) {
            sendData({ type: 'ping' });
        }
    }
});