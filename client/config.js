export const config = {
  workerSettings: {
    rtcMinPort: 40000,
    rtcMaxPort: 41000,
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  routerMediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
      preferredPayloadType: 96, // Example value
      rtcpFeedback: [{ type: "nack" }, { type: "nack", parameter: "pli" }],
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {
        "x-google-start-bitrate": 1000,
      },
      preferredPayloadType: 97,
      rtcpFeedback: [
        { type: "nack" },
        { type: "ccm", parameter: "fir" },
        { type: "goog-remb" },
      ],
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
      },
    },
  ],
  webRtcTransport: {
    listenIps: [
      {
        ip: "0.0.0.0", // replace with relevant IP address
        announcedIp: "127.0.0.1",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    maxIncomingBitrate: 5000000, // 5 Mbps, default is INF
    initialAvailableOutgoingBitrate: 5000000, // 5 Mbps, default is 600000
  },
};
