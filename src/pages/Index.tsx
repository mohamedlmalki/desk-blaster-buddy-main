import { ZohoDashboard } from "@/components/dashboard/ZohoDashboard";
import { Socket } from "socket.io-client";

// --- Interfaces (these are useful for type safety) ---
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
  formData: TicketFormData;
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

interface IndexProps {
  jobs: Jobs;
  setJobs: React.Dispatch<React.SetStateAction<Jobs>>;
  socket: Socket | null;
  createInitialJobState: () => JobState;
}

const Index = ({ jobs, setJobs, socket, createInitialJobState }: IndexProps) => {
  return (
    <ZohoDashboard 
      jobs={jobs}
      setJobs={setJobs}
      socket={socket}
      createInitialJobState={createInitialJobState}
    />
  );
};

export default Index;