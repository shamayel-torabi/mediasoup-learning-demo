import { useState } from "react"
import { NavLink, useNavigate } from "react-router"
import { useAuth } from "./AuthProvider"

const MenuItem = ({ url, title, onClick }: { url: string, title: string, onClick: () => void }) => {
    return (
        <li onClick={() => onClick()}>
            <NavLink
                className="block py-2 px-3 rounded-sm md:bg-transparent text-blue-950 md:p-0 dark:text-white md:dark:text-blue-500"
                to={url}>{title}
            </NavLink>
        </li>
    )
}

const AuthStatus = () => {
    let auth = useAuth();
    let navigate = useNavigate();

    if (!auth.user) {
        return (
            <li>
                <NavLink
                    className="block py-2 px-3 rounded-sm md:bg-transparent text-blue-950 md:p-0 dark:text-white md:dark:text-blue-500"
                    to='/login'>ورود
                </NavLink>
            </li>
        )
    }

    return (
        <li >
            <span
                className="cursor-pointer block py-2 px-3 rounded-sm md:bg-transparent text-blue-950 md:p-0 dark:text-white md:dark:text-blue-500"
                onClick={() => { auth.signout(() => navigate("/")); }}
            >
                خروج
            </span>
        </li>

    );
}
export default function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    return (
        <header className="max-h-16 bg-gray-200 border-gray-400 dark:bg-gray-800">
            <nav className="max-w-screen-x min-h-(--header-height)">
                <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                    <NavLink className="flex items-center space-x-3" to="/">
                        <img src="/vite.svg" className="h-8" alt="Flowbite Logo" />
                        <span className="self-center text-2xl font-semibold whitespace-nowrap text-sky-950 dark:text-white ml-2 rtl:mr-2">ویدئو کنفرانس</span>
                    </NavLink>

                    <button onClick={() => setMobileMenuOpen(m => !m)} type="button" className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-900 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-50 dark:focus:ring-gray-600" aria-controls="navbar-default" aria-expanded="false">
                        <span className="sr-only">Open main menu</span>
                        <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1h15M1 7h15M1 13h15" />
                        </svg>
                    </button>
                    <div className={`w-full md:block md:w-auto ${mobileMenuOpen ? "" : "hidden"}`}>
                        <div className="flex flex-col items-center md:flex-row gap-2">
                            <ul className="font-medium w-full flex flex-col p-2 md:p-0 mt-4 border border-gray-100 rounded-lg md:flex-row md:space-x-4 md:mt-0 md:border-0 bg-gray-100 md:bg-gray-200 dark:bg-gray-600  md:dark:bg-gray-800 dark:border-gray-700">
                                <MenuItem url="/" title="خانه" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/users" title="کاربران" onClick={() => setMobileMenuOpen(false)} />
                                <AuthStatus />

                                {/* <MenuItem url="/products" title="محصولات" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/posts" title="بارگذاری داده" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/api-test" title="تست" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/gallery" title="گالری" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/about" title="درباره" onClick={() => setMobileMenuOpen(false)} />
                                <MenuItem url="/contact" title="تماس با ما" onClick={() => setMobileMenuOpen(false)} /> */}
                            </ul>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}

