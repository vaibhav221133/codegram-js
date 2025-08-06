import http from 'http';
import app from './app.js'; // Added .js extension
import { initSocket } from './socket.js'; // Added .js extension

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

app.get('/', (req, res) => {
  res.send(`💻 API documentation available at <a href="http://localhost:${PORT}/api-docs">api-docs</a>`);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port http://localhost:${PORT}/`);
  console.log(`💻 API documentation available at http://localhost:${PORT}/api-docs`);
});