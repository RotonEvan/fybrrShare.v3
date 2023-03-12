const socket = io.connect();
let pc = {};
let dataChannel = {};
let p2p_flag = {};

window.onload = async function() {
    // ipfs setup
    const node = await Ipfs.create();
    window.node = node;
    const status = node.isOnline() ? 'online' : 'offline';
    console.log(`Node status: ${status}`);
    // let validip4 = Multiaddr.multiaddr('/ip4/172.65.0.13/tcp/4009/p2p/QmcfgsJsMtx6qJb74akCw1M24X1zFwgGo11h1cuhwQjtJP');
    // const resp = await node.bootstrap.add(validip4);
    // console.log(resp);

    // room setup

    const roomID = location.pathname.substring(location.pathname.length - 4);
    console.log(roomID);
    window.roomID = roomID;
    document.querySelector('.roomID').innerText += roomID;
    const username = prompt("Give Username: ");
    socket.emit('joinroom', username, roomID);
    window.username = username;
    window.socket = socket;
    console.log("Generate Room");
}

let localID;
socket.on("socketID", (socketid, peersObj) => {
    localID = socketid;
    peers = peersObj;
    Object.keys(peers).forEach(peername => {
        if (peername !== username) {
            chart.series[0].addPoint([username, peername], true);
        }
    });
})


// Creating a node
let peers = {};
socket.on("updateRoom", (newPeer, roomSize, newPeerID) => {
    window.roomSize = roomSize;
    console.log("Room Created of size", roomSize);
    const isOfferer = roomSize > 1;
    console.log('trigger');

    if (newPeer !== username) {
        peers[newPeer] = newPeerID;
        chart.series[0].addPoint([username, newPeer], true);
    } else {
        chart.series[0].addPoint([username, username], true);
    }

})

const configuration = {
    iceServers: [{
            url: 'stun:stun.l.google.com:19302'
        },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    // iceCandidatePoolSize: 2
};

let receiveBuffer = {};
let receivedSize = {};

// Hook up data channel event handlers
async function setupDataChannel(roomid) {
    checkDataChannelState(roomid);
    dataChannel[roomid].onopen = () => checkDataChannelState(roomid);
    dataChannel[roomid].onclose = () => checkDataChannelState(roomid);
    dataChannel[roomid].onmessage = async(event) => {

        let fileObj = JSON.parse(event.data)
        let ab = new Uint8Array(fileObj.data).buffer;
        if (!receiveBuffer[fileObj.uuid]) {
            receiveBuffer[fileObj.uuid] = [];
            receivedSize[fileObj.uuid] = { value: 0, max: fileObj.size };
            const template = document.querySelector('template[data-template="file-template"]')
            let clone = template.content.cloneNode(true);
            clone.querySelector('.card').id = fileObj.uuid;
            clone.querySelector('.card-title').id = 'title-' + fileObj.uuid;
            clone.querySelector('.card-text').id = 'text-' + fileObj.uuid;
            clone.querySelector('.progress-bar').id = 'progress-' + fileObj.uuid;
            clone.querySelector('.card-title').innerHTML = fileObj.name;
            clone.querySelector('.card-text').innerHTML = 'Receiving from ' + fileObj.peer;
            clone.querySelector('.progress-bar').style.width = '0%'
            document.querySelector('.files-list').appendChild(clone.querySelector('.card'));
        }
        // progress of sharing
        receiveBuffer[fileObj.uuid].push(ab);
        receivedSize[fileObj.uuid].value += ab.byteLength;
        document.querySelector("#progress-" + fileObj.uuid).style.width = receivedSize[fileObj.uuid].value / receivedSize[fileObj.uuid].max * 100 + "%";

        if (receivedSize[fileObj.uuid].value === receivedSize[fileObj.uuid].max) {
            document.querySelector('#text-' + fileObj.uuid).innerHTML = "Received from " + fileObj.peer;
            document.querySelector('#title-' + fileObj.uuid).innerHTML += "&nbsp" + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>'

            const received = new Blob(receiveBuffer[fileObj.uuid]);
            receiveBuffer[fileObj.uuid] = [];
            let a = document.createElement("a");
            a.href = URL.createObjectURL(received);
            a.download = fileObj.name;
            a.click();


        }
    }

}

let allFiles = {};
let torrentURIlist = [];
let filesProgress = {};
const files_input = document.getElementById('files-input');
files_input.addEventListener('input', (e) => {
    const files = Array.from(e.target.files);
    console.log(files);
    files.forEach(file => {
        const uuid = uuidv4();
        allFiles[file.name] = { uuid: uuid, file: file };

        const template = document.querySelector('template[data-template="file-template"]')
        let clone = template.content.cloneNode(true);
        clone.querySelector('.card').id = uuid;
        clone.querySelector('.card-title').id = 'title-' + uuid;
        clone.querySelector('.card-text').id = 'text-' + uuid;
        clone.querySelector('.progress-bar').id = 'progress-' + uuid;
        clone.querySelector('.card-title').innerHTML = file.name;
        clone.querySelector('.card-text').innerHTML = 'Sending to everyone'
        clone.querySelector('.progress-bar').style.width = '0%'
        document.querySelector('.files-list').appendChild(clone.querySelector('.card'));

    });

    document.querySelector('.send-file-btn').disabled = false;
})

const send = document.querySelector('.send-file-btn')
send.addEventListener('click', (e) => {
    e.preventDefault();

    // send file using ipfs
    // add files to ipfs
    Object.keys(allFiles).forEach(async key => {
        let fileObj = allFiles[key];
        let uuid = fileObj.uuid;
        let file = fileObj.file;
        console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);
        let sendProgress = document.querySelector("#progress-" + uuid);
        sendProgress.max = file.size;
        // receiveProgress.max = file.size;
        // add file to ipfs and get cid
        let file_send = {
            path: file.name,
            content: file
        }
        let cid = await node.add(file_send);
        console.log(cid);
        // convert cid to hash
        let hash = cid.cid.toString();
        console.log(hash);
        let fileCid = { cid: hash, filename: file.name, filesize: file.size, filetype: file.type, filelastModified: file.lastModified };
        console.log(fileCid);
        sendMessage(JSON.stringify({ type: 'file', file: fileCid }), roomID, 'new-file');
    })



    // send file using data channel
    // Object.keys(allFiles).forEach(key => {
    //     let fileReader;
    //     let fileObj = allFiles[key];
    //     let uuid = fileObj.uuid;
    //     let file = fileObj.file;
    //     console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);
    //     let sendProgress = document.querySelector("#progress-" + uuid);
    //     sendProgress.max = file.size;
    //     // receiveProgress.max = file.size;
    //     const chunkSize = 16384;
    //     fileReader = new FileReader();
    //     let offset = 0;
    //     fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    //     fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    //     fileReader.addEventListener('load', e => {
    //         console.log('FileRead.onload ', e);
    //         dataChannel[roomID].send(JSON.stringify({ uuid: uuid, name: file.name, size: file.size, peer: username, data: Array.from(new Uint8Array(e.target.result)) }));
    //         offset += e.target.result.byteLength;
    //         sendProgress.style.width = offset / sendProgress.max * 100 + "%";
    //         if (offset < file.size) {
    //             readSlice(offset);
    //         }
    //     });
    //     const readSlice = o => {
    //         console.log('readSlice ', o);
    //         const slice = file.slice(offset, o + chunkSize);
    //         fileReader.readAsArrayBuffer(slice);
    //     };
    //     readSlice(0);
    // });

    send.disabled = true;
})

