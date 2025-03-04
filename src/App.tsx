import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import SinglePlayer from "./components/SinglePlayer";
import MultiPlayer from "./components/MultiPlayer";
import JoinRoom from "./components/JoinRoom";
import { SocketProvider } from "./context/SocketContext";
import "./App.css";

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <header className="container mx-auto py-6 text-center">
            <h1 className="text-4xl font-bold mb-2">Trivia Challenge</h1>
            <p className="text-xl text-gray-300">Test your knowledge!</p>
          </header>
          <main className="container mx-auto py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/singleplayer" element={<SinglePlayer />} />
              <Route path="/multiplayer" element={<MultiPlayer />} />
              <Route path="/join/:roomId" element={<JoinRoom />} />
            </Routes>
          </main>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;
