import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store active rooms and players
const rooms = {};

// Keep track of player names by socket ID
const playerNames = {};

// Debug function to log room state
function logRoomState(roomId) {
  if (!rooms[roomId]) {
    console.log(`Room ${roomId} does not exist`);
    return;
  }

  console.log(`\nRoom ${roomId} state:`);
  console.log(`- Host: ${rooms[roomId].host}`);
  console.log(`- Active: ${rooms[roomId].active}`);
  console.log(`- Players (${rooms[roomId].players.length}):`);
  rooms[roomId].players.forEach((p) =>
    console.log(`  - ${p.id}: ${p.name} (Score: ${p.score})`)
  );
  console.log(
    `- Disconnected Players: ${
      Object.keys(rooms[roomId].disconnectedPlayers).length
    }`
  );
  Object.entries(rooms[roomId].disconnectedPlayers).forEach(([id, data]) => {
    console.log(`  - ${id}: ${data.name} (Score: ${data.score})`);
  });
  console.log("\n");
}

// Fetch a question from the Open Trivia Database
async function fetchQuestion() {
  try {
    const response = await fetch(
      "https://opentdb.com/api.php?amount=1&type=multiple"
    );
    const data = await response.json();

    if (data.response_code === 0 && data.results.length > 0) {
      const question = data.results[0];

      // Shuffle answers
      const allAnswers = [
        question.correct_answer,
        ...question.incorrect_answers,
      ];
      const shuffledAnswers = shuffleArray(allAnswers);

      return { question, answers: shuffledAnswers };
    }

    throw new Error("Failed to fetch question");
  } catch (error) {
    console.error("Error fetching question:", error);
    throw error;
  }
}

// Shuffle array helper
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create a new room
  socket.on("create_room", ({ roomId, playerName }) => {
    console.log(
      `Attempting to create room: ${roomId} by ${playerName} (${socket.id})`
    );

    if (rooms[roomId]) {
      console.log(`Room ${roomId} already exists`);
      socket.emit("error", "Room already exists");
      return;
    }

    // Store player name
    playerNames[socket.id] = playerName;

    // Create room
    rooms[roomId] = {
      host: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      active: false,
      currentQuestion: null,
      answers: {},
      timer: null,
      // Add a grace period for reconnections
      disconnectedPlayers: {},
      lastActivity: Date.now(),
    };

    // Join socket room
    socket.join(roomId);
    socket.emit("room_created");
    io.to(roomId).emit("players_update", rooms[roomId].players);

    console.log(`Room created: ${roomId} by ${playerName} (${socket.id})`);
    logRoomState(roomId);
  });

  // Join an existing room
  socket.on("join_room", ({ roomId, playerName }) => {
    console.log(
      `Attempting to join room: ${roomId} by ${playerName} (${socket.id})`
    );

    if (!rooms[roomId]) {
      console.log(`Room ${roomId} does not exist`);
      socket.emit("error", "Room does not exist");
      return;
    }

    if (rooms[roomId].active) {
      console.log(`Room ${roomId} is already active`);
      socket.emit("error", "Game already in progress");
      return;
    }

    // Check if player is already in the room (prevent duplicates)
    const existingPlayer = rooms[roomId].players.find(
      (p) => p.name === playerName
    );
    if (existingPlayer) {
      console.log(`Player ${playerName} is already in room ${roomId}`);
      socket.emit("error", "A player with this name is already in the room");
      return;
    }

    // Check if this player was previously disconnected
    const disconnectedPlayerId = Object.keys(
      rooms[roomId].disconnectedPlayers
    ).find((id) => rooms[roomId].disconnectedPlayers[id].name === playerName);

    if (disconnectedPlayerId) {
      // Player is reconnecting
      const oldId = disconnectedPlayerId;
      const playerData = rooms[roomId].disconnectedPlayers[oldId];

      console.log(
        `Player ${playerName} is reconnecting (old ID: ${oldId}, new ID: ${socket.id})`
      );

      // Update the player's ID
      const playerIndex = rooms[roomId].players.findIndex(
        (p) => p.id === oldId
      );
      if (playerIndex !== -1) {
        rooms[roomId].players[playerIndex].id = socket.id;
      } else {
        // Add player back to the room
        rooms[roomId].players.push({
          id: socket.id,
          name: playerName,
          score: playerData.score || 0,
        });
      }

      // Remove from disconnected players
      delete rooms[roomId].disconnectedPlayers[oldId];
    } else {
      // Store player name
      playerNames[socket.id] = playerName;

      // Add player to room
      rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });
      console.log(
        `Added new player ${playerName} (${socket.id}) to room ${roomId}`
      );
    }

    // Join socket room
    socket.join(roomId);
    io.to(roomId).emit("players_update", rooms[roomId].players);

    console.log(`${playerName} joined room: ${roomId}`);
    logRoomState(roomId);
  });

  // Start the game
  socket.on("start_game", async ({ roomId }) => {
    if (!rooms[roomId]) return;

    // Check if user is the host
    if (rooms[roomId].host !== socket.id) {
      socket.emit("error", "Only the host can start the game");
      return;
    }

    rooms[roomId].active = true;
    io.to(roomId).emit("game_started");

    // Start first question
    await nextQuestion(roomId);
  });

  // Submit an answer
  socket.on("submit_answer", ({ roomId, answer }) => {
    if (
      !rooms[roomId] ||
      !rooms[roomId].active ||
      !rooms[roomId].currentQuestion
    )
      return;

    // Record player's answer
    rooms[roomId].answers[socket.id] = answer;

    // Check if all players have answered
    const allAnswered = rooms[roomId].players.every(
      (player) => rooms[roomId].answers[player.id] !== undefined
    );

    if (allAnswered) {
      // End question early if everyone has answered
      clearTimeout(rooms[roomId].timer);
      endQuestion(roomId);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Find rooms the player is in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);

      if (playerIndex !== -1) {
        const player = room.players[playerIndex];

        console.log(
          `Player ${player.name} (${socket.id}) disconnected from room ${roomId}`
        );

        // Store the player in disconnectedPlayers with a timestamp
        room.disconnectedPlayers[socket.id] = {
          name: player.name,
          score: player.score,
          timestamp: Date.now(),
        };

        // Remove player from active players
        room.players.splice(playerIndex, 1);

        // Set a timeout to clean up if the player doesn't reconnect
        setTimeout(() => {
          if (rooms[roomId] && rooms[roomId].disconnectedPlayers[socket.id]) {
            delete rooms[roomId].disconnectedPlayers[socket.id];

            // If room is empty (no active or disconnected players), delete it
            if (
              room.players.length === 0 &&
              Object.keys(room.disconnectedPlayers).length === 0
            ) {
              delete rooms[roomId];
              console.log(`Room ${roomId} deleted (empty after grace period)`);
            } else {
              io.to(roomId).emit("players_update", room.players);
            }
          }
        }, 60000); // 60 second grace period for reconnection

        // If the host disconnected, assign a new host if there are active players
        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
          console.log(
            `New host assigned for room ${roomId}: ${room.players[0].name} (${room.host})`
          );
        }

        // Update all clients with the new player list
        io.to(roomId).emit("players_update", room.players);
        logRoomState(roomId);
      }
    }
  });
});

