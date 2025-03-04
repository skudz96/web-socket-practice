// load environment variables
require("dotenv").config();
// load server
const express = require("express");
// load cors
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = `0.0.0.0`;

app.use(cors());
app.use(express.json());

// Test API Route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
