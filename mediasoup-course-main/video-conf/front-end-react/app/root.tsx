import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import MediaProvider from "./components/MediaProvider";
import AuthProvider from "./components/AuthProvider";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <div className="flex flex-col h-screen overflow-y-auto">
      <AuthProvider>
        <MediaProvider>
          <Outlet />
        </MediaProvider>
      </AuthProvider>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "خطا";
  let details = "یک خطای غیر منتظره رخ داده است.";
  let stack: string | undefined;
  let isError = false;

  if (isRouteErrorResponse(error)) {
    isError = error.status !== 404;
    message = isError ? "خطا" : "404";
    details = !isError
      ? "صفحه مورد نظر پیدا نشد."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    isError = true;
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="grid items-center justify-center h-screen overflow-y-auto">
      <section>
        <h1 className={`text-4xl text-center mb-4 ${isError ? 'text-red-600' : 'text-yellow-800'}`}>{message}</h1>
        <p className="text-2xl mb-4  text-gray-900 dark:text-white">{details}</p>
        <div className="text-center  text-gray-900 dark:text-white mb-4">
          <Link className="text-3xl" to="/">بازگشت به خانه</Link>
        </div>
        <div className="mb-1 overflow-y-auto">
          {stack && (
            <pre className="w-full text-gray-900 dark:text-gray-50" dir="ltr">
              <code>{stack}</code>
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}
