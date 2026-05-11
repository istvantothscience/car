import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Car, Gauge, Brain, Play, RotateCcw, Bot, User, Info } from 'lucide-react';
import { motion, useAnimation } from 'motion/react';

// Environment variable setup for Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Type definitions
type Message = {
  role: 'user' | 'model';
  text: string;
};

type SimulationState = 'idle' | 'moving' | 'braking' | 'stopped';

export default function App() {
  // --- Simulation State ---
  const [speed, setSpeed] = useState<number>(15); // m/s
  const [reactionTime, setReactionTime] = useState<number>(1.0); // seconds
  const [simState, setSimState] = useState<SimulationState>('idle');
  
  // Distances in meters
  // Thinking distance = speed m/s * reaction time s
  const thinkingDistance = speed * reactionTime;
  // Simplified braking distance formula: v^2 / 20 (assuming deceleration is 10 m/s^2)
  const brakingDistance = Math.pow(speed, 2) / 20;
  const stoppingDistance = thinkingDistance + brakingDistance;

  // Maximum allowed distances to scale the visual track appropriately
  // max speed 30, max reaction 2.0 -> max thinking = 60, max braking = 900/20 = 45, max total = 105
  const maxPossibleDistance = 120; 

  const carControls = useAnimation();

  // --- Chat State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Hello! I'm your science tutor. I'm here to help you understand how speed and reaction time change your total stopping distance. What did you notice when you changed the speed?",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Run the simulation visually
  const runSimulation = async () => {
    setSimState('moving');
    carControls.set({ x: '0%' });

    // 1. Thinking phase (constant speed)
    // We map 1 meter to an arbitrary percentage of the track.
    const percentagePerMeter = 100 / maxPossibleDistance;
    const thinkingX = thinkingDistance * percentagePerMeter;
    const stoppingX = stoppingDistance * percentagePerMeter;

    // Actual visual timing (we speed it up slightly so students don't wait forever, but keep proportions)
    const visualSpeedScale = 0.5; // twice as fast visually
    
    await carControls.start({
      x: `${thinkingX}%`,
      transition: { duration: reactionTime * visualSpeedScale, ease: 'linear' }
    });
    
    setSimState('braking');

    // Braking time = v / a = speed / 10
    const brakingTime = speed / 10;
    
    await carControls.start({
      x: `${stoppingX}%`,
      transition: { duration: brakingTime * visualSpeedScale, ease: 'easeOut' }
    });

    setSimState('stopped');
  };

  const resetSimulation = () => {
    setSimState('idle');
    carControls.set({ x: '0%' });
  };

  const currentSystemInstruction = `You are a science tutor assistant embedded inside an interactive stopping distance simulator for Year 6 students (ages 10-11). The simulation teaches how reaction time and vehicle speed affect stopping distance (Cambridge Primary Science unit on Forces & Energy).

Your role:
- Answer student questions about the simulation results in simple, age-appropriate English.
- Use force vocabulary: upthrust, inertia, reaction time, braking distance, stopping distance, deceleration.
- NEVER give direct answers to worksheet questions — ask guiding questions instead.
- Keep responses to 2-3 sentences MAXIMUM.
- Be encouraging and curious in tone.
- If a student asks something unrelated to science, gently redirect them back to the physics experiment.

SIMULATION CONTEXT (Always reference these current numbers when explaining):
- Current Speed: ${speed.toFixed(1)} m/s
- Current Reaction Time: ${reactionTime.toFixed(1)} s
- Thinking Distance: ${thinkingDistance.toFixed(1)} m
- Braking Distance: ${brakingDistance.toFixed(1)} m
- Total Stopping Distance: ${stoppingDistance.toFixed(1)} m`;

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const currentMessages = [...messages];
    const userMessage = inputValue.trim();
    
    currentMessages.push({ role: 'user', text: userMessage });
    setMessages(currentMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const chatContents = currentMessages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chatContents,
        config: {
          systemInstruction: currentSystemInstruction,
          temperature: 0.7,
        },
      });

      const responseText = response.text || "I'm not sure how to answer that. Can you try asking in a different way?";
      
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: responseText }
      ]);
    } catch (error) {
      console.error('Error generating AI response:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: "Hmm, I'm having a little trouble connecting right now. Let's try again in a moment!" }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col font-sans">
      <header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between border-b-4 border-sky-100">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-2xl shadow-sm">🚀</div>
            <div>
              <h1 className="text-2xl font-black text-sky-900 leading-none">Force & Motion Lab</h1>
              <p className="text-sky-600 font-bold text-sm uppercase tracking-wider">Year 6 Science</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-sky-400 uppercase">Current Unit</span>
              <span className="text-sky-900 font-black">Energy & Forces</span>
            </div>
            <div className="w-10 h-10 bg-sky-200 rounded-lg flex items-center justify-center font-black text-sky-700 italic">?</div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        
        {/* LEFT / TOP COLUMN: SIMULATOR */}
        <section className="flex flex-col gap-4">
          <div className="bg-white rounded-[40px] border-4 border-sky-200 flex flex-col relative overflow-hidden shadow-inner p-4 md:p-8 mb-4 min-h-[400px]">
            <div className="flex items-center space-x-2 mb-6 relative z-20">
              <Gauge className="w-6 h-6 text-sky-500" />
              <h2 className="text-xl font-black text-sky-900 italic">Stopping Distance Simulator</h2>
            </div>
            
            <div className="bg-gray-100 flex-1 rounded-3xl p-4 md:p-8 relative overflow-hidden mb-6 border-4 border-gray-200">
              {/* Distance markers container */}
              <div className="absolute top-0 left-0 w-[85%] h-full pointer-events-none opacity-20">
                 {/* Visual grid lines to simulate distance */}
                 <div className="absolute inset-0 flex justify-between px-8" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 49px, #64748b 49px, #64748b 50px)'}}></div>
              </div>

              {/* The "Road" */}
              <div className="absolute inset-x-0 top-1/2 h-32 md:h-40 bg-gray-700 -translate-y-1/2 flex items-center">
                <div className="w-full h-2 border-t-4 border-dashed border-white opacity-40"></div>
              </div>
              <div className="relative w-[85%] h-32 md:h-40 mx-auto mt-4 overflow-visible flex items-center">
                {/* The Car */}
                <motion.div 
                  initial={{ x: '0%' }}
                  animate={carControls}
                  className="absolute bottom-4 -left-6 z-10"
                >
                  <div className="text-3xl filter drop-shadow-md pb-1 relative">
                    <span 
                      role="img" 
                      aria-label="car" 
                      style={{ transform: simState === 'braking' ? 'rotate(-2deg)' : 'none', transition: 'transform 0.1s' }}
                      className="inline-block relative z-10 text-5xl md:text-6xl drop-shadow-lg"
                    >
                      🚗
                    </span>
                    {simState === 'braking' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-0 -left-4 text-xs text-orange-500 font-bold z-0"
                      >
                        🔥
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="w-[85%] mx-auto flex justify-between text-xs text-slate-500 font-mono mt-2 uppercase font-semibold">
                <span>Start</span>
                <span>Max (120m)</span>
              </div>

              {/* Distances Bar Chart overlay */}
              <div className="relative z-20 w-[85%] h-6 md:h-8 mx-auto mt-6 flex rounded-full overflow-hidden bg-white border-2 border-gray-200 shadow-inner">
                <motion.div 
                   className="bg-blue-500 h-full flex items-center justify-center text-[10px] sm:text-xs text-white font-bold transition-all duration-300 border-r border-blue-600"
                   style={{ width: `${(thinkingDistance / maxPossibleDistance) * 100}%` }}
                >
                  <span className="truncate px-1 sm:px-2 hidden sm:block">Thinking: {thinkingDistance.toFixed(1)}m</span>
                </motion.div>
                <motion.div 
                   className="bg-red-500 h-full flex items-center justify-center text-[10px] sm:text-xs text-white font-bold transition-all duration-300"
                   style={{ width: `${(brakingDistance / maxPossibleDistance) * 100}%` }}
                >
                  <span className="truncate px-1 sm:px-2 hidden sm:block">Braking: {brakingDistance.toFixed(1)}m</span>
                </motion.div>
              </div>
            </div>

            {/* Results Callouts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex justify-between md:flex-col items-center md:justify-center p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 shadow-sm">
                <span className="text-blue-700 font-bold uppercase text-xs sm:text-sm tracking-wide md:mb-1">Thinking Distance</span>
                <span className="font-black text-blue-900 text-2xl">{thinkingDistance.toFixed(1)} <span className="text-lg">m</span></span>
              </div>
              <div className="flex justify-between md:flex-col items-center md:justify-center p-4 bg-red-50 rounded-2xl border-2 border-red-100 shadow-sm">
                <span className="text-red-700 font-bold uppercase text-xs sm:text-sm tracking-wide md:mb-1">Braking Distance</span>
                <span className="font-black text-red-900 text-2xl">{brakingDistance.toFixed(1)} <span className="text-lg">m</span></span>
              </div>
              <div className="flex justify-between md:flex-col items-center md:justify-center p-4 bg-emerald-100 rounded-2xl border-4 border-emerald-200 shadow-sm">
                <span className="text-emerald-800 font-black uppercase text-xs sm:text-sm tracking-wide md:mb-1">Total Stopping</span>
                <span className="font-black text-emerald-900 text-2xl md:text-3xl">{stoppingDistance.toFixed(1)} <span className="text-xl">m</span></span>
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="flex-1 bg-blue-50 rounded-3xl p-5 border-b-4 border-blue-200">
                <div className="flex justify-between items-center mb-4">
                  <label htmlFor="speed-slider" className="text-blue-900 font-black text-sm uppercase italic">Vehicle Speed</label>
                  <span className="bg-white px-3 py-1 rounded-full font-black text-blue-800 text-sm border-2 border-blue-300">
                    {speed} m/s
                  </span>
                </div>
                <input 
                  id="speed-slider"
                  type="range" 
                  min="5" 
                  max="30" 
                  step="1"
                  value={speed}
                  onChange={(e) => { setSpeed(Number(e.target.value)); resetSimulation(); }}
                  className="w-full h-4 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  disabled={simState !== 'idle' && simState !== 'stopped'}
                />
                <p className="text-xs text-blue-700 mt-2 font-medium">How fast the car is traveling before hazard.</p>
              </div>

              <div className="flex-1 bg-purple-50 rounded-3xl p-5 border-b-4 border-purple-200">
                <div className="flex justify-between items-center mb-4">
                  <label htmlFor="reaction-slider" className="text-purple-900 font-black text-sm uppercase italic">Reaction Time</label>
                  <span className="bg-white px-3 py-1 rounded-full font-black text-purple-700 text-sm border-2 border-purple-200">
                    {reactionTime.toFixed(1)} s
                  </span>
                </div>
                <input 
                  id="reaction-slider"
                  type="range" 
                  min="0.2" 
                  max="2.5" 
                  step="0.1"
                  value={reactionTime}
                  onChange={(e) => { setReactionTime(Number(e.target.value)); resetSimulation(); }}
                  className="w-full h-4 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  disabled={simState !== 'idle' && simState !== 'stopped'}
                />
                <p className="text-xs text-purple-700 mt-2 font-medium">How long to notice hazard and brake.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4 pt-4 border-t-2 border-sky-100 border-dashed mt-auto">
              <button 
                onClick={runSimulation}
                disabled={simState === 'moving' || simState === 'braking'}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200 disabled:text-yellow-600 text-yellow-900 py-3 px-6 rounded-2xl font-black text-lg tracking-wide shadow-sm border-b-4 border-yellow-500 disabled:border-yellow-300 transition-all flex items-center justify-center space-x-2"
              >
                <Play className="w-5 h-5 font-black" />
                <span>Test Run</span>
              </button>
              <button 
                onClick={resetSimulation}
                className="flex-1 bg-white hover:bg-gray-50 text-sky-900 py-3 px-6 rounded-2xl font-black text-lg tracking-wide transition-all border-4 border-sky-100 flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-5 h-5 font-bold" />
                <span>Reset</span>
              </button>
            </div>
            
          </div>
          
          <div className="bg-sky-100 text-sky-900 p-5 rounded-3xl flex items-start space-x-3 text-sm font-medium border-4 border-sky-200 shadow-sm">
            <div className="w-8 h-8 bg-sky-200 rounded-full flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-sky-600" />
            </div>
            <p className="mt-1"><strong>Science Fact:</strong> Doubling your speed doesn't just double your braking distance—it makes it <em>four times</em> as long! This is because of the kinetic energy formula. Ask the AI tutor for more information about this relationship!</p>
          </div>
        </section>

        {/* RIGHT COLUMN: AI TUTOR CHAT */}
        <aside className="flex flex-col gap-6">
          <div className="flex-1 bg-white rounded-[40px] border-4 border-yellow-200 flex flex-col overflow-hidden shadow-sm h-[600px] xl:h-[auto]">
            <div className="bg-yellow-100 px-6 py-4 flex items-center gap-3 border-b-4 border-yellow-200 shrink-0">
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-lg shadow-sm">
                🧠
              </div>
              <div>
                <h2 className="font-black text-yellow-900 italic text-xl leading-none">Prof. Newton</h2>
                <p className="text-xs text-yellow-800 font-bold uppercase tracking-wide mt-1">Science Tutor</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-yellow-50/30">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                  
                  {message.role === 'model' ? (
                    <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 mb-1 z-10 shadow-sm text-sm border-2 border-white">
                      🧠
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sky-400 flex items-center justify-center shrink-0 mb-1 z-10 shadow-sm text-sm border-2 border-white">
                      👤
                    </div>
                  )}

                  <div 
                    className={`px-5 py-4 ${
                      message.role === 'user' 
                        ? 'bg-gray-100 text-gray-700 rounded-2xl rounded-tr-none ml-2 shadow-sm border-2 border-gray-200' 
                        : 'bg-sky-100 text-sky-900 rounded-2xl rounded-tl-none mr-2 shadow-sm border-2 border-sky-200'
                    }`}
                  >
                    <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${message.role === 'user' ? 'font-bold' : 'font-medium italic'}`}>{message.text}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] flex-row items-end">
                  <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 mb-1 z-10 shadow-sm text-sm border-2 border-white">
                    🧠
                  </div>
                  <div className="px-5 py-4 bg-sky-100 text-sky-900 rounded-2xl rounded-tl-none shadow-sm border-2 border-sky-200 ml-2 mr-2">
                    <div className="flex space-x-1 w-6 items-center justify-center">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-yellow-50 flex gap-2 items-center border-t border-yellow-200 shrink-0">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a science question..."
              className="flex-1 bg-white border-2 border-yellow-200 rounded-full px-4 py-3 font-medium text-sm text-yellow-900 focus:outline-none focus:border-yellow-400"
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 w-12 h-12 rounded-full font-black text-xl disabled:opacity-50 flex justify-center items-center shrink-0 shadow-sm transition-colors"
            >
              ➔
            </button>
          </div>
          </div>
        </aside>

      </main>

      <footer className="mt-auto bg-sky-900 flex items-center px-4 md:px-8 py-4 text-sky-200 text-xs font-bold uppercase tracking-[0.2em] justify-between">
        <span className="hidden sm:inline">Simulation State: ACTIVE</span>
        <span>© ScienceLab Interactive Year 6 Units</span>
        <span className="hidden sm:inline">Powered by Google AI</span>
      </footer>
    </div>
  );
}

