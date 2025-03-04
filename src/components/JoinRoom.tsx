"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

interface Player {
  id: string;
  name: string;
  score: number;
}

interface Question {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export default function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const hasJoined = useRef(false);

  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [error, setError] = useState("");
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);

  useEffect(() => {
    // Get player name and host status from navigation state if available
    if (location.state) {
      const { playerName: name, isHost: host } = location.state as {
        playerName: string;
        isHost: boolean;
      };
      if (name) setPlayerName(name);
      if (host) setIsHost(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!socket || !roomId || !isConnected) return;

    // Set up socket event listeners
    const onPlayersUpdate = (updatedPlayers: Player[]) => {
      console.log("Players updated:", updatedPlayers);
      setPlayers(updatedPlayers);
    };

    const onGameStarted = () => {
      setGameStarted(true);
    };

    const onNewQuestion = ({
      question,
      answers,
    }: {
      question: Question;
      answers: string[];
    }) => {
      setQuestion(question);
      setAnswers(answers);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setWaitingForNextQuestion(false);
      setTimeLeft(15);
    };

    const onTimeUpdate = (time: number) => {
      setTimeLeft(time);
    };

    const onQuestionEnd = ({ correctAnswer }: { correctAnswer: string }) => {
      if (selectedAnswer) {
        setIsCorrect(selectedAnswer === correctAnswer);
      }
      setWaitingForNextQuestion(true);
    };

    const onError = (errorMsg: string) => {
      setError(errorMsg);
      setIsJoining(false);
    };

    // Register event listeners
    socket.on("players_update", onPlayersUpdate);
    socket.on("game_started", onGameStarted);
    socket.on("new_question", onNewQuestion);
    socket.on("time_update", onTimeUpdate);
    socket.on("question_end", onQuestionEnd);
    socket.on("error", onError);

    // If we already have player name and room ID, join automatically
    // But only do this once to prevent multiple joins
    if (location.state?.playerName && roomId && !hasJoined.current) {
      console.log("Auto-joining room with name:", location.state.playerName);
      socket.emit("join_room", {
        roomId,
        playerName: location.state.playerName,
      });
      hasJoined.current = true;
    }

    // Clean up event listeners when component unmounts
    return () => {
      socket.off("players_update", onPlayersUpdate);
      socket.off("game_started", onGameStarted);
      socket.off("new_question", onNewQuestion);
      socket.off("time_update", onTimeUpdate);
      socket.off("question_end", onQuestionEnd);
      socket.off("error", onError);
    };
  }, [socket, roomId, isConnected, location.state, selectedAnswer]);

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!socket || !isConnected) {
      setError("Socket connection not established. Please try again.");
      return;
    }

    if (hasJoined.current) {
      setError("You have already joined this room");
      return;
    }

    setIsJoining(true);
    setError("");

    if (roomId) {
      console.log("Manually joining room with name:", playerName);
      socket.emit("join_room", { roomId, playerName });
      hasJoined.current = true;
    }
  };

  const handleStartGame = () => {
    if (socket && roomId) {
      socket.emit("start_game", { roomId });
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer !== null || !question || timeLeft === 0) return;

    setSelectedAnswer(answer);

    if (socket && roomId) {
      socket.emit("submit_answer", { roomId, answer });
    }
  };

  const decodeHTMLEntities = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.innerHTML = text;
    return textArea.value;
  };

  // Render waiting room
  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <Link to="/">
              <button className="p-2 rounded-full hover:bg-gray-700">
                Home
              </button>
            </Link>
            <div className="text-xs">
              {isConnected ? (
                <span className="text-green-500">● Connected</span>
              ) : (
                <span className="text-red-500">● Disconnected</span>
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">
            Room: {roomId}
          </h2>

          {!playerName && (
            <div className="space-y-2 mb-4">
              <label htmlFor="playerName" className="block text-sm font-medium">
                Your Name
              </label>
              <input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              />
            </div>
          )}

          {playerName && (
            <>
              <div className="bg-gray-700 p-4 rounded-lg mb-4">
                <h3 className="text-lg font-semibold mb-2">
                  Players ({players.length})
                </h3>
                <ul className="space-y-2">
                  {players.map((player, index) => (
                    <li
                      key={`${player.id}-${index}`}
                      className="flex items-center"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{player.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-center text-gray-400 text-sm mb-4">
                {isHost
                  ? "Waiting for players to join. Start the game when ready!"
                  : "Waiting for the host to start the game..."}
              </p>
            </>
          )}

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {!playerName ? (
            <button
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              onClick={handleJoinRoom}
              disabled={isJoining || !isConnected}
            >
              {isJoining ? "Joining..." : "Join Room"}
            </button>
          ) : isHost ? (
            <button
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              onClick={handleStartGame}
              disabled={players.length < 1 || !isConnected}
            >
              Start Game
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Render game
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-medium">Room: {roomId}</div>
          <div className="text-xl font-semibold">Time: {timeLeft}s</div>
        </div>
        <h2 className="text-xl text-center mb-2">
          {question ? decodeHTMLEntities(question.category) : "Loading..."}
        </h2>
        <div className="flex justify-center gap-4 mt-2 mb-4">
          {players.map((player, index) => (
            <div key={`${player.id}-${index}`} className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mx-auto">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs mt-1">{player.name}</div>
              <div className="text-xs font-bold">{player.score}</div>
            </div>
          ))}
        </div>

        {!question ? (
          <div className="flex justify-center py-8">Loading...</div>
        ) : (
          <>
            <div className="text-xl mb-6 text-center p-4 bg-gray-700 rounded-lg">
              {decodeHTMLEntities(question.question)}
            </div>
            <div className="grid gap-3">
              {answers.map((answer, index) => {
                let buttonClass = "py-3 px-4 text-left rounded-md border ";

                if (selectedAnswer === answer) {
                  buttonClass += isCorrect
                    ? "bg-green-600 border-green-500"
                    : "bg-red-600 border-red-500";
                } else if (
                  waitingForNextQuestion &&
                  answer === question.correct_answer
                ) {
                  buttonClass += "bg-green-600 border-green-500";
                } else {
                  buttonClass += "border-gray-600 hover:bg-gray-700";
                }

                return (
                  <button
                    key={index}
                    className={buttonClass}
                    onClick={() => handleAnswerSelect(answer)}
                    disabled={selectedAnswer !== null || timeLeft === 0}
                  >
                    {decodeHTMLEntities(answer)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-center mt-6">
          {waitingForNextQuestion && (
            <p className="text-gray-400">Waiting for next question...</p>
          )}
        </div>
      </div>
    </div>
  );
}
