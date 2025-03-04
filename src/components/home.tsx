import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Choose Game Mode</h2>
          <p className="text-gray-300">Play alone or challenge your friends!</p>
        </div>
        <div className="flex flex-col gap-4">
          <Link to="/singleplayer" className="w-full">
            <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md">
              Single Player
            </button>
          </Link>
          <Link to="/multiplayer" className="w-full">
            <button className="w-full py-3 bg-transparent border border-blue-400 text-white hover:bg-blue-800/50 rounded-md">
              Multiplayer
            </button>
          </Link>
        </div>
        <div className="text-center text-sm text-gray-400 mt-6">
          Powered by Open Trivia Database
        </div>
      </div>
    </div>
  );
}
