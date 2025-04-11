import { useMediaContext } from "~/components/MediaProvider";
import type { Route } from "./+types/_dashboard._index";
import { useAuth } from "~/components/AuthProvider";
import { Card } from "~/components/Card";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "ویدئو کنفرانس" },
    { name: "description", content: "Video Conferencing App" },
  ];
}


export default function Home() {
  const { messages, sendMessage } = useMediaContext()

  const handleSubmit = async (e: React.FocusEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string;
    if (message) {
      await sendMessage(message);
      e.target.reset()
    }
  }

  return (
    <section className="h-(--page--height) grid items-stretch">
      <Card className="h-full overflow-y-auto border-md">
        <ul className="my-2">
          {messages.map((m) => <li className="text-gray-900 dark:text-gray-50" key={m.id}>{m.text}</li>)}
        </ul>
      </Card>
      <Card className="px-1 py-2">
        <form onSubmit={handleSubmit}>
          <div className="flex">
            <input type="text" name="message" id="message" className="rounded-none rounded-s-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="پیام را وارد کنید" />
            <button type="submit" className="inline-flex items-center cursor-pointer px-3 text-sm text-gray-900 bg-gray-200 border rounded-e-lg border-gray-300 border-s-0 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rtl:rotate-180 text-gray-500 hover:text-gray-50 dark:text-gray-400" fill="currentColor">
                <path d="m27.45 15.11-22-11a1 1 0 0 0 -1.08.12 1 1 0 0 0 -.33 1l2.96 10.77-3 10.74a1 1 0 0 0 1 1.26 1 1 0 0 0 .45-.11l22-11a1 1 0 0 0 0-1.78zm-20.9 10 2.21-8.11h9.24v-2h-9.24l-2.21-8.11 18.21 9.11z" />
                <path d="m0 0h32v32h-32z" fill="none" />
              </svg>
            </button>
          </div>
        </form>
      </Card>
    </section>
  )
}
