import React from 'react';
// --- START: MODIFICATION 1 ---
// Import the Progress component for the progress bar and XCircle for the error icon
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Ticket, Users, Clock, CheckCircle2, XCircle } from 'lucide-react'; 
// --- END: MODIFICATION 1 ---

// --- START: MODIFICATION 2 ---
// Update the props interface to accept the new data we need for the improvements
interface DashboardLayoutProps {
  children: React.ReactNode;
  stats?: {
    totalTickets: number;
    successCount: number;
    errorCount: number;
    processingTime: string;
    totalToProcess: number; // New: Total tickets in the current job
    isProcessing: boolean;  // New: Is a job currently running?
  };
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  stats = { totalTickets: 0, successCount: 0, errorCount: 0, processingTime: '0s', totalToProcess: 0, isProcessing: false }
}) => {
// --- END: MODIFICATION 2 ---

  // Calculate the progress percentage for the new progress bar
  const progressPercent = stats.totalToProcess > 0 ? (stats.totalTickets / stats.totalToProcess) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {/* --- START: MODIFICATION 3 --- */}
      {/* Added sticky positioning so the header (and progress bar) stays at the top */}
      <header className="bg-card border-b border-border shadow-soft sticky top-0 z-50">
      {/* --- END: MODIFICATION 3 --- */}
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                <Ticket className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Zoho Desk</h1>
                <p className="text-muted-foreground">Bulk Ticket Creator</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{stats.totalTickets} Tickets</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {/* Fixed: The text color is now correct */}
                <span className="text-sm font-medium text-success">{stats.successCount} Success</span>
              </div>

              {/* --- START: MODIFICATION 4 --- */}
              {/* New: Display the error count only if there are errors */}
              {stats.errorCount > 0 && (
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">{stats.errorCount} Errors</span>
                </div>
              )}
              {/* --- END: MODIFICATION 4 --- */}

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{stats.processingTime}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* --- START: MODIFICATION 5 --- */}
        {/* New: A progress bar that appears at the bottom of the header only when a job is active */}
        {stats.isProcessing && stats.totalToProcess > 0 && (
            <Progress value={progressPercent} className="h-1 w-full rounded-none bg-muted/50" />
        )}
        {/* --- END: MODIFICATION 5 --- */}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
};