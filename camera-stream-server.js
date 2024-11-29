const WebSocket = require("ws");
const wrtc = require("wrtc");

const server = new WebSocket.Server({ port: 8080 });

server.on("connection", (socket) => {
  const peer = new wrtc.RTCPeerConnection();

  peer.ontrack = (event) => {
    console.log("Stream received");
    // You can process or redirect the stream here
  };

  socket.on("message", async (message) => {
    const data = JSON.parse(message);
    if (data.type === "offer") {
      await peer.setRemoteDescription(data);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.send(JSON.stringify(peer.localDescription));
    }
  });
});

console.log("WebRTC server running on ws://localhost:8080");
