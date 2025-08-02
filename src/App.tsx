import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SingleTicket from "./pages/SingleTicket";

const queryClient = new QueryClient();

// --- Define the shape of the form data and jobs state ---
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


const App = () => {
  // --- State for the bulk ticket form ---
  const [bulkFormData, setBulkFormData] = useState<TicketFormData>({
    emails: '',
    subject: '',
    description: '',
    delay: 1,
    sendDirectReply: false,
    verifyEmail: false,
  });

  // --- State for the results table ---
  const [jobs, setJobs] = useState<Jobs>({});

  // --- State for the single ticket form ---
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
                  formData={bulkFormData}
                  onFormDataChange={setBulkFormData}
                  jobs={jobs}
                  setJobs={setJobs}
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