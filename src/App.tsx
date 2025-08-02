import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SingleTicket from "./pages/SingleTicket";

const queryClient = new QueryClient();
const SERVER_URL = "http://localhost:3000";

// --- Interfaces ---
interface TicketFormData {
  emails: string;
  subject: string;
  description: string;
  delay: number;
  sendDirectReply: boolean;
  verifyEmail: boolean;
}

interface TicketResult {
  email: string;
  success: boolean;
  ticketNumber?: string;
  details?: string;
  error?: string;
  fullResponse?: any;
}

interface JobState {
  formData: TicketFormData; // Each job now has its own form data
  results: TicketResult[];
  isProcessing: boolean;
  isPaused: boolean;
  isComplete: boolean;
  processingStartTime: Date | null;
  processingTime: string;
  totalTicketsToProcess: number;
  countdown: number;
  currentDelay: number;
  filterText: string;
}

interface Jobs {
  [profileName: string]: JobState;
}

// --- Updated Initial State Creator ---
const createInitialJobState = (): JobState => ({
  formData: {
    emails: '',
    subject: '',
    description: '',
    delay: 1,
    sendDirectReply: false,
    verifyEmail: false,
  },
  results: [],
  isProcessing: false,
  isPaused: false,
  isComplete: false,
  processingStartTime: null,
  processingTime: '0s',
  totalTicketsToProcess: 0,
  countdown: 0,
  currentDelay: 1,
  filterText: '',
});


const App = () => {
  const { toast } = useToast();
  // No longer need a separate bulkFormData state
  const [jobs, setJobs] = useState<Jobs>({});
  const socketRef = useRef<Socket | null>(null);
  const timersRef = useRef<{ [key: string]: { processing?: NodeJS.Timeout, countdown?: NodeJS.Timeout } }>({});


  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
        toast({ title: "Connected to server!" });
    });
    
    socket.on('ticketResult', (result: TicketResult & { profileName: string }) => {
      setJobs(prevJobs => {
        const profileJob = prevJobs[result.profileName];
        if (!profileJob) return prevJobs;
        const isLastTicket = profileJob.results.length + 1 >= profileJob.totalTicketsToProcess;
        return {
          ...prevJobs,
          [result.profileName]: {
            ...profileJob,
            results: [...profileJob.results, result],
            countdown: isLastTicket ? 0 : profileJob.currentDelay,
          }
        };
      });
    });

    socket.on('ticketUpdate', (updateData) => {
      setJobs(prevJobs => ({
        ...prevJobs,
        [updateData.profileName]: {
          ...prevJobs[updateData.profileName],
          results: prevJobs[updateData.profileName].results.map(r => 
            r.ticketNumber === updateData.ticketNumber ? { ...r, success: updateData.success, details: updateData.details, fullResponse: updateData.fullResponse } : r
          )
        }
      }));
    });

    const handleJobCompletion = (profileName: string, title: string, description: string, variant?: "destructive") => {
      setJobs(prevJobs => ({
        ...prevJobs,
        [profileName]: { ...prevJobs[profileName], isProcessing: false, isPaused: false, isComplete: true, countdown: 0 }
      }));
      toast({ title, description, variant });
    };

    socket.on('bulkComplete', ({ profileName }) => handleJobCompletion(profileName, `Processing Complete for ${profileName}!`, "All tickets for this profile have been processed."));
    socket.on('bulkEnded', ({ profileName }) => handleJobCompletion(profileName, `Job Ended for ${profileName}`, "The process was stopped by the user.", "destructive"));
    socket.on('bulkError', ({ message, profileName }) => handleJobCompletion(profileName, `Server Error for ${profileName}`, message, "destructive"));

    return () => {
      socket.disconnect();
    };
  }, [toast]);

  useEffect(() => {
    const timers = timersRef.current;

    Object.keys(jobs).forEach(profileName => {
      const job = jobs[profileName];
      if (!job) return;
      if (!timers[profileName]) timers[profileName] = {};

      const isProcessingTimerRunning = !!timers[profileName].processing;
      const isCountdownTimerRunning = !!timers[profileName].countdown;

      if (job.isProcessing && !job.isPaused && job.processingStartTime && !isProcessingTimerRunning) {
        timers[profileName].processing = setInterval(() => {
          setJobs(prev => {
            if (!prev[profileName] || !prev[profileName].processingStartTime) return prev;
            const elapsed = Math.floor((Date.now() - prev[profileName].processingStartTime!.getTime()) / 1000);
            return { ...prev, [profileName]: { ...prev[profileName], processingTime: `${elapsed}s` }};
          });
        }, 1000);
      } else if ((!job.isProcessing || job.isPaused) && isProcessingTimerRunning) {
        clearInterval(timers[profileName].processing);
        delete timers[profileName].processing;
      }

      if (job.isProcessing && !job.isPaused && job.countdown > 0 && !isCountdownTimerRunning) {
        timers[profileName].countdown = setInterval(() => {
          setJobs(prev => {
            if (!prev[profileName] || prev[profileName].countdown <= 0) {
              if (timers[profileName]?.countdown) {
                  clearInterval(timers[profileName].countdown);
                  delete timers[profileName].countdown;
              }
              return prev;
            }
            const newCountdown = prev[profileName].countdown - 1;
            return { ...prev, [profileName]: { ...prev[profileName], countdown: newCountdown }};
          });
        }, 1000);
      } else if ((job.countdown <= 0 || !job.isProcessing || job.isPaused) && isCountdownTimerRunning) {
        clearInterval(timers[profileName].countdown);
        delete timers[profileName].countdown;
      }
    });

    return () => {
      Object.values(timersRef.current).forEach(t => {
        if (t.processing) clearInterval(t.processing);
        if (t.countdown) clearInterval(t.countdown);
      });
    };
  }, [jobs]);


  // --- State for the single ticket form (remains here as it's not a long-running process) ---
  const [singleTicketEmail, setSingleTicketEmail] = useState('');
  const [singleTicketSubject, setSingleTicketSubject] = useState('');
  const [singleTicketDescription, setSingleTicketDescription] = useState('');
  const [singleTicketSendReply, setSingleTicketSendReply] = useState(false);
  const [singleTicketVerify, setSingleTicketVerify] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <Index
                  jobs={jobs}
                  setJobs={setJobs}
                  socket={socketRef.current}
                  createInitialJobState={createInitialJobState}
                />
              }
            />
            <Route
              path="/single-ticket"
              element={
                <SingleTicket
                  email={singleTicketEmail}
                  setEmail={setSingleTicketEmail}
                  subject={singleTicketSubject}
                  setSubject={setSingleTicketSubject}
                  description={singleTicketDescription}
                  setDescription={setSingleTicketDescription}
                  sendDirectReply={singleTicketSendReply}
                  setSendDirectReply={setSingleTicketSendReply}
                  verifyEmail={singleTicketVerify}
                  setVerifyEmail={setSingleTicketVerify}
                />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;