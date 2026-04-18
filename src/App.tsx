import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signInWithGoogle, logOut } from "./lib/firebase";
import { ChatInterface } from "./components/chat-interface";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, MessageSquare } from "lucide-react";
import { useChat } from "./hooks/useChat";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { 
    messages, setMessages, sendMessage, isTyping, 
    sessions, currentSessionId, setCurrentSessionId, createNewSession 
  } = useChat();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-ink flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-theme-neon animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-theme-ink flex flex-col items-center justify-center text-theme-paper p-4 font-theme-black">
        <div className="max-w-md w-full bg-theme-gray border-4 border-theme-neon p-8 flex flex-col items-center text-center shadow-2xl relative shadow-theme-neon/20">
           <div className="absolute top-0 right-0 bg-theme-neon text-theme-ink text-[10px] px-2 py-1 uppercase tracking-wider">SECURE</div>
           <h1 className="text-6xl italic tracking-tighter text-theme-paper uppercase mb-4 mt-4 text-theme-neon">Kick Ass</h1>
           <p className="text-[#AAA] mb-8 font-theme-sans text-[14px]">"ULTIMATE ARBITER OF ABSURDITY."</p>
           
           <Button onClick={signInWithGoogle} size="lg" className="w-full bg-theme-crimson text-theme-paper hover:bg-theme-crimson/90 font-theme-black uppercase tracking-wider rounded-none border-none shadow-[0_6px_0_#800000] hover:translate-y-[2px] hover:shadow-[0_4px_0_#800000] active:translate-y-[6px] active:shadow-none transition-all py-6">
              Initialize Protocol
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-theme-ink text-theme-paper font-theme-black overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr_280px] grid-rows-[auto_1fr_auto] md:grid-rows-[100px_1fr_80px]">
      
      {/* HEADER */}
      <header className="col-span-full bg-theme-neon text-theme-ink flex items-center justify-between px-4 md:px-10 border-b-[4px] border-theme-ink shrink-0 h-[100px]">
        <div className="text-4xl md:text-[60px] tracking-[-4px] italic uppercase leading-none">Kick Ass</div>
        <div className="text-[10px] md:text-[14px] max-w-[300px] leading-[1.1] text-right uppercase hidden sm:block">
          ULTIMATE ARBITER OF ABSURDITY.<br/>
          CROSS-PLATFORM STUPIDITY EVALUATION ENGINE.
        </div>
      </header>

      {/* LEFT COLUMN - Archives */}
      <aside className="hidden md:flex border-r-[2px] border-theme-gray p-[20px] flex-col gap-[20px] overflow-y-auto">
        <div className="flex justify-between items-center">
            <div className="text-[10px] tracking-[2px] text-theme-neon uppercase">Protocols</div>
            <Button onClick={createNewSession} variant="ghost" size="icon" className="h-6 w-6 rounded-none text-theme-neon hover:bg-theme-neon hover:text-theme-ink">
                <Plus className="w-4 h-4" />
            </Button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {sessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`p-3 border-l-2 cursor-pointer font-theme-sans text-[12px] truncate ${currentSessionId === s.id ? 'border-theme-neon bg-theme-gray text-theme-neon font-bold' : 'border-transparent text-[#AAA] hover:bg-theme-gray/50'}`}
                >
                   <MessageSquare className="w-3 h-3 inline-block mr-2" />
                   {s.title}
                </div>
            ))}
        </div>

        <div className="bg-theme-gray p-[15px] rounded mt-auto shrink-0">
            <div className="text-[10px] tracking-[2px] text-theme-neon uppercase mb-[10px]">Session User</div>
            <div className="text-[14px] text-theme-neon truncate block">{user.displayName}</div>
        </div>
        <div className="text-[10px] text-[#444] shrink-0">
            v1.0.5-STABLE // BUILD_absurdity
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="p-4 md:p-[30px] flex flex-col justify-between bg-[radial-gradient(circle_at_center,#111_0%,#000_100%)] relative min-h-0 overflow-hidden">
         <div className="absolute top-[5px] right-[5px] z-10 flex items-center gap-2">
            <Button onClick={logOut} variant="ghost" size="sm" className="bg-theme-gray border-none text-theme-paper hover:bg-theme-neon hover:text-theme-ink uppercase font-theme-black text-[10px] rounded-none">SIGN OUT</Button>
         </div>
         <ChatInterface 
            messages={messages} 
            sendMessage={sendMessage} 
            isTyping={isTyping} 
         />
      </main>

      {/* RIGHT COLUMN - Hidden on small screens */}
      <aside className="hidden md:flex border-l-[2px] border-theme-gray p-[20px] flex-col items-center gap-[30px] overflow-y-auto">
          <div className="text-[10px] tracking-[2px] text-theme-neon uppercase">Stupidity Index</div>
          <div className="w-[180px] h-[180px] border-[8px] border-theme-gray rounded-full flex flex-col items-center justify-center relative shrink-0">
             <div className="absolute w-full h-full rounded-full border-[8px] border-theme-crimson top-[-8px] left-[-8px]" style={{ clipPath: 'inset(10% 0 0 0)'}}></div>
             <div className="text-[54px] text-theme-crimson leading-none">
                 {[...messages].reverse().find(m => m.isStupidScore !== undefined)?.isStupidScore ?? 0}%
             </div>
             <div className="text-[10px] uppercase">Absurdity Level</div>
          </div>
          <div className="w-full text-[11px] uppercase">
              <div className="flex justify-between py-[8px] border-b-[1px] border-theme-gray">
                  <span>Mental Slowness</span>
                  <span className="text-theme-neon">High</span>
              </div>
              <div className="flex justify-between py-[8px] border-b-[1px] border-theme-gray">
                  <span>Failure to Learn</span>
                  <span className="text-theme-neon">Critical</span>
              </div>
              <div className="flex justify-between py-[8px] border-b-[1px] border-theme-gray">
                  <span>Irrationality</span>
                  <span className="text-theme-neon">10/10</span>
              </div>
          </div>
          <button onClick={() => window.open('https://github.com/google/ai-studio', '_blank')} className="bg-theme-crimson text-theme-paper w-full p-[20px] text-center uppercase text-[18px] cursor-pointer border-none shadow-[0_8px_0_#800000] mt-auto font-theme-black hover:opacity-90 active:translate-y-[4px] active:shadow-[0_4px_0_#800000] transition-all">KICK ASS</button>
      </aside>

      {/* FOOTER */}
      <footer className="col-span-full shrink-0 h-[80px] bg-theme-ink border-t-[2px] border-theme-gray flex items-center justify-center gap-[20px] md:gap-[40px] px-4 overflow-x-auto">
          <div className="text-[10px] md:text-[12px] uppercase text-theme-neon border-b border-theme-neon pb-1 tracking-[1px] whitespace-nowrap">INTEGRATED: TWITTER/X</div>
          <div className="text-[10px] md:text-[12px] uppercase text-[#555] tracking-[1px] hidden sm:block whitespace-nowrap">DISCORD</div>
          <div className="text-[10px] md:text-[12px] uppercase text-[#555] tracking-[1px] hidden sm:block whitespace-nowrap">WHATSAPP</div>
          <div className="text-[10px] md:text-[12px] uppercase text-[#555] tracking-[1px] hidden md:block whitespace-nowrap">TIKTOK ANALYZER</div>
      </footer>
    </div>
  );
}
