import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react'
import { io, Socket } from 'socket.io-client';

type Message = {
    id: string,
    text: string
}

type MediaContextType = {
    messages: Message[],
    sendMessage: (message: string) => Promise<void>,
}


interface ServerToClientEvents {
    "connection-success": (data: { socketId: string, messages: Message[] }) => void,
    "newMessage" : (message: { id: string, text: string}) => void;
}

interface ClientToServerEvents {
    'sendMessage': (message: string) => void,
}

const MediaContext = createContext<MediaContextType>({} as MediaContextType)

export default function MediaProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents>>();
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3031');

        setSocket(socket);
        socket.on("connection-success", (data) => {
            console.log(`socket connection Id: ${data.socketId}`)
            setMessages(data.messages);
        });
        socket.on("newMessage", (message) =>{
            setMessages(prev => [...prev, message])
        })
        return () => { socket.disconnect(); };
    }, []);

    const sendMessage = async (message: string) => {
       socket?.emit('sendMessage', message);
    }

    const contextValue: MediaContextType = {
        messages,
        sendMessage
    }
    return (
        <MediaContext value={contextValue}>
            {children}
        </MediaContext>
    )
}

export const useMediaContext = () => {
    const context = useContext(MediaContext);
    if (!context){
        throw new Error('MediaProvider not set');
    }

    return context;
}