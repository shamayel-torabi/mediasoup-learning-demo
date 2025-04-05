"use client";

import { useMediaContext } from "@/components/MediaProvider";
import { useRef } from "react";

export default function Home() {
  const localvideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const { startPublish, startConsume } = useMediaContext();

  return (
    <main className="flex flex-col h-screen">
      <header className="bg-gray-300 min-h-16 shadow-2xl">
        <nav className="py-2 flex items-center justify-center gap-2" dir="ltr">
          <button onClick={() => startPublish(localvideoRef)}>
            Publish
          </button>
          <button onClick={() => startConsume(remoteVideoRef)}>Consume</button>
        </nav>
      </header>
      <section className="overflow-y-auto">
        <div className="flex items-center justify-center gap-2 mt-5">
          <div>
            <video ref={localvideoRef} id="localvideo" autoPlay playsInline />
          </div>
          <div>
            <video ref={remoteVideoRef} id="remotevideo" autoPlay playsInline />
          </div>
        </div>
      </section>
    </main>
  );
}
