// Minimal test server
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

const PORT = 4002;
app.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}/`);
  console.log(`Test: http://localhost:${PORT}/test`);
});