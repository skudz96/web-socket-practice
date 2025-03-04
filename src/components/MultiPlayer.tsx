"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

export default function MultiPlayer() {
  const { socket, isConnected } = useSocket();
  const [roomId, setRoomId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const hasCreatedRoom = useRef(false);

  useEffect(() => {
    // Generate a random room ID
    const randomRoomId = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    setRoomId(randomRoomId);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Set up event listeners
    const onRoomCreated = () => {
      console.log("Room created, navigating to join room");
      navigate(`/join/${roomId}`, { state: { isHost: true, playerName } });
    };

    const onError = (errorMsg: string) => {
      setError(errorMsg);
      setIsCreatingRoom(false);
    };

    socket.on("room_created", onRoomCreated);
    socket.on("error", onError);

    // Clean up event listeners when component unmounts
    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("error", onError);
    };
  }, [socket, roomId, playerName, navigate]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!socket || !isConnected) {
      setError("Socket connection not established. Please try again.");
      return;
    }

    if (hasCreatedRoom.current) {
      setError("You have already created a room");
      return;
    }

    setIsCreatingRoom(true);
    setError("");
    console.log("Creating room with ID:", roomId, "and name:", playerName);
    socket.emit("create_room", { roomId, playerName });
    hasCreatedRoom.current = true;
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <Link to="/">
            <button className="p-2 rounded-full hover:bg-gray-700">Home</button>
          </Link>
          <div className="text-xs">
            {isConnected ? (
              <span className="text-green-500">● Connected</span>
            ) : (
              <span className="text-red-500">● Disconnected</span>
            )}
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6">
          Create Multiplayer Game
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <label htmlFor="roomId" className="block text-sm font-medium">
              Room Code
            </label>
            <div className="flex gap-2">
              <input
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md uppercase"
              />
              <button
                onClick={copyRoomLink}
                title="Copy room link"
                className="p-2 bg-gray-700 border border-gray-600 rounded-md"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Share this code with friends to join your game
            </p>
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        </div>

        <div className="mt-6">
          <button
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            onClick={handleCreateRoom}
            disabled={isCreatingRoom || !isConnected}
          >
            {isCreatingRoom ? "Creating Room..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
