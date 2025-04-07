"use client";

import {
    AppData,
    Device,
    DtlsParameters,
    IceCandidate,
    IceParameters,
    MediaKind,
    ProducerOptions,
    RtpCapabilities,
    RtpParameters,
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
type ModeType = 'Publish' | 'Consume' | 'None'

type PayloadType = MediaStreamTrack | Device | Transport<AppData> | HTMLVideoElement | ModeType | undefined;


interface MediaAction {
    type: ActionType;
    payload: PayloadType;
}

interface MediaState {
    params: ProducerOptions;
    mode: ModeType
    device?: Device;
    producerTransport?: Transport<AppData>,
    consumerTransport?: Transport<AppData>,
    localVideo?: HTMLVideoElement,
    remoteVideo?: HTMLVideoElement,
}

interface ServerToClientEvents {
    "connection-success": (data: {socketId: string}) => void
}

interface ClientToServerEvents {
    'getRouterRtpCapabilities': (callback: (params: { routerRtpCapabilities: RtpCapabilities; }) => Promise<void>) => void,
    'createTransport': ({ sender }: { sender: boolean }, callback: (params: {
        id: string; iceParameters: IceParameters; iceCandidates: IceCandidate[]; dtlsParameters: DtlsParameters; error?: unknown;
    }
    ) => void) => void,
    'consumeMedia': (data: { rtpCapabilities: RtpCapabilities }, callback: (params: {
        producerId: string, id: string, kind: MediaKind, rtpParameters: RtpParameters, error?: unknown
    }
    ) => Promise<void>) => void,
    'connectProducerTransport': (data: { dtlsParameters: DtlsParameters }) => void,
    'transport-produce': (data: { kind: MediaKind; rtpParameters: RtpParameters }, callback: (params: { id: string }) => void) => void,
    'connectConsumerTransport': (data: { dtlsParameters: DtlsParameters }) => void,
    'resumePausedConsumer': (callback: () => void) => void,
}

function mediaReducer(state: MediaState, action: MediaAction): MediaState {
    const { type, payload } = action;
    switch (type) {
        case ActionType.SET_MEDIA_TRACK:
            return { ...state, params: { ...state.params, track: payload as MediaStreamTrack } };
        case ActionType.SET_DEVICE:
            return { ...state, device: payload as Device };
        case ActionType.SET_PRODUCER_TRANSPORT:
            return { ...state, producerTransport: payload as Transport<AppData> };
        case ActionType.SET_CONSUMER_TRANSPORT:
            return { ...state, consumerTransport: payload as Transport<AppData> };
        case ActionType.SET_LOCAL_VIDEO:
            return { ...state, localVideo: payload as HTMLVideoElement };
        case ActionType.SET_REMOTE_VIDEO:
            return { ...state, remoteVideo: payload as HTMLVideoElement };
        case ActionType.SET_MODE:
            return { ...state, mode: payload as ModeType };
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

export default function MediaProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [state, dispatch] = useReducer(mediaReducer, initialState);

    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents>>();

    useEffect(() => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('/mediasoup');

        setSocket(socket);
        socket.on("connection-success", (data) => {
            console.log(`socket connection Id: ${data.socketId}`)
        });
        return () => { socket.disconnect(); };
    }, []);


    useEffect(() => {
        if (!state.localVideo)
            return;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: {
                        width: {
                            min: 640,
                            max: 1920,
                        },
                        height: {
                            min: 400,
                            max: 1080,
                        }
                    }
                });
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
                    createSendTransport();
                    return;
                case 'Consume':
                    createRecvTransport();
                    return;
                default:
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
        try {
            const params = await socket!.emitWithAck("getRouterRtpCapabilities");
            const newDevice = new Device();
            await newDevice.load({ routerRtpCapabilities: params.routerRtpCapabilities });
            dispatch({ type: ActionType.SET_DEVICE, payload: newDevice });
        } catch (error: unknown) {
            console.log(error);
            if (error instanceof Error && error.name === "UnsupportedError") {
                console.error("Browser not supported");
            }
        }
    };

    const createSendTransport = async () => {
        const params = await socket!.emitWithAck("createTransport", { sender: true });

        if (params.error) {
            console.log(`createSendTransport callback error: ${params.error}`);
            return;
        }

        /**
         * Replicate the send transport on the client-side.
         * The `device.createSendTransport` method creates a send transport instance on the client-side
         * using the parameters provided by the server.
         */
        const transport = state.device!.createSendTransport(params);
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
            async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: () => void, errback: (error: Error) => void) => {
                try {
                    console.log("----------> producer transport has connected");
                    // Notify the server that the transport is ready to connect with the provided DTLS parameters
                    socket?.emit("connectProducerTransport", { dtlsParameters });
                    // Callback to indicate success
                    callback();
                } catch (error) {
                    // Errback to indicate failure
                    errback(error as Error);
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
            async (
                parameters: { kind: MediaKind; rtpParameters: RtpParameters; appData: AppData; },
                callback: ({ id }: { id: string }) => void,
                errback: (error: Error) => void
            ) => {
                const { kind, rtpParameters } = parameters;

                console.log("----------> transport-produce");

                try {
                    // Notify the server to start producing media with the provided parameters
                    socket?.emit(
                        "transport-produce",
                        { kind, rtpParameters },
                        ({ id }) => {
                            // Callback to provide the server-generated producer ID back to the transport
                            callback({ id });
                        }
                    );
                } catch (error: unknown) {
                    // Errback to indicate failure
                    errback(error as Error);
                }
            }
        );

        // Request the server to create a send transport
        // socket?.emit(
        //     "createTransport",
        //     { sender: true },
        //     ({
        //         params,
        //     }: {
        //         params: {
        //             id: string; iceParameters: IceParameters; iceCandidates: IceCandidate[]; dtlsParameters: DtlsParameters; error?: unknown;
        //         }
        //     }) => {
        //         if (params.error) {
        //             console.log(`createSendTransport callback error: ${params.error}`);
        //             return;
        //         }

        //         /**
        //          * Replicate the send transport on the client-side.
        //          * The `device.createSendTransport` method creates a send transport instance on the client-side
        //          * using the parameters provided by the server.
        //          */
        //         const transport = state.device!.createSendTransport(params);
        //         console.log(`transport create:${transport}`)

        //         // Update the state to hold the reference to the created transport
        //         dispatch({ type: ActionType.SET_PRODUCER_TRANSPORT, payload: transport })

        //         /**
        //          * Event handler for the "connect" event on the transport.
        //          * This event is triggered when the transport is ready to be connected.
        //          * The `dtlsParameters` are provided by the transport and are required to establish
        //          * the DTLS connection between the client and the server.
        //          * This event it emitted as a result of calling the `producerTransport?.produce(params)`
        //          * method in the next step. The event will only be emitted if this is the first time
        //          */
        //         transport?.on(
        //             "connect",
        //             async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: () => void, errback: (error: Error) => void) => {
        //                 try {
        //                     console.log("----------> producer transport has connected");
        //                     // Notify the server that the transport is ready to connect with the provided DTLS parameters
        //                     socket?.emit("connectProducerTransport", { dtlsParameters });
        //                     // Callback to indicate success
        //                     callback();
        //                 } catch (error) {
        //                     // Errback to indicate failure
        //                     errback(error as Error);
        //                 }
        //             }
        //         );

        //         /**
        //          * Event handler for the "produce" event on the transport.
        //          * This event is triggered when the transport is ready to start producing media.
        //          * The `parameters` object contains the necessary information for producing media,
        //          * including the kind of media (audio or video) and the RTP parameters.
        //          * The event is emitted as a result of calling the `producerTransport?.produce(params)`
        //          * method in the next step.
        //          */
        //         transport?.on(
        //             "produce",
        //             async (
        //                 parameters: { kind: MediaKind; rtpParameters: RtpParameters; appData: AppData; },
        //                 callback: ({ id }: { id: string }) => void,
        //                 errback: (error: Error) => void
        //             ) => {
        //                 const { kind, rtpParameters } = parameters;

        //                 console.log("----------> transport-produce");

        //                 try {
        //                     // Notify the server to start producing media with the provided parameters
        //                     socket?.emit(
        //                         "transport-produce",
        //                         { kind, rtpParameters },
        //                         ({ id }) => {
        //                             // Callback to provide the server-generated producer ID back to the transport
        //                             callback({ id });
        //                         }
        //                     );
        //                 } catch (error: unknown) {
        //                     // Errback to indicate failure
        //                     errback(error as Error);
        //                 }
        //             }
        //         );
        //     }
        // );
    };

    const connectSendTransport = async () => {
        /**
         * This instructs the transport to start sending media to the router.
         * The transport will emit a "connect" event if this is the first time the transport is being connected.
         * Before this method completes, the transport will emit a "produce" event which was
         * was subscribed to in the previous step so the application will transmit the event parameters to the server.
         * */
        const localProducer = await state.producerTransport?.produce(state.params);

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
            ({ params }: {
                params: {
                    id: string; iceParameters: IceParameters; iceCandidates: IceCandidate[]; dtlsParameters: DtlsParameters; error?: unknown;
                }
            }) => {
                if (params.error) {
                    console.log(`createRecvTransport callback error: ${params.error}`);
                    return;
                }

                // Creating a receive transport on the client-side using the server-provided parameters
                const transport = state.device?.createRecvTransport(params);
                dispatch({ type: ActionType.SET_CONSUMER_TRANSPORT, payload: transport })
                console.log(`createRecvTransport transport:${transport}`)

                /**
                 * This event is triggered when "consumerTransport.consume" is called
                 * for the first time on the client-side.
                 * */
                transport?.on(
                    "connect",
                    async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: () => void, errback: (error: Error) => void) => {
                        try {
                            // Notifying the server to connect the receive transport with the provided DTLS parameters
                            socket.emit("connectConsumerTransport", { dtlsParameters });
                            console.log("----------> consumer transport has connected");
                            callback();
                        } catch (error: unknown) {
                            errback(error as Error);
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
            { rtpCapabilities: state.device?.rtpCapabilities as RtpCapabilities },
            async ({ params }: {
                params: {
                    producerId: string,
                    id: string,
                    kind: MediaKind,
                    rtpParameters: RtpParameters,
                    error: unknown
                }
            }) => {
                if (params.error) {
                    console.log(params.error);
                    return;
                }

                // Consuming media using the receive transport
                const consumer = await state.consumerTransport?.consume({
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
            dispatch({ type: ActionType.SET_LOCAL_VIDEO, payload: localvideoRef.current })
            await createDevice();
            dispatch({ type: ActionType.SET_MODE, payload: 'Publish' })
        }
    }, [])

    const startConsume = useCallback(async (remoteVideoRef: RefObject<HTMLVideoElement | null>) => {
        if (remoteVideoRef.current) {
            dispatch({ type: ActionType.SET_LOCAL_VIDEO, payload: remoteVideoRef.current })
            await createDevice();
            dispatch({ type: ActionType.SET_MODE, payload: 'Consume' })
        }
    }, [])

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
