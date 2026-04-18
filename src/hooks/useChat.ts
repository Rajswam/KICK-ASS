import { useState, useRef, useEffect } from 'react';
import { ai, fileTools } from '../lib/gemini';
import { aiConfig } from '../lib/ai-config';
import { GenerateContentResponse, Chat } from '@google/genai';
import { collection, doc, query, where, orderBy, onSnapshot, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStupidScore?: number;
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
  };
  isLoadingMedia?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    // initialize chat instance
    chatRef.current = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: aiConfig.systemInstruction,
        tools: fileTools,
      }
    });

    // fetch sessions
    if (auth.currentUser) {
      const q = query(
        collection(db, "chatSessions"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("updatedAt", "desc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const sess = snapshot.docs.map(doc => ({
           id: doc.id,
           title: doc.data().title || "New Threat",
           updatedAt: doc.data().updatedAt?.toMillis ? doc.data().updatedAt.toMillis() : 0
        }));
        setSessions(sess);
        if (!currentSessionId && sess.length > 0) {
            setCurrentSessionId(sess[0].id);
        } else if (!currentSessionId && sess.length === 0) {
            createNewSession();
        }
      }, (error) => {
         console.error("Chat sessions snapshot error:", error);
      });
      return () => unsubscribe();
    }
  }, [auth.currentUser]);

  useEffect(() => {
     if (currentSessionId && auth.currentUser) {
         const q = query(
             collection(db, `chatSessions/${currentSessionId}/messages`),
             orderBy("createdAt", "asc")
         );
         const unsubscribe = onSnapshot(q, (snapshot) => {
             const loadedMessages: ChatMessage[] = snapshot.docs.map(doc => {
                 const data = doc.data();
                 let parsedMedia = undefined;
                 try {
                     if (data.mediaStr) parsedMedia = JSON.parse(data.mediaStr);
                 } catch(e){}
                 return {
                     id: doc.id,
                     role: data.role as 'user' | 'model',
                     text: data.text,
                     isStupidScore: data.stupidityScore,
                     media: parsedMedia
                 };
             });
             setMessages(loadedMessages);
             
             // Restore Gemini chat history
             if (chatRef.current) {
                 const history = loadedMessages.map(m => ({
                     role: m.role,
                     parts: [{ text: m.text }]
                 }));
                 // @ts-ignore
                 chatRef.current._history = history;
             }
         }, (error) => {
             console.error("Chat messages snapshot error:", error);
         });
         return () => unsubscribe();
     }
  }, [currentSessionId, auth.currentUser]);

  const createNewSession = async () => {
      if (!auth.currentUser) return;
      const newSessionId = Date.now().toString();
      await setDoc(doc(db, "chatSessions", newSessionId), {
         userId: auth.currentUser.uid,
         title: "New Protocol",
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp(),
         maxStupidityScore: 0
      });
      setCurrentSessionId(newSessionId);
  };

  const saveMessageToFirebase = async (msg: ChatMessage) => {
      if (!currentSessionId || !auth.currentUser) return;
      await setDoc(doc(db, `chatSessions/${currentSessionId}/messages`, msg.id), {
          sessionId: currentSessionId,
          userId: auth.currentUser.uid,
          role: msg.role,
          text: msg.text,
          stupidityScore: msg.isStupidScore || 0,
          mediaStr: msg.media ? JSON.stringify(msg.media) : null,
          createdAt: serverTimestamp()
      });
      
      // Update session title on first user message
      if (msg.role === 'user' && messages.length <= 1) {
          const title = msg.text.slice(0, 30) + (msg.text.length > 30 ? '...' : '');
          await setDoc(doc(db, "chatSessions", currentSessionId), {
              updatedAt: serverTimestamp(),
              title: title
          }, { merge: true });
      } else {
          await setDoc(doc(db, "chatSessions", currentSessionId), {
              updatedAt: serverTimestamp()
          }, { merge: true });
      }
  };

  const handleToolCalls = async (response: GenerateContentResponse, messageId: string) => {
    if (!response.functionCalls || response.functionCalls.length === 0) return null;
    
    let resultScore: number | undefined;
    let resultText: string | undefined;

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isLoadingMedia: true } : m));

    for (const call of response.functionCalls) {
      if (call.name === 'evaluateStupidity') {
         const args = call.args as any;
         resultScore = args.stupidityScore;
         resultText = args.feedback;
      } else if (call.name === 'generateImage') {
         try {
             const customAi = await (await import('../lib/gemini')).getCustomAi();
             const imgRes = await customAi.models.generateContent({
                 model: 'gemini-3.1-flash-image-preview',
                 contents: { parts: [{ text: (call.args as any).prompt }] },
                 config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
             });
             for (const part of imgRes.candidates?.[0]?.content?.parts || []) {
                 if (part.inlineData) {
                     const url = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                     setMessages(prev => prev.map(m => m.id === messageId ? { ...m, media: { type: 'image', url } } : m));
                     break;
                 }
             }
         } catch(e) { console.error("Image gen failed", e); }
      } else if (call.name === 'generateVideo' || call.name === 'generateGif') {
         try {
             const customAi = await (await import('../lib/gemini')).getCustomAi();
             let operation = await customAi.models.generateVideos({
                 model: 'veo-3.1-fast-generate-preview',
                 prompt: (call.args as any).prompt + (call.name === 'generateGif' ? " looping" : ""),
                 config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
             });
             while (!operation.done) {
                 await new Promise(resolve => setTimeout(resolve, 10000));
                 operation = await customAi.operations.getVideosOperation({operation});
             }
             const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
             if (downloadLink) {
                 setMessages(prev => prev.map(m => m.id === messageId ? { ...m, media: { type: 'video', url: downloadLink } } : m));
             }
             
         } catch(e) { console.error("Video/Gif gen failed", e); }
      } else if (call.name === 'generateMusic') {
         try {
             const customAi = await (await import('../lib/gemini')).getCustomAi();
             const stream = await customAi.models.generateContentStream({
                 model: 'lyria-3-clip-preview',
                 contents: (call.args as any).prompt
             });
             let audioBase64 = "";
             let mimeType = "audio/wav";
             for await (const chunk of stream) {
                 const parts = chunk.candidates?.[0]?.content?.parts || [];
                 for (const part of parts) {
                     if (part.inlineData?.data) {
                         if (!audioBase64 && part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
                         audioBase64 += part.inlineData.data;
                     }
                 }
             }
             const binary = atob(audioBase64);
             const bytes = new Uint8Array(binary.length);
             for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
             const blob = new Blob([bytes], { type: mimeType });
             const url = URL.createObjectURL(blob);
             setMessages(prev => prev.map(m => m.id === messageId ? { ...m, media: { type: 'audio', url } } : m));
             
         } catch(e) { console.error("Music gen failed", e); }
      }
    }
    
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isLoadingMedia: false } : m));

    return { score: resultScore, text: resultText };
  };

  const sendMessage = async (text: string) => {
    const userMessageId = Date.now().toString();
    const newMessage: ChatMessage = { id: userMessageId, role: 'user', text };
    
    // Optimistic UI
    setMessages(prev => [...prev, newMessage]);
    setIsTyping(true);
    
    // Save User message immediately
    await saveMessageToFirebase(newMessage);

    try {
      if (!chatRef.current) return;
      
      const botMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMessageId,
        role: 'model',
        text: '...'
      }]);

      const response = await chatRef.current.sendMessage({ message: text });
      
      let score: number | undefined;
      let replyText = response.text || "";

      const toolResult = await handleToolCalls(response, botMessageId);
      if (toolResult) {
        if (toolResult.score !== undefined) score = toolResult.score;
        if (toolResult.text) replyText = toolResult.text;
      }

      setMessages(prev => {
         const updatedBotMsg = prev.find(m => m.id === botMessageId);
         if (updatedBotMsg) {
            saveMessageToFirebase({
                ...updatedBotMsg,
                text: replyText,
                isStupidScore: score
            });
         }
         return prev.map(m => m.id === botMessageId ? {
            ...m,
            text: replyText,
            isStupidScore: score
         } : m);
      });

    } catch (e) {
      console.error(e);
      const botMessageId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: botMessageId,
        role: 'model',
        text: "My brain broke trying to process that."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return { 
    messages, setMessages, sendMessage, isTyping, 
    sessions, currentSessionId, setCurrentSessionId, createNewSession 
  };
}
