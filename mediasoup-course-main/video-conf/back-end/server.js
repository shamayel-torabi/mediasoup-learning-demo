//const fs = require('fs') //we need this to read our keys. Part of node
//const https = require('https') //we need this for a secure express server. part of node
const http = require("http");
//express sets up the http server and serves our front end
const express = require("express");
const usersRoute = require("./routes/usersRoute.js");
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express();

app.use(cors())
app.use(bodyParser.json())
//seve everything in public statically
app.use(express.static("public"));
app.use("/api", usersRoute);

//get the keys we made with mkcert
//const key = fs.readFileSync('./config/cert.key')
//const cert = fs.readFileSync('./config/cert.crt')
//const options = {key,cert}
//use those keys with the https module to have https
// const httpsServer = https.createServer(options, app)
//FOR LOCAL ONlY... non https
const httpServer = http.createServer(app);

const socketio = require("socket.io");

const config = require("./config/config");
const createWorkers = require("./utilities/createWorkers");
const getWorker = require("./utilities/getWorker");
const updateActiveSpeakers = require("./utilities/updateActiveSpeakers");
const Client = require("./classes/Client");
const Room = require("./classes/Room");

//set up the socketio server, listening by way of our express https sever
// const io = socketio(httpsServer,{
const io = socketio(httpServer, {
  cors: [`https://localhost:5173`],
  cors: [`http://localhost:5173`],
  cors: [`https://192.168.1.44`],
});

//our globals
//init workers, it's where our mediasoup workers will live
let workers = null;
// router is now managed by the Room object
// master rooms array that contains all our Room object
const rooms = [];
const messages = [];

//initMediaSoup gets mediasoup ready to do its thing
const initMediaSoup = async () => {
  workers = await createWorkers();
  // console.log(workers)
};

initMediaSoup(); //build our mediasoup server/sfu

