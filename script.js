document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Connect to the Socket.IO server
    const videoPlayer = document.getElementById('video-player');
    const videoUpload = document.getElementById('video-upload');
    const uploadButton = document.getElementById('upload-button');

    let isSeeking = false;

    // --- Socket.IO Event Listeners ---

    socket.on('loadVideo', (videoPath) => {
        console.log('Loading video:', videoPath);
        videoPlayer.src = videoPath;
        videoPlayer.load();
    });

    socket.on('videoState', (state) => {
        console.log('Received video state:', state);
        if (!isSeeking) {
            videoPlayer.currentTime = state.time;
        }
        if (state.playing) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    });

    socket.on('play', () => {
        console.log('Server initiated play');
        videoPlayer.play();
    });

    socket.on('pause', () => {
        console.log('Server initiated pause');
        videoPlayer.pause();
    });

    socket.on('seek', (time) => {
        console.log('Server initiated seek to:', time);
        isSeeking = true;
        videoPlayer.currentTime = time;
    });

    // --- Video Player Event Listeners ---

    videoPlayer.addEventListener('play', () => {
        if (!isSeeking) {
            socket.emit('play');
        }
    });

    videoPlayer.addEventListener('pause', () => {
        if (!isSeeking) {
            socket.emit('pause');
        }
    });

    videoPlayer.addEventListener('seeked', () => {
        isSeeking = false;
        socket.emit('seek', videoPlayer.currentTime);
    });

    videoPlayer.addEventListener('timeupdate', () => {
        // Only emit timeupdate if playing and not seeking to reduce traffic
        if (!videoPlayer.paused && !isSeeking) {
            socket.emit('updateTime', videoPlayer.currentTime);
        }
    });

    // --- Upload Logic ---

    uploadButton.addEventListener('click', () => {
        const file = videoUpload.files[0];
        if (file) {
            // Read file as ArrayBuffer to send as raw body
            const reader = new FileReader();
            reader.onload = (e) => {
                fetch('/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': file.type // Important for server to know file type
                    },
                    body: e.target.result // Send as raw ArrayBuffer
                })
                .then(response => response.json())
                .then(data => {
                    console.log(data.message);
                    // Server will emit loadVideo and videoState after successful upload
                })
                .catch(error => {
                    console.error('Error uploading video:', error);
                    alert('Error uploading video.');
                });
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Please select a video file to upload.');
        }
    });
});