// Function to start a new question
async function nextQuestion(roomId) {
  if (!rooms[roomId]) return;

  try {
    // Reset answers
    rooms[roomId].answers = {};

    // Fetch new question
    const { question, answers } = await fetchQuestion();
    rooms[roomId].currentQuestion = question;

    // Send question to all players
    io.to(roomId).emit("new_question", { question, answers });

    // Start timer (15 seconds)
    let timeLeft = 15;

    // Send time updates
    const timeInterval = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit("time_update", timeLeft);

      if (timeLeft <= 0) {
        clearInterval(timeInterval);
      }
    }, 1000);

    // Set timer to end question
    rooms[roomId].timer = setTimeout(() => {
      clearInterval(timeInterval);
      endQuestion(roomId);
    }, 15000);
  } catch (error) {
    console.error("Error starting next question:", error);
    io.to(roomId).emit("error", "Failed to fetch question");
  }
}

// Function to end the current question
function endQuestion(roomId) {
  if (!rooms[roomId] || !rooms[roomId].currentQuestion) return;

  const correctAnswer = rooms[roomId].currentQuestion.correct_answer;

  // Update scores
  rooms[roomId].players.forEach((player) => {
    if (rooms[roomId].answers[player.id] === correctAnswer) {
      player.score += 10;
    }
  });

  // Send correct answer and updated scores
  io.to(roomId).emit("question_end", { correctAnswer });
  io.to(roomId).emit("players_update", rooms[roomId].players);

  // Start next question after 5 seconds
  setTimeout(() => {
    nextQuestion(roomId);
  }, 5000);
}

// Clean up inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    // If room has been inactive for more than 2 hours
    if (now - room.lastActivity > 7200000) {
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (inactive)`);
    }
  }
}, 3600000); // Check every hour

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
