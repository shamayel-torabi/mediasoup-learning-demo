import { Outlet } from "react-router";
import Header from "~/components/Header";

export default function Root() {
    return (
        <>
            <Header />
            <main className="overflow-y-auto">
                <Outlet />
            </main>
        </>
    );
}