import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const ChatBot = () => {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi 👋 Tell me your symptoms" }
  ]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const chatRef = useRef(null);
  const navigate = useNavigate(); // ✅ FIXED (yahan hona chahiye)

  // auto scroll
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  // 🎤 Voice
  const startListening = () => {
    if (!SpeechRecognition) {
      alert("Voice not supported 😢");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";

    recognition.start();

    recognition.onresult = (event) => {
      const voiceText = event.results[0][0].transcript;
      setInput(voiceText);
    };
  };

  // 💬 Send Message
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    setInput("");
    setMessages(prev => [...prev, userMsg, { sender: "bot", text: "..." }]);

    try {
      const { data } = await axios.post(
        `${backendUrl}/api/ai/symptom-check`,
        { symptoms: userMsg.text  }
      );

      const aiText = data.aiResponse.toLowerCase();

// 🎯 SMART MATCHING
if (aiText.includes("general")) {
  navigate("/doctors/General physician");
}
else if (aiText.includes("gynecologist")) {
  navigate("/doctors/Gynecologist");
}
else if (aiText.includes("dermatologist")) {
  navigate("/doctors/Dermatologist");
}
else if (aiText.includes("pediatric")) {
  navigate("/doctors/Pediatricians");
}
else if (aiText.includes("neuro")) {
  navigate("/doctors/Neurologist");
}
else if (aiText.includes("gastro")) {
  navigate("/doctors/Gastroenterologist");
}

      setMessages(prev => {
        const updated = [...prev];
        updated.pop();
        updated.push({
          sender: "bot",
          text: data.aiResponse
        });
        return updated;
      });

    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated.pop();
        updated.push({
          sender: "bot",
          text: "Server error 😢"
        });
        return updated;
      });
    }

    setInput("");
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <div
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-xl cursor-pointer hover:scale-110 transition"
        >
          💬
        </div>
      )}

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-80 bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          open ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="bg-primary text-white p-3 flex justify-between items-center">
          <span>AI Assistant 🤖</span>
          <button onClick={() => setOpen(false)}>✖</button>
        </div>

        {/* Suggestions */}
        <div className="flex gap-2 flex-wrap p-2">
          <button onClick={() => setInput("Fever")} className="bg-gray-200 px-2 py-1 rounded text-xs">Fever</button>
          <button onClick={() => setInput("Headache")} className="bg-gray-200 px-2 py-1 rounded text-xs">Headache</button>
          <button onClick={() => setInput("Skin rash")} className="bg-gray-200 px-2 py-1 rounded text-xs">Skin rash</button>
        </div>

        {/* Messages */}
        <div
          ref={chatRef}
          className="p-3 h-80 overflow-y-auto flex flex-col gap-2 bg-gray-50"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 px-3 rounded-xl max-w-[75%] text-sm ${
                msg.sender === "user"
                  ? "bg-primary text-white self-end"
                  : "bg-white shadow self-start"
              }`}
            >
              {msg.text === "..." ? (
                <span className="animate-pulse">Typing...</span>
              ) : (
                msg.text
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex border-t bg-white">
          <input
            type="text"
            placeholder="Type symptoms..."
            className="flex-1 p-2 outline-none text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />

          <button onClick={startListening} className="px-2">
            🎤
          </button>

          <button
            onClick={sendMessage}
            className="bg-primary text-white px-4"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatBot;