const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

// Load sounds
const sounds = {
    move: new Audio("/sounds/move.mp3"),
    capture: new Audio("/sounds/capture.mp3"),
    check: new Audio("/sounds/check.mp3"),
    gameover: new Audio("/sounds/gameover.mp3")
};

const getSquareName = (row, col) => `${String.fromCharCode(97 + col)}${8 - row}`;

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
    };
    return unicodePieces[piece.type] || "";
};

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
            );
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;

            squareElement.addEventListener("mouseenter", () => {
                squareElement.classList.add("highlight");
            });

            squareElement.addEventListener("mouseleave", () => {
                squareElement.classList.remove("highlight");
            });

            if (square) {
                const pieceElement = document.createElement("span");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                // Mouse drag
                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                // Touch drag
                pieceElement.addEventListener("touchstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        e.preventDefault(); // Prevent scroll
                    }
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => e.preventDefault());

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            squareElement.addEventListener("touchend", (e) => {
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                    draggedPiece = null;
                    sourceSquare = null;
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }

    const turnDisplay = document.getElementById("turnDisplay");
    if (turnDisplay) {
        turnDisplay.textContent = `Turn: ${chess.turn() === 'w' ? 'White' : 'Black'}`;
    }
};

const handleMove = (source, target) => {
    const move = {
        from: getSquareName(source.row, source.col),
        to: getSquareName(target.row, target.col),
        promotion: "q"
    };

    socket.emit("move", move);
};

function showGameOverScreen() {
    const modal = document.getElementById("gameOverModal");
    const text = document.getElementById("gameOverText");

    if (chess.in_checkmate()) {
        text.textContent = `Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} wins!`;
    } else if (chess.in_stalemate()) {
        text.textContent = "Stalemate!";
    } else if (chess.insufficient_material()) {
        text.textContent = "Draw by insufficient material.";
    } else if (chess.in_threefold_repetition()) {
        text.textContent = "Draw by repetition.";
    } else if (chess.in_draw()) {
        text.textContent = "Draw!";
    } else {
        text.textContent = "Game Over";
    }

    sounds.gameover.play();
    modal.classList.remove("hidden");
}

// Socket events
socket.on("playerRole", function(role) {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole", function() {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", function(fen) {
    const prevFen = chess.fen();
    chess.load(fen);
    renderBoard();

    const lastMove = chess.history({ verbose: true }).at(-1);
    if (!lastMove) return;

    if (lastMove.captured) {
        sounds.capture.play();
    } else if (chess.in_check()) {
        sounds.check.play();
    } else if (chess.game_over()) {
        sounds.gameover.play();
    } else {
        sounds.move.play();
    }

    if (chess.game_over()) {
        showGameOverScreen();
    }
});

socket.on("move", function(move) {
    chess.move(move);
    renderBoard();
});
