import { Outlet } from "react-router";

// export function Layout({ children }: { children: React.ReactNode }) {
//   return children
// }

export default function Root() {
  return (
      <main className="overflow-y-auto">
        <Outlet />
      </main>
  );
}

