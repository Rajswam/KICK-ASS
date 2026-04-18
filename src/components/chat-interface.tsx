import { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Video, Music, Mic, StopCircle, Speech } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Markdown from "react-markdown";
import confetti from "canvas-confetti";
import { LiveVoice } from "./live-voice";

export function ChatInterface({ messages, sendMessage, isTyping }: { messages: any[], sendMessage: (t: string) => void, isTyping: boolean }) {
  const [input, setInput] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'model' && lastMsg.isStupidScore !== undefined && lastMsg.isStupidScore > 80) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FF0000', '#EAFF00', '#000000']
        });
    }
  }, [messages]);

  useEffect(() => {
     if ('webkitSpeechRecognition' in window) {
         // @ts-ignore
         const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
         recognitionRef.current = new SpeechRecognition();
         recognitionRef.current.continuous = false;
         recognitionRef.current.interimResults = true;
         
         recognitionRef.current.onresult = (event: any) => {
             let currentTranscript = "";
             for (let i = event.resultIndex; i < event.results.length; ++i) {
                 currentTranscript += event.results[i][0].transcript;
             }
             setInput(prev => {
                // If it's final, append. For interim, we'd probably overwrite the last interim. 
                // A simpler way for a short dictation is just setting it.
                return currentTranscript;
             });
         };
         
         recognitionRef.current.onend = () => {
             setIsListening(false);
         };
     }
  }, []);

  const toggleDictation = () => {
      if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
      } else {
          setInput("");
          recognitionRef.current?.start();
          setIsListening(true);
      }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="flex flex-col gap-[20px] justify-end min-h-full">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
              <div 
                className={`p-[15px] font-theme-sans text-[14px] leading-[1.4] ${
                  msg.role === 'user' 
                  ? 'bg-theme-paper text-theme-ink pb-[30px]' 
                  : 'bg-theme-neon text-theme-ink font-bold pb-[30px]'
                }`}
                style={{
                  clipPath: msg.role === 'user' 
                    ? 'polygon(0% 0%, 100% 0%, 100% 75%, 90% 75%, 100% 100%, 70% 75%, 0% 75%)'
                    : 'polygon(0% 0%, 100% 0%, 100% 75%, 30% 75%, 0% 100%, 10% 75%, 0% 75%)'
                }}
              >
                <div className="markdown-body text-sm prose max-w-none">
                  <Markdown>{msg.text}</Markdown>
                </div>
                
                {msg.isStupidScore !== undefined && (
                   <div className="mt-3 pt-3 border-t border-theme-ink/20 flex flex-col items-start gap-1">
                     <span className="text-[10px] uppercase font-black text-theme-ink/50">Stupidity Detected</span>
                     <span className="text-[24px] tracking-tighter leading-none text-theme-crimson">{msg.isStupidScore}%</span>
                   </div>
                )}

                {msg.isLoadingMedia && (
                    <div className="mt-2 text-[10px] text-theme-crimson uppercase font-black animate-pulse flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> GENERATING MEDIA...
                    </div>
                )}
                
                {msg.media && (
                  <div className="mt-3 overflow-hidden border-[2px] border-theme-ink bg-theme-ink">
                    {msg.media.type === 'image' && <img src={msg.media.url} alt="Stupid idea" className="w-full h-auto object-cover" />}
                    {(msg.media.type === 'video' || msg.media.type === 'gif') && <video src={msg.media.url} autoPlay loop muted playsInline controls={msg.media.type === 'video'} className="w-full h-auto" />}
                    {msg.media.type === 'audio' && <audio src={msg.media.url} controls className="w-full bg-theme-neon" />}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="self-start max-w-[80%]">
               <div 
                  className="p-[15px] pb-[30px] font-theme-sans text-[14px] leading-[1.4] bg-theme-neon text-theme-ink font-bold"
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 30% 75%, 0% 100%, 10% 75%, 0% 75%)' }}
               >
                  ANALYZING STUPIDITY...
               </div>
             </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="mt-4 shrink-0 flex flex-col gap-2">
        <div className="flex gap-2 px-2 overflow-x-auto">
            {['💥', '🔥', '💀', '🤡', '💩', '🧠📉', '🤦‍♂️', '🚮'].map(emoji => (
                <button 
                   key={emoji} 
                   onClick={() => setInput(prev => prev + emoji)}
                   className="text-xl hover:scale-125 transition-transform bg-transparent border-none cursor-pointer p-1"
                >
                   {emoji}
                </button>
            ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-[10px] bg-theme-gray p-[15px] border-[2px] border-theme-neon relative">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isListening ? "Listening..." : "Type your absurd claim here..."} 
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-[#AAA] font-theme-sans outline-none shadow-none text-[14px] rounded-none py-1 h-auto"
          />
          <Button type="button" onClick={toggleDictation} variant="ghost" size="icon" className={`shrink-0 rounded-none ${isListening ? 'text-theme-crimson bg-theme-crimson/20' : 'text-theme-paper hover:text-theme-ink hover:bg-theme-neon'}`}>
             <Speech className="w-5 h-5" />
          </Button>
          <Button type="button" onClick={() => setShowVoice(true)} variant="ghost" size="icon" className="shrink-0 text-theme-neon hover:text-theme-ink hover:bg-theme-neon rounded-none">
             <Mic className="w-5 h-5" />
          </Button>
          <Button type="submit" disabled={!input.trim() || isTyping} className="shrink-0 bg-theme-neon hover:bg-theme-neon/90 text-theme-ink font-theme-black text-[12px] px-[15px] py-[5px] h-auto rounded-none uppercase disabled:opacity-50">
            Send
          </Button>
        </form>
      </div>
      {showVoice && <LiveVoice onClose={() => setShowVoice(false)} />}
    </div>
  );
}
