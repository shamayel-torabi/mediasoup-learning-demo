import { createServer } from "http";
import { parse } from "url";
import next from "next";
import mediasoup from "mediasoup";
import { Server } from "socket.io";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

let worker;
let router;
let producerTransport;
let consumerTransport;
let producer;
let consumer;

const mediaCodecs = [
  {
    /** Indicates this is an audio codec configuration */
    kind: "audio",
    /**
     * Specifies the MIME type for the Opus codec, known for good audio quality at various bit rates.
     * Format: <type>/<subtype>, e.g., audio/opus
     */
    mimeType: "audio/opus",
    /**
     * Specifies the number of audio samples processed per second (48,000 samples per second for high-quality audio).
     * Higher values generally allow better audio quality.
     */
    clockRate: 48000,
    /** Specifies the number of audio channels (2 for stereo audio). */
    channels: 2,
    /**
     * Optional: Specifies a preferred payload type number for the codec.
     * Helps ensure consistency in payload type numbering across different sessions or applications.
     */
    preferredPayloadType: 96, // Example value
    /**
     * Optional: Specifies a list of RTCP feedback mechanisms supported by the codec.
     * Helps optimize codec behavior in response to network conditions.
     */
    rtcpFeedback: [
      // Example values
      { type: "nack" },
      { type: "nack", parameter: "pli" },
    ],
  },
  {
    /** Indicates this is a video codec configuration */
    kind: "video",
    /** Specifies the MIME type for the VP8 codec, commonly used for video compression. */
    mimeType: "video/VP8",
    /** Specifies the clock rate, or the number of timing ticks per second (commonly 90,000 for video). */
    clockRate: 90000,
    /**
     * Optional: Specifies codec-specific parameters.
     * In this case, sets the starting bitrate for the codec.
     */
    parameters: {
      "x-google-start-bitrate": 1000,
    },
    preferredPayloadType: 97, // Example value
    rtcpFeedback: [
      // Example values
      { type: "nack" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" },
    ],
  },
];

const createWorker = async () => {
  const newWorker = await mediasoup.createWorker({
    rtcMinPort: 2000, // Minimum port number for RTC traffic
    rtcMaxPort: 2020, // Maximum port number for RTC traffic
  });

  console.log(`Worker process ID ${newWorker.pid}`);

  /**
   * Event handler for the 'died' event on the worker.
   * This is crucial for handling failures in the media handling layer and ensuring system stability.
   */
  newWorker.on("died", (error) => {
    console.error("mediasoup worker has died");
    // Gracefully shut down the process to allow for recovery or troubleshooting.
    setTimeout(() => {
      process.exit();
    }, 2000);
  });

  return newWorker;
};

const createWebRtcTransport = async (callback) => {
  try {
    /**
     * Configuration options for the WebRTC transport.
     * Adjusting these options can help optimize network performance and reliability.
     */
    const webRtcTransportOptions = {
      /**
       * Array of IP addresses for the transport to listen on.
       * Necessary for receiving incoming network connections.
       */
      listenIps: [
        {
          ip: "0.0.0.0", // replace with relevant IP address
          announcedIp: "127.0.0.1",
        },
      ],
      /**
       * Enables User Datagram Protocol (UDP) for the transport.
       * UDP is often preferred for real-time media due to its lower latency compared to TCP.
       */
      enableUdp: true,
      /**
       * Enables Transmission Control Protocol (TCP) for the transport.
       * TCP may be used if UDP is blocked or unreliable on the network.
       */
      enableTcp: true,
      /**
       * Prefers UDP over TCP for the transport.
       * Helps ensure lower latency if both protocols are enabled.
       */
      preferUdp: true,
    };

    /**
     * Creates a WebRTC transport using the specified options.
     * This transport will be used to send or receive media.
     */
    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );

    console.log(`Transport created: ${transport.id}`);

    /**
     * Monitors changes in the DTLS connection state.
     * Closes the transport if the DTLS state becomes closed.
     * This helps ensure resources are freed up when the transport is no longer needed.
     */
    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    /**
     * Monitors transport closure events.
     * Useful for logging or cleaning up resources related to the transport.
     */
    transport.on("@close", () => {
      console.log("Transport closed");
    });

    /**
     * Invokes the callback with the transport parameters.
     * This allows the caller to retrieve the necessary information for establishing a WebRTC connection.
     */
    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });

    /** Returns the transport object for further use. */
    return transport;
  } catch (error) {
    console.log(error);
    /**
     * Invokes the callback with error information if an error occurs.
     * Allows the caller to handle the error.
     */
    callback({
      params: {
        error,
      },
    });
  }
};

worker = await createWorker();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);
  const peers = io.of("/mediasoup");

  peers.on("connection", async (socket) => {
    console.log(`Peer connected: ${socket.id}`);
    socket.emit("connection-success", { socketId: socket.id });

    /**
     * Event handler for peer disconnection.
     * This can be used to clean up resources associated with the peer.
     */
    socket.on("disconnect", () => {
      console.log("Peer disconnected");
    });

    /**
     * Create a router for the peer.
     * A router is required to route media to/from this peer.
     */
    router = await worker.createRouter({
      mediaCodecs: mediaCodecs,
    });

    /**
     * Event handler for fetching router RTP capabilities.
     * RTP capabilities are required for configuring transports and producers/consumers.
     * This function is called when a peer requests the router RTP capabilities.
     * @param {function} callback - A callback function to handle the result of the router RTP capabilities request.
     */
    socket.on("getRouterRtpCapabilities", (callback) => {
      const routerRtpCapabilities = router.rtpCapabilities;
      callback({ routerRtpCapabilities });
    });

    /**
     * Event handler for creating a transport.
     * A transport is required for sending or producing media.
     * This function is called when a peer requests to create a transport.
     * The callback function is used to send the transport parameters to the peer.
     * @param {boolean} data.sender - Indicates whether the transport is for sending or receiving media.
     * @param {function} callback - A callback function to handle the result of the transport creation.
     */
    socket.on("createTransport", async ({ sender }, callback) => {
      if (sender) {
        producerTransport = await createWebRtcTransport(callback);
      } else {
        consumerTransport = await createWebRtcTransport(callback);
      }
    });

    /**
     * Event handler for connecting the sending transport.
     * This step is required before the transport can be used to send media.
     * @param {object} data.dtlsParameters - Datagram Transport Layer Security (DTLS) parameters.
     * These parameters are necessary for securing the transport with encryption.
     */
    socket.on("connectProducerTransport", async ({ dtlsParameters }) => {
      await producerTransport?.connect({ dtlsParameters });
    });

    /**
     * Event handler for producing media.
     * This function sets up a producer for sending media to the peer.
     * A producer represents the source of a single media track (audio or video).
     */
    socket.on(
      "transport-produce",
      async ({ kind, rtpParameters }, callback) => {
        producer = await producerTransport?.produce({
          kind,
          rtpParameters,
        });

        producer?.on("transportclose", () => {
          console.log("Producer transport closed");
          producer?.close();
        });

        callback({ id: producer?.id });
      }
    );

    /**
     * Event handler for connecting the receiving transport.
     * This step is required before the transport can be used to receive media.
     */
    socket.on("connectConsumerTransport", async ({ dtlsParameters }) => {
      await consumerTransport?.connect({ dtlsParameters });
    });

    /**
     * Event handler for consuming media.
     * This function sets up a consumer for receiving media from the peer.
     * A consumer represents the endpoint for receiving media of a single kind
     * (audio or video) from a remote peer. Creating a consumer involves multiple
     * steps to ensure that the media can be received and decoded correctly.
     *
     * @event
     * @param {object} rtpCapabilities - The RTP capabilities of the consuming endpoint.
     * @param {function} callback - A callback function to handle the result of the consume operation.
     */
    socket.on("consumeMedia", async ({ rtpCapabilities }, callback) => {
      try {
        // Ensure there's a producer to consume from
        if (producer) {
          // Check if the router can consume the media from the producer based on the RTP capabilities
          if (
            !router.canConsume({ producerId: producer?.id, rtpCapabilities })
          ) {
            console.error("Cannot consume");
            return;
          }
          console.log("-------> consume");

          // Create a consumer on the consumer transport
          consumer = await consumerTransport?.consume({
            producerId: producer?.id,
            rtpCapabilities,
            // Pause the consumer initially if it's a video consumer
            // This can help save bandwidth until the video is actually needed
            paused: producer?.kind === "video",
          });

          // Event handler for transport closure
          // This helps ensure that resources are cleaned up when the transport is closed
          consumer?.on("transportclose", () => {
            console.log("Consumer transport closed");
            consumer?.close();
          });

          // Event handler for producer closure
          // This helps ensure that the consumer is closed when the producer is closed
          consumer?.on("producerclose", () => {
            console.log("Producer closed");
            consumer?.close();
          });

          // Invoke the callback with the consumer parameters
          // This allows the client to configure the consumer on its end
          callback({
            params: {
              producerId: producer?.id,
              id: consumer?.id,
              kind: consumer?.kind,
              rtpParameters: consumer?.rtpParameters,
            },
          });
        }
      } catch (error) {
        // Handle any errors that occur during the consume process
        console.error("Error consuming:", error);
        callback({
          params: {
            error,
          },
        });
      }
    });

    /**
     * Event handler for resuming media consumption.
     * This function resumes media reception if it was previously paused.
     */
    socket.on("resumePausedConsumer", async () => {
      console.log("consume-resume");
      await consumer?.resume();
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://localhost:${port} as ${
          dev ? "development" : process.env.NODE_ENV
        }`
      );
    });
});
