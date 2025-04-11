import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import type {  User } from "~/types";
import { jwtDecode } from "jwt-decode";

interface AuthContextType {
    user: User | null;
    signin: (token: string, callback: VoidFunction) => void;
    signout: (callback: VoidFunction) => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User|null>(null)

    // synchronize initially
    useLayoutEffect(() => {
        const userString = window.localStorage.getItem("localUser");
        if (userString) {
            const u = JSON.parse(userString) as User;
            setUser(u)
        }
    }, []);

    // synchronize on change
    useEffect(() => {
        const userString = JSON.stringify(user)
        window.localStorage.setItem("localUser", userString);
    }, [user]);

    const signin = (token: string, callback: VoidFunction) => {
        const user = jwtDecode<User>(token);
        setUser(user);
        callback();
    }

    const signout = (callback: VoidFunction) => {
        setUser(null);
        callback();
    };

    const value = { user, signin, signout };

    return (
        <AuthContext value={value}>
            {children}
        </AuthContext>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error('AuthProvider not set');

    return context;
}