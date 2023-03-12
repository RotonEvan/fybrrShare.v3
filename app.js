require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const https = require('https');
const http = require('http');
const socketio = require('socket.io');



const fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));

// const key = fs.readFileSync(path.join(__dirname, '/certs/selfsigned.key'));
// const cert = fs.readFileSync(path.join(__dirname, '/certs/selfsigned.crt'));
// const options = {
//     key: key,
//     cert: cert
// };

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`fybrrStore v3 express app listening on PORT ${PORT}`);
});

const io = socketio(server);

const users = []

function newUser(id, username, room) {
    const user = { id, username, room }
    users.push(user)
    return user;
}

let roomPeers = {};
io.sockets.on('connection', socket => {
    socket.on('joinroom', (username, room) => {
        const user = newUser(socket.id, username, room);
        console.log(user);
        socket.join(room);
        console.log(room);
        const roomSize = io.sockets.adapter.rooms[room] != undefined ? Object.keys(io.sockets.adapter.rooms[room]).length : 0;
        io.to(user.room).emit("updateRoom", username, roomSize, socket.id);

        if (!roomPeers[room]) {
            roomPeers[room] = {};
        }
        roomPeers[room][username] = socket.id;
        socket.emit("socketID", socket.id, roomPeers[room]);
    })

    socket.on("message", (message, room, msgType) => {
        // if (message.type === "offer" || message.type === "answer" || message.candidate) {
        console.log('Message: ', message.type, room, msgType);
        // }
        socket.to(room).emit("message", message, room, msgType);
    })
})

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/views/home.html');
})

app.get('/room', (req, res) => {
    // res.sendFile(__dirname + '/public/views/room.html');
    let roomID = Math.floor(1000 + Math.random() * 9000);
    console.log(roomID);
    res.redirect('/room/' + roomID)
})


app.get('/room/:roomID', (req, res) => {
    let roomid = req.params.roomID;
    console.log("New peer in " + roomid);
    res.sendFile(__dirname + '/public/views/room.html')
})