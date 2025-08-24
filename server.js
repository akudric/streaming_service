const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const UPLOAD_DIR = 'uploads';

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve uploaded video files
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));

let currentVideo = null; // Stores the path to the currently playing video
let videoState = { playing: false, time: 0 };

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send current video and state to new connections
    if (currentVideo) {
        socket.emit('loadVideo', currentVideo);
        socket.emit('videoState', videoState);
    }

    socket.on('play', () => {
        videoState.playing = true;
        io.emit('play');
    });

    socket.on('pause', () => {
        videoState.playing = false;
        io.emit('pause');
    });

    socket.on('seek', (time) => {
        videoState.time = time;
        io.emit('seek', time);
    });

    socket.on('updateTime', (time) => {
        videoState.time = time;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Handle video upload
app.post('/upload', upload.single('video'), (req, res) => {
    if (req.file) {
        currentVideo = `/uploads/${req.file.filename}`;
        videoState = { playing: false, time: 0 }; // Reset state for new video
        io.emit('loadVideo', currentVideo);
        io.emit('videoState', videoState);
        res.json({ message: 'Video uploaded and set for streaming!', videoPath: currentVideo });
    } else {
        res.status(400).json({ message: 'No video file uploaded.' });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
