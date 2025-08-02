import React from 'react';
import { NavLink } from 'react-router-dom'; // Import NavLink
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Ticket, Users, Clock, CheckCircle2, XCircle, Home, FilePlus } from 'lucide-react'; 
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  stats?: {
    totalTickets: number;
    successCount: number;
    errorCount: number;
    processingTime: string;
    totalToProcess: number;
    isProcessing: boolean;
  };
}

// Style for active NavLink
const activeLinkStyle = {
  backgroundColor: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  stats = { totalTickets: 0, successCount: 0, errorCount: 0, processingTime: '0s', totalToProcess: 0, isProcessing: false }
}) => {
  const progressPercent = stats.totalToProcess > 0 ? (stats.totalTickets / stats.totalToProcess) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-soft sticky top-0 z-50">
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
              {/* --- NAVIGATION LINKS --- */}
              <nav className="flex items-center space-x-2 ml-6">
                <NavLink 
                  to="/" 
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent"
                  style={({ isActive }) => isActive ? activeLinkStyle : {}}
                >
                  <Home className="h-4 w-4" />
                  <span>Bulk Creator</span>
                </NavLink>
                <NavLink 
                  to="/single-ticket" 
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent"
                  style={({ isActive }) => isActive ? activeLinkStyle : {}}
                >
                  <FilePlus className="h-4 w-4" />
                  <span>Single Ticket</span>
                </NavLink>
              </nav>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{stats.totalTickets} Tickets</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">{stats.successCount} Success</span>
              </div>
              {stats.errorCount > 0 && (
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">{stats.errorCount} Errors</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{stats.processingTime}</span>
              </div>
            </div>
          </div>
        </div>
        
        {stats.isProcessing && stats.totalToProcess > 0 && (
            <Progress value={progressPercent} className="h-1 w-full rounded-none bg-muted/50" />
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
};