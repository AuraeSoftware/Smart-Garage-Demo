const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve the built React app
app.use(express.static(path.join(__dirname, 'build')));

// All routes return index.html (React handles routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WashPro running on port ${PORT}`);
});