// socketIo listeners
io.on("connect", (socket) => {
  // this is where this client/user/socket lives!
  let client; //this client object available to all our socket listeners
  const handshake = socket.handshake; //socket.handshake is where auth and query live
  //you could now check handshake for password, auth, etc.

  socket.emit("connection-success", { socketId: socket.id, messages });

  socket.on("disconnect", () => {
    console.log("Peer disconnected");
  });
  socket.on("sendMessage", (message) => {
    const m = { id: crypto.randomUUID(), text: message };
    messages.push(m);
    io.emit("newMessage", m);
  });
  socket.on("joinRoom", async ({ userName, roomName }, ackCb) => {
    let newRoom = false;
    client = new Client(userName, socket);
    let requestedRoom = rooms.find((room) => room.roomName === roomName);
    if (!requestedRoom) {
      newRoom = true;
      // make the new room, add a worker, add a router
      const workerToUse = await getWorker(workers);
      requestedRoom = new Room(roomName, workerToUse);
      await requestedRoom.createRouter(io);
      rooms.push(requestedRoom);
    }
    // add the room to the client
    client.room = requestedRoom;
    // add the client to the Room clients
    client.room.addClient(client);
    // add this socket to the socket room
    socket.join(client.room.roomName);

    //fetch the first 0-5 pids in activeSpeakerList
    const audioPidsToCreate = client.room.activeSpeakerList.slice(0, 5);
    //find the videoPids and make an array with matching indicies
    // for our audioPids.
    const videoPidsToCreate = audioPidsToCreate.map((aid) => {
      const producingClient = client.room.clients.find(
        (c) => c?.producer?.audio?.id === aid
      );
      return producingClient?.producer?.video?.id;
    });
    //find the username and make an array with matching indicies
    // for our audioPids/videoPids.
    const associatedUserNames = audioPidsToCreate.map((aid) => {
      const producingClient = client.room.clients.find(
        (c) => c?.producer?.audio?.id === aid
      );
      return producingClient?.userName;
    });

    ackCb({
      routerRtpCapabilities: client.room.router.rtpCapabilities,
      newRoom,
      audioPidsToCreate,
      videoPidsToCreate,
      associatedUserNames,
    });
  });
  socket.on("requestTransport", async ({ type, audioPid }, ackCb) => {
    // whether producer or consumer, client needs params
    let clientTransportParams;
    if (type === "producer") {
      // run addClient, which is part of our Client class
      clientTransportParams = await client.addTransport(type);
    } else if (type === "consumer") {
      // we have 1 trasnport per client we are streaming from
      // each trasnport will have an audio and a video producer/consumer
      // we know the audio Pid (because it came from dominantSpeaker), get the video
      const producingClient = client.room.clients.find(
        (c) => c?.producer?.audio?.id === audioPid
      );
      const videoPid = producingClient?.producer?.video?.id;
      clientTransportParams = await client.addTransport(
        type,
        audioPid,
        videoPid
      );
    }
    ackCb(clientTransportParams);
  });
  socket.on(
    "connectTransport",
    async ({ dtlsParameters, type, audioPid }, ackCb) => {
      if (type === "producer") {
        try {
          await client.upstreamTransport.connect({ dtlsParameters });
          ackCb("success");
        } catch (error) {
          console.log(error);
          ackCb("error");
        }
      } else if (type === "consumer") {
        // find the right transport, for this consumer
        try {
          const downstreamTransport = client.downstreamTransports.find((t) => {
            return t.associatedAudioPid === audioPid;
          });
          downstreamTransport.transport.connect({ dtlsParameters });
          ackCb("success");
        } catch (error) {
          console.log(error);
          ackCb("error");
        }
      }
    }
  );
  socket.on("startProducing", async ({ kind, rtpParameters }, ackCb) => {
    // create a producer with the rtpParameters we were sent
    try {
      const newProducer = await client.upstreamTransport.produce({
        kind,
        rtpParameters,
      });
      //add the producer to this client obect
      client.addProducer(kind, newProducer);
      if (kind === "audio") {
        client.room.activeSpeakerList.push(newProducer.id);
      }
      // the front end is waiting for the id
      ackCb(newProducer.id);
    } catch (err) {
      console.log(err);
      ackCb(err);
    }

    // run updateActiveSpeakers
    const newTransportsByPeer = updateActiveSpeakers(client.room, io);
    // newTransportsByPeer is an object, each property is a socket.id that
    // has transports to make. They are in an array, by pid
    for (const [socketId, audioPidsToCreate] of Object.entries(
      newTransportsByPeer
    )) {
      // we have the audioPidsToCreate this socket needs to create
      // map the video pids and the username
      const videoPidsToCreate = audioPidsToCreate.map((aPid) => {
        const producerClient = client.room.clients.find(
          (c) => c?.producer?.audio?.id === aPid
        );
        return producerClient?.producer?.video?.id;
      });
      const associatedUserNames = audioPidsToCreate.map((aPid) => {
        const producerClient = client.room.clients.find(
          (c) => c?.producer?.audio?.id === aPid
        );
        return producerClient?.userName;
      });
      io.to(socketId).emit("newProducersToConsume", {
        routerRtpCapabilities: client.room.router.rtpCapabilities,
        audioPidsToCreate,
        videoPidsToCreate,
        associatedUserNames,
        activeSpeakerList: client.room.activeSpeakerList.slice(0, 5),
      });
    }
  });
  socket.on("audioChange", (typeOfChange) => {
    if (typeOfChange === "mute") {
      client?.producer?.audio?.pause();
    } else {
      client?.producer?.audio?.resume();
    }
  });
  socket.on("consumeMedia", async ({ rtpCapabilities, pid, kind }, ackCb) => {
    // will run twice for every peer to consume... once for video, once for audio
    console.log("Kind: ", kind, "   pid:", pid);
    // we will set up our clientConsumer, and send back the params
    // use the right transport and add/update the consumer in Client
    // confirm canConsume
    try {
      if (
        !client.room.router.canConsume({ producerId: pid, rtpCapabilities })
      ) {
        ackCb("cannotConsume");
      } else {
        // we can consume!
        const downstreamTransport = client.downstreamTransports.find((t) => {
          if (kind === "audio") {
            return t.associatedAudioPid === pid;
          } else if (kind === "video") {
            return t.associatedVideoPid === pid;
          }
        });
        // create the consumer with the transport
        const newConsumer = await downstreamTransport.transport.consume({
          producerId: pid,
          rtpCapabilities,
          paused: true, //good practice
        });
        // add this newCOnsumer to the CLient
        client.addConsumer(kind, newConsumer, downstreamTransport);
        // respond with the params
        const clientParams = {
          producerId: pid,
          id: newConsumer.id,
          kind: newConsumer.kind,
          rtpParameters: newConsumer.rtpParameters,
        };
        ackCb(clientParams);
      }
    } catch (err) {
      console.log(err);
      ackCb("consumeFailed");
    }
  });
  socket.on("unpauseConsumer", async ({ pid, kind }, ackCb) => {
    const consumerToResume = client.downstreamTransports.find((t) => {
      return t?.[kind].producerId === pid;
    });
    await consumerToResume[kind].resume();
    ackCb();
  });
});

// httpsServer.listen(config.port)
httpServer.listen(config.port, () => {
  console.log("listening on http://127.0.0.1:" + config.port);
});
