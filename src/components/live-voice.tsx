import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ai } from "../lib/gemini";
import { LiveServerMessage, Modality } from "@google/genai";

export function LiveVoice({ onClose }: { onClose: () => void }) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState("Connecting...");
  const [transcript, setTranscript] = useState("");
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    startLiveSession();
    return () => {
      stopSession();
    };
  }, []);

  const startLiveSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            channelCount: 1,
            sampleRate: 16000
      } });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are KICK ASS. A sarcastic, edgy AI that judges stupidity. Same rules as before, be mean, funny, and judge them!`,
        },
        callbacks: {
          onopen: () => {
            setStatus("Listening...");
            setIsActive(true);
            
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
               const inputData = e.inputBuffer.getChannelData(0);
               // Convert Float32Array to Int16Array
               const pcmData = new Int16Array(inputData.length);
               for (let i = 0; i < inputData.length; i++) {
                 let s = Math.max(-1, Math.min(1, inputData[i]));
                 pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
               }
               // Base64 encode
               const bytes = new Uint8Array(pcmData.buffer);
               let binary = '';
               for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
               const base64Data = btoa(binary);

               sessionPromise.then((session) => {
                 session.sendRealtimeInput({
                   audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                 });
               });
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               // Decode and play
               const binaryString = atob(base64Audio);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                 bytes[i] = binaryString.charCodeAt(i);
               }
               
               try {
                   // Create audio buffer from raw PCM (16-bit, 16kHz or 24kHz)
                   // The Gemini output is typically 24kHz PCM for Zephyr/Live API
                   // But let's check doc: "decode and play audio with sample rate 24000"
                   
                   const int16Array = new Int16Array(bytes.buffer);
                   const audioBuffer = audioCtx.createBuffer(1, int16Array.length, 24000);
                   const channelData = audioBuffer.getChannelData(0);
                   for(let i=0; i<int16Array.length;i++) {
                       channelData[i] = int16Array[i] / 32768.0;
                   }
                   
                   const source = audioCtx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(audioCtx.destination);
                   
                   const currentTime = audioCtx.currentTime;
                   if (nextPlayTimeRef.current < currentTime) {
                       nextPlayTimeRef.current = currentTime;
                   }
                   source.start(nextPlayTimeRef.current);
                   nextPlayTimeRef.current += audioBuffer.duration;
               } catch(e) {
                   console.error("Audio playback error", e);
               }
            }
            if (message.serverContent?.interrupted) {
               setStatus("Interrupted...");
               nextPlayTimeRef.current = audioCtx?.currentTime || 0;
            }
          },
          onerror: (err) => {
            console.error(err);
            setStatus("Error occurred");
          },
          onclose: () => {
            setStatus("Disconnected");
            setIsActive(false);
          }
        }
      });
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setStatus("Microphone access denied or error");
    }
  };

  const stopSession = () => {
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    
    if (sessionRef.current) {
       sessionRef.current.then((session: any) => session.close());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
       <div className="bg-theme-gray border-[4px] border-theme-neon rounded-none p-8 max-w-sm w-full flex flex-col items-center shadow-2xl relative overflow-hidden font-theme-black">
          {/* Pulsing background effect */}
          {isActive && (
              <div className="absolute inset-0 bg-theme-neon/10 animate-pulse pointer-events-none" />
          )}
          
          <h2 className="text-[32px] font-black italic text-theme-neon uppercase mb-2">Voice Protocol</h2>
          <p className="text-[#AAA] font-theme-sans text-[12px] uppercase mb-8 text-center">{status}</p>

          <div className="relative mb-8">
             <div className={`w-[120px] h-[120px] rounded-full flex items-center justify-center bg-theme-ink border-[8px] transition-colors duration-500 ${isActive ? 'border-theme-neon shadow-[0_0_50px_rgba(234,255,0,0.4)]' : 'border-[#444]'}`}>
                {isActive ? (
                    <Mic className="w-12 h-12 text-theme-neon animate-bounce" />
                ) : (
                    <Loader2 className="w-12 h-12 text-[#444] animate-spin" />
                )}
             </div>
          </div>

          <Button 
            variant="destructive" 
            size="lg" 
            onClick={stopSession}
            className="w-full bg-theme-crimson hover:bg-theme-crimson/90 text-theme-paper font-theme-black uppercase tracking-wider py-6 rounded-none outline-none border-none shadow-[0_6px_0_#800000] hover:translate-y-[2px] hover:shadow-[0_4px_0_#800000] active:translate-y-[6px] active:shadow-none transition-all"
          >
             <MicOff className="w-5 h-5 mr-2" /> TERMINATE CONNECTION
          </Button>
       </div>
    </div>
  );
}
