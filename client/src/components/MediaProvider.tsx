"use client";

import {
    AppData,
    Device,
    DtlsParameters,
    IceCandidate,
    IceParameters,
    ProducerOptions,
    RtpCapabilities,
    Transport
} from 'mediasoup-client/types'
import {
    createContext,
    RefObject,
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useState
} from 'react'
import { io, Socket } from 'socket.io-client';

type MediaContextType = {
    startPublish: (localvideoRef: RefObject<HTMLVideoElement | null>) => Promise<void>,
    startConsume: (remoteVideoRef: RefObject<HTMLVideoElement | null>) => Promise<void>,
}

enum ActionType {
    SET_MEDIA_TRACK = 'SET_MEDIA_TRACK',
    SET_DEVICE = 'SET_DEVICE',
    SET_PRODUCER_TRANSPORT = 'SET_PRODUCER_TRANSPORT',
    SET_CONSUMER_TRANSPORT = 'SET_CONSUMER_TRANSPORT',
    SET_MODE = 'SET_MODE',
    SET_LOCAL_VIDEO = 'SET_LOCAL_VIDEO',
    SET_REMOTE_VIDEO = 'SET_REMOTE_VIDEO'
}

interface MediaAction {
    type: ActionType;
    payload: any;
}

interface MediaState {
    params: ProducerOptions;
    mode: 'Publish' | 'Consume' | 'None'
    device?: Device;
    producerTransport?: Transport<AppData>,
    consumerTransport?: Transport<AppData>,
    localVideo?: HTMLVideoElement,
    remoteVideo?: HTMLVideoElement,
}

interface ServerToClientEvents {
    "connection-success": (data: any) => void
}

interface ClientToServerEvents {
    'getRouterRtpCapabilities': (data: any) => void,
    'createTransport': (data: any, callback: (params: any) => void) => void,
    'consumeMedia': (data: any, callback: (params: any) => Promise<void>) => void,
    'connectProducerTransport': (data: any) => void,
    'transport-produce': (data: any, callback: (params: any) => void) => void,
    'connectConsumerTransport': (data: any) => void,
    'resumePausedConsumer': (callback: (params: any) => void) => void,
}

function mediaReducer(state: MediaState, action: MediaAction): MediaState {
    const { type, payload } = action;
    switch (type) {
        case ActionType.SET_MEDIA_TRACK:
            return { ...state, params: { ...state.params, track: payload } };
        case ActionType.SET_DEVICE:
            return { ...state, device: payload };
        case ActionType.SET_PRODUCER_TRANSPORT:
            return { ...state, producerTransport: payload };
        case ActionType.SET_CONSUMER_TRANSPORT:
            return { ...state, consumerTransport: payload };
        case ActionType.SET_LOCAL_VIDEO:
            return { ...state, localVideo: payload };
        case ActionType.SET_REMOTE_VIDEO:
            return { ...state, remoteVideo: payload };
        case ActionType.SET_MODE:
            return { ...state, mode: payload };
        default:
            return state;
    }
}

