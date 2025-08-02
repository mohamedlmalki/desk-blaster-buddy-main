import { ZohoDashboard } from "@/components/dashboard/ZohoDashboard";

// --- Define the shapes of the data being passed down ---
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

// --- Update the props to include jobs and setJobs ---
interface IndexProps {
  formData: TicketFormData;
  onFormDataChange: (newFormData: TicketFormData) => void;
  jobs: Jobs;
  setJobs: React.Dispatch<React.SetStateAction<Jobs>>;
}

const Index = ({ formData, onFormDataChange, jobs, setJobs }: IndexProps) => {
  return (
    <ZohoDashboard 
      formData={formData} 
      onFormDataChange={onFormDataChange} 
      jobs={jobs}
      setJobs={setJobs}
    />
  );
};

export default Index;