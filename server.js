const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

let currentVideo = null; // Stores the URL to the currently playing video
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

// Handle video upload to Cloudinary
app.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    console.log('[/upload] Request received.');
    try {
        const fileBuffer = req.body;

        if (!fileBuffer || fileBuffer.length === 0) {
            console.log('[/upload] No file data received.');
            return res.status(400).json({ message: 'No file data received.' });
        }

        console.log(`[/upload] File buffer size: ${fileBuffer.length} bytes`);

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload_stream(
            { resource_type: 'video' },
            (error, result) => {
                if (error) {
                    console.error('[/upload] Cloudinary upload error:', error);
                    return res.status(500).json({ message: 'Cloudinary upload failed.', error: error.message });
                }
                if (result) {
                    console.log('[/upload] Cloudinary upload successful. URL:', result.secure_url);
                    currentVideo = result.secure_url; // Use the secure URL from Cloudinary
                    videoState = { playing: false, time: 0 }; // Reset state for new video
                    io.emit('loadVideo', currentVideo);
                    io.emit('videoState', videoState);
                    res.json({ message: 'Video uploaded to Cloudinary and set for streaming!', videoUrl: currentVideo });
                }
            }
        ).end(fileBuffer);

    } catch (error) {
        console.error('[/upload] Server error during upload:', error);
        res.status(500).json({ message: 'Server error during upload.', error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});