const initialState: MediaState = {
    params: {
        encodings: [
            { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" }, // Lowest quality layer
            { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" }, // Middle quality layer
            { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" }, // Highest quality layer
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 }, // Initial bitrate
    },
    mode: 'None'
}

const MediaContext = createContext<MediaContextType>({} as MediaContextType)

export default function MediaProvider({ children, url }: Readonly<{ children: React.ReactNode; url: string }>) {
    const [state, dispatch] = useReducer(mediaReducer, initialState);

    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

    useEffect(() => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url);

        setSocket(socket);
        socket.on("connection-success", (data) => {
            console.log("connection-success")
        });
        return () => { socket.disconnect(); };
    }, []);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (state.localVideo) {
                    const track = stream.getVideoTracks()[0];
                    state.localVideo.srcObject = stream;
                    setParamTrack(track);
                }
            } catch (error) {
                console.error("Error accessing camera:", error);
            }
        };

        startCamera();
    }, [state.localVideo])

    useEffect(() => {
        if (state.device) {
            switch (state.mode) {
                case 'Publish':
                    console.log('run createSendTransport')
                    createSendTransport();
                    return;
                case 'Consume':
                    console.log('run createRecvTransport')
                    createRecvTransport();
                    return;
                default:
                    console.log('Mode.NONE')
                    return;
            }
        }
    }, [state.mode])

    useEffect(() => {
        if (state.producerTransport)
            connectSendTransport();
    }, [state.producerTransport])

    useEffect(() => {
        if (state.producerTransport)
            connectRecvTransport();
    }, [state.consumerTransport])

    const setParamTrack = (track: MediaStreamTrack) => {
        dispatch({
            type: ActionType.SET_MEDIA_TRACK,
            payload: track
        });
    }

    const createDevice = async () => {
        socket?.emit("getRouterRtpCapabilities", async (data: any) => {
            try {
                const newDevice = new Device();
                await newDevice.load({ routerRtpCapabilities: data.routerRtpCapabilities });
                dispatch({ type: ActionType.SET_DEVICE, payload: newDevice });
            } catch (error: any) {
                console.log(error);
                if (error.name === "UnsupportedError") {
                    console.error("Browser not supported");
                }
            }
        });
    };

    const createSendTransport = async () => {
        // Request the server to create a send transport
        socket?.emit(
            "createTransport",
            { sender: true },
            ({
                params,
            }: {
                params: {
                    /**
                     * A unique identifier generated by mediasoup for the transport.
                     * Necessary for differentiating between multiple transports.
                     */
                    id: string;
                    /**
                     * Interactive Connectivity Establishment (ICE) parameters.
                     * Necessary for the negotiation of network connections.
                     */
                    iceParameters: IceParameters;
                    /**
                     * Array of ICE candidates.
                     * Necessary for establishing network connectivity through NATs and firewalls.
                     */
                    iceCandidates: IceCandidate[];
                    /**
                     * Datagram Transport Layer Security (DTLS) parameters.
                     * Necessary for securing the transport with encryption.
                     */
                    dtlsParameters: DtlsParameters;
                    /**
                     * Error object if any error occurs during transport creation.
                     * */
                    error?: unknown;
                };
            }) => {
                if (params.error) {
                    console.log(`createSendTransport callback error: ${params.error}`);
                    return;
                }

                /**
                 * Replicate the send transport on the client-side.
                 * The `device.createSendTransport` method creates a send transport instance on the client-side
                 * using the parameters provided by the server.
                 */
                let transport = state.device!.createSendTransport(params);
                console.log(`transport create:${transport}`)

                // Update the state to hold the reference to the created transport
                dispatch({ type: ActionType.SET_PRODUCER_TRANSPORT, payload: transport })

                /**
                 * Event handler for the "connect" event on the transport.
                 * This event is triggered when the transport is ready to be connected.
                 * The `dtlsParameters` are provided by the transport and are required to establish
                 * the DTLS connection between the client and the server.
                 * This event it emitted as a result of calling the `producerTransport?.produce(params)`
                 * method in the next step. The event will only be emitted if this is the first time
                 */
                transport?.on(
                    "connect",
                    async ({ dtlsParameters }: any, callback: any, errback: any) => {
                        try {
                            console.log("----------> producer transport has connected");
                            // Notify the server that the transport is ready to connect with the provided DTLS parameters
                            socket?.emit("connectProducerTransport", { dtlsParameters });
                            // Callback to indicate success
                            callback();
                        } catch (error) {
                            // Errback to indicate failure
                            errback(error);
                        }
                    }
                );

                /**
                 * Event handler for the "produce" event on the transport.
                 * This event is triggered when the transport is ready to start producing media.
                 * The `parameters` object contains the necessary information for producing media,
                 * including the kind of media (audio or video) and the RTP parameters.
                 * The event is emitted as a result of calling the `producerTransport?.produce(params)`
                 * method in the next step.
                 */
                transport?.on(
                    "produce",
                    async (parameters: any, callback: any, errback: any) => {
                        const { kind, rtpParameters } = parameters;

                        console.log("----------> transport-produce");

                        try {
                            // Notify the server to start producing media with the provided parameters
                            socket?.emit(
                                "transport-produce",
                                { kind, rtpParameters },
                                ({ id }: any) => {
                                    // Callback to provide the server-generated producer ID back to the transport
                                    callback({ id });
                                }
                            );
                        } catch (error) {
                            // Errback to indicate failure
                            errback(error);
                        }
                    }
                );
            }
        );
    };

    const connectSendTransport = async () => {
        /**
         * This instructs the transport to start sending media to the router.
         * The transport will emit a "connect" event if this is the first time the transport is being connected.
         * Before this method completes, the transport will emit a "produce" event which was
         * was subscribed to in the previous step so the application will transmit the event parameters to the server.
         * */
        let localProducer = await state.producerTransport?.produce(state.params);

        // Event handlers for track ending and transport closing events
        localProducer?.on("trackended", () => {
            console.log("trackended");
        });
        localProducer?.on("transportclose", () => {
            console.log("transportclose");
        });
    };

    const createRecvTransport = async () => {
        // Requesting the server to create a receive transport
        socket?.emit(
            "createTransport",
            { sender: false },
            ({ params }: { params: any }) => {
                if (params.error) {
                    console.log(`createRecvTransport callback error: ${params.error}`);
                    return;
                }

                // Creating a receive transport on the client-side using the server-provided parameters
                let transport = state.device?.createRecvTransport(params);
                dispatch({ type: ActionType.SET_CONSUMER_TRANSPORT, payload: transport })
                console.log(`createRecvTransport transport:${transport}`)

                /**
                 * This event is triggered when "consumerTransport.consume" is called
                 * for the first time on the client-side.
                 * */
                transport?.on(
                    "connect",
                    async ({ dtlsParameters }: any, callback: any, errback: any) => {
                        try {
                            // Notifying the server to connect the receive transport with the provided DTLS parameters
                            socket.emit("connectConsumerTransport", { dtlsParameters });
                            console.log("----------> consumer transport has connected");
                            callback();
                        } catch (error) {
                            errback(error);
                        }
                    }
                );
            }
        );
    };

    const connectRecvTransport = async () => {
        // Requesting the server to start consuming media
        socket?.emit(
            "consumeMedia",
            { rtpCapabilities: state.device?.rtpCapabilities },
            async ({ params }: any) => {
                if (params.error) {
                    console.log(params.error);
                    return;
                }

                // Consuming media using the receive transport
                let consumer = await state.consumerTransport?.consume({
                    id: params.id,
                    producerId: params.producerId,
                    kind: params.kind,
                    rtpParameters: params.rtpParameters,
                });

                // Accessing the media track from the consumer
                const { track } = consumer!;
                console.log("************** track", track!);

                if (state.remoteVideo) {
                    state.remoteVideo.srcObject = new MediaStream([track]);
                }

                // Notifying the server to resume media consumption
                socket.emit("resumePausedConsumer", () => { });
                console.log("----------> consumer transport has resumed");
            }
        );
    };

    const startPublish = useCallback(async (localvideoRef: RefObject<HTMLVideoElement | null>) => {
        if (localvideoRef.current) {
            dispatch({type: ActionType.SET_LOCAL_VIDEO, payload: localvideoRef.current})
            await createDevice();
            dispatch({type: ActionType.SET_MODE, payload: 'Publish'})
        }
    },[])

    const startConsume = useCallback(async (remoteVideoRef: RefObject<HTMLVideoElement | null>) => {
        if (remoteVideoRef.current) {
            dispatch({type: ActionType.SET_LOCAL_VIDEO, payload: remoteVideoRef.current})
            await createDevice();
            dispatch({type: ActionType.SET_MODE, payload: 'Consume'})
        }
    },[])

    const contextValue: MediaContextType = {
        startPublish,
        startConsume
    }
    return (
        <MediaContext value={contextValue}>
            {children}
        </MediaContext>
    )
}

export const useMediaContext = () => {
    const context = useContext(MediaContext);
    if (!context)
        throw new Error('MediaProvider not set');

    return context;
}
