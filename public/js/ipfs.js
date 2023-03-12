document.addEventListener('DOMContentLoaded', async() => {
    const node = await Ipfs.create();
    window.node = node;
    const status = node.isOnline() ? 'online' : 'offline';
    console.log(`Node status: ${status}`);
    let validip4 = Multiaddr.multiaddr('/ip4/172.65.0.13/tcp/4009/p2p/QmcfgsJsMtx6qJb74akCw1M24X1zFwgGo11h1cuhwQjtJP');
    const resp = await node.bootstrap.add(validip4);
    console.log(resp);
});