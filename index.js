require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const pdfRoutes = require('./routes/pdfRoutes');

const geminiRoutes = require('./routes/geminiRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// API routes


app.use('/api/pdf', pdfRoutes);                 // PDF generation




app.use('/api/gemini', geminiRoutes);

const PORT = process.env.PORT || 5000;

// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => {
//   console.log('MongoDB connected');
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// })
// .catch(err => console.error(err));
app.listen(PORT, ()=>{
  console.log("Server is running on the port", PORT)
})