socket.on("message", async(message, roomid, msgType) => {
    console.log('Client receiving message: ', message, roomid, msgType);
    if (msgType === 'new-file') {
        let file = JSON.parse(message).file;
        let template = document.querySelector('template[data-template="file-template"]')
        let clone = template.content.cloneNode(true);
        clone.querySelector('.card').id = file.cid;
        clone.querySelector('.card-title').id = 'title-' + file.cid;
        clone.querySelector('.card-text').id = 'text-' + file.cid;
        clone.querySelector('.progress-bar').id = 'progress-' + file.cid;
        clone.querySelector('.card-title').innerHTML = file.filename;
        clone.querySelector('.card-text').innerHTML = 'Receiving from everyone'
        clone.querySelector('.progress-bar').style.width = '0%'
        document.querySelector('.files-list').appendChild(clone.querySelector('.card'));
        filesProgress[file.cid] = document.querySelector("#progress-" + file.cid);
        filesProgress[file.cid].max = file.filesize;
        // receiveProgress.max = file.size;
        // get file from ipfs
        const chunks = [];
        for await (const chunk of node.cat(file.cid)) {
            console.log(chunk);
            chunks.push(chunk);
        }
        let fileData = new Blob(chunks, { type: file.filetype });
        let fileUrl = URL.createObjectURL(fileData);
        let a = document.createElement('a');
        a.href = fileUrl;
        a.download = file.filename;
        a.click();
        console.log("file downloaded");
    }

})

function sendMessage(message, room, msgType) {
    if (message.type === "offer" || message.type === "answer" || message.candidate) {
        console.log('Client sending message: ', message, room, msgType);
    }
    socket.emit('message', message, room, msgType);
}

let chart = new Highcharts.chart('peers', {
    chart: {
        type: 'networkgraph',
        // color: 'rgba(255, 255, 255, 0)'
    },
    title: {
        text: 'Peer graph',
        color: '#ccc'
    },
    plotOptions: {
        networkgraph: {
            layoutAlgorithm: {
                enableSimulation: true
            }
        }
    },

    series: [{
        dataLabels: {
            enabled: true,
            // linkTextPath: {
            //     attributes: {
            //         dy: 12
            //     }
            // },
            linkFormat: '',
            textPath: {
                enabled: true,
                attributes: {
                    dy: 14,
                    startOffset: '45%',
                    textLength: 80
                }
            },
            format: '{point.name}'
        },
        marker: {
            radius: 35
        },
        data: []
    }]
});

function copy() {
    const link = location.href;
    const el = document.createElement('textarea');
    el.value = link;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("Text Copied");
}