import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ProfileSelector } from '@/components/dashboard/ProfileSelector';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Send, Mail, MessageSquare, Bot, FileText, Loader2, AlertCircle, Ticket, User, Building, MailWarning, RefreshCw, Download, Trash2 } from 'lucide-react';

// --- Basic type definitions ---
interface Profile {
  profileName: string;
  orgId: string;
  defaultDepartmentId: string;
}

type ApiStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
  fullResponse?: any;
};

interface EmailFailure {
  ticketNumber: string;
  subject: string;
  reason: string;
  errorMessage: string;
  departmentName: string;
  channel: string;
  email?: string;
  assignee: {
      name: string;
  } | null;
}

const SERVER_URL = "http://localhost:3000";
let socket: Socket;

const SingleTicket = () => {
  const { toast } = useToast();
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'loading', message: 'Connecting to server...' });
  
  // --- State for the single ticket form ---
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sendDirectReply, setSendDirectReply] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverResponse, setServerResponse] = useState<any>(null);

  // --- State for modals and failures ---
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [emailFailures, setEmailFailures] = useState<EmailFailure[]>([]);
  const [isFailuresModalOpen, setIsFailuresModalOpen] = useState(false);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const response = await fetch(`${SERVER_URL}/api/profiles`);
      if (!response.ok) throw new Error('Could not connect to the server.');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profiles.length > 0 && !activeProfileName) {
      setActiveProfileName(profiles[0].profileName);
    }
  }, [profiles, activeProfileName]);

  useEffect(() => {
    socket = io(SERVER_URL);

    socket.on('connect', () => toast({ title: "Connected to server!" }));
    socket.on('apiStatusResult', (result) => setApiStatus({
      status: result.success ? 'success' : 'error',
      message: result.message,
      fullResponse: result.fullResponse || null
    }));

    // Listener for our new single ticket event
    socket.on('singleTicketResult', (result) => {
      setIsProcessing(false);
      setServerResponse(result);
      toast({
        title: result.success ? "Ticket Created Successfully" : "Ticket Creation Failed",
        description: result.success ? `Ticket #${result.fullResponse?.ticketCreate?.ticketNumber} created.` : result.error,
        variant: result.success ? "default" : "destructive",
      });
    });

    socket.on('emailFailuresResult', (result) => {
      if (result.success && Array.isArray(result.data)) {
        const formattedFailures = result.data.map((failure: any) => ({
          ...failure,
          assignee: failure.assignee 
            ? { name: `${failure.assignee.firstName || ''} ${failure.assignee.lastName || ''}`.trim() }
            : null,
        }));
        setEmailFailures(formattedFailures);
        setIsFailuresModalOpen(true);
      } else if (!result.success) {
        toast({ title: "Error Fetching Failures", description: result.error, variant: "destructive" });
      }
    });
    
    socket.on('clearEmailFailuresResult', (result) => {
        if (result.success) {
            toast({ title: "Success", description: "Email failure alerts have been cleared." });
            setEmailFailures([]);
            setIsFailuresModalOpen(false);
        } else {
            toast({ title: "Error Clearing Failures", description: result.error, variant: "destructive" });
        }
    });

    return () => {
      socket.disconnect();
    };
  }, [toast]);
  
  useEffect(() => {
    if (activeProfileName && socket?.connected) {
      setApiStatus({ status: 'loading', message: 'Checking API connection...' });
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName });
    }
  }, [activeProfileName, socket?.connected]);
  
  const handleProfileChange = (profileName: string) => {
    const profile = profiles.find(p => p.profileName === profileName);
    if (profile) {
      setActiveProfileName(profileName);
      toast({ title: "Profile Changed", description: `Switched to ${profileName}` });
    }
  };

  const handleCreateTicket = () => {
    if (!activeProfileName) {
      toast({ title: "No Profile Selected", variant: "destructive" });
      return;
    }
    if (!email || !subject || !description) {
      toast({ title: "Missing Information", description: "Please fill out all required fields.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setServerResponse(null);
    toast({ title: "Creating Ticket..." });

    socket.emit('createSingleTicket', {
      email,
      subject,
      description,
      sendDirectReply,
      verifyEmail,
      selectedProfileName: activeProfileName,
    });
  };

  const handleManualVerify = () => {
    if (!activeProfileName) {
      toast({ title: "No Profile Selected", description: "Cannot verify status without a profile.", variant: "destructive" });
      return;
    }
    setApiStatus({ status: 'loading', message: 'Checking API connection...', fullResponse: null });
    if (socket && socket.connected) {
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName });
    }
    toast({ title: "Re-checking Connection..." });
  };
  
  const handleFetchEmailFailures = () => {
    if (!activeProfileName) {
      toast({ title: "No Profile Selected", description: "Please select a profile first.", variant: "destructive" });
      return;
    }
    toast({ title: "Fetching Email Failures..." });
    socket.emit('getEmailFailures', { selectedProfileName: activeProfileName });
  };
  
  const handleExportFailures = () => {
    const content = emailFailures.map(f => f.email).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "failed-emails.txt");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFailures = () => {
    if (!activeProfileName) return;
    socket.emit('clearEmailFailures', { selectedProfileName: activeProfileName });
  };

  const selectedProfile = profiles.find(p => p.profileName === activeProfileName) || null;

  return (
    <>
      <DashboardLayout>
        <div className="space-y-8">
          <ProfileSelector
            profiles={profiles}
            selectedProfile={selectedProfile}
            jobs={{}}
            onProfileChange={handleProfileChange}
            apiStatus={apiStatus}
            onShowStatus={() => setIsStatusModalOpen(true)}
            onFetchFailures={handleFetchEmailFailures}
            onManualVerify={handleManualVerify}
            socket={socket}
          />

          <Card className="shadow-medium hover:shadow-large transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Send className="h-5 w-5 text-primary" />
                <span>Create a Single Ticket</span>
              </CardTitle>
              <CardDescription>Fill in the details below to create one ticket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center space-x-2"><Mail className="h-4 w-4" /><span>Recipient Email</span></Label>
                    <Input id="email" type="email" placeholder="recipient@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isProcessing} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="flex items-center space-x-2"><MessageSquare className="h-4 w-4" /><span>Ticket Subject</span></Label>
                    <Input id="subject" placeholder="Enter ticket subject..." value={subject} onChange={e => setSubject(e.target.value)} disabled={isProcessing} />
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label className="flex items-center space-x-2"><Bot className="h-4 w-4" /><span>Optional Email Actions</span></Label>
                    <div className="space-y-3 rounded-lg bg-muted/30 p-4 border border-border">
                      <div className="flex items-start space-x-3">
                        <Checkbox id="sendDirectReply" checked={sendDirectReply} onCheckedChange={(checked) => setSendDirectReply(!!checked)} disabled={isProcessing || verifyEmail} />
                        <div>
                          <Label htmlFor="sendDirectReply" className="font-medium hover:cursor-pointer">Send Direct Public Reply</Label>
                          <p className="text-xs text-muted-foreground">Sends the description as an email reply. Disables Zoho's internal automations for this ticket.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <Checkbox id="verifyEmail" checked={verifyEmail} onCheckedChange={(checked) => setVerifyEmail(!!checked)} disabled={isProcessing || sendDirectReply} />
                        <div>
                          <Label htmlFor="verifyEmail" className="font-medium hover:cursor-pointer">Verify Automation Email</Label>
                          <p className="text-xs text-muted-foreground">Slower. Waits and checks if Zoho's automation email was sent.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 flex flex-col">
                  <div className="space-y-2 flex-grow flex flex-col">
                    <Label htmlFor="description" className="flex items-center space-x-2"><MessageSquare className="h-4 w-4" /><span>Ticket Description</span></Label>
                    <Textarea id="description" placeholder="Enter ticket description (HTML supported)..." value={description} onChange={e => setDescription(e.target.value)} className="flex-grow" disabled={isProcessing} />
                  </div>
                </div>
              </div>
              <Button onClick={handleCreateTicket} disabled={isProcessing} size="lg" className="w-full">
                {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Send className="mr-2 h-4 w-4" /> Create Ticket</>}
              </Button>
            </CardContent>
          </Card>

          {/* --- MODIFIED RESPONSE DISPLAY AREA --- */}
          {serverResponse && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary"/>
                    <span>
                      {serverResponse.success ? 'Ticket Creation Response' : 'Error Response'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-96 overflow-y-auto">
                    {JSON.stringify(serverResponse.fullResponse?.ticketCreate || serverResponse.fullResponse, null, 2)}
                  </pre>
                </CardContent>
              </Card>

              {serverResponse.fullResponse?.sendReply && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Mail className="h-5 w-5 text-primary"/>
                      <span>Send Reply Response</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-96 overflow-y-auto">
                      {JSON.stringify(serverResponse.fullResponse.sendReply, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {serverResponse.fullResponse?.verifyEmail && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-primary"/>
                      <span>Email Verification Response</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-96 overflow-y-auto">
                      {JSON.stringify(serverResponse.fullResponse.verifyEmail, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
      
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>API Connection Status</DialogTitle>
                <DialogDescription>
                    This is the live status of the connection to the Zoho Desk API for the selected profile.
                </DialogDescription>
            </DialogHeader>
            <div className={`p-4 rounded-md ${apiStatus.status === 'success' ? 'bg-green-100 dark:bg-green-900/50' : apiStatus.status === 'error' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-muted'}`}>
                <p className="font-bold text-lg">{apiStatus.status.charAt(0).toUpperCase() + apiStatus.status.slice(1)}</p>
                <p className="text-sm text-muted-foreground mt-1">{apiStatus.message}</p>
            </div>
            {apiStatus.fullResponse && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-foreground">Full Response from Server:</h4>
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-60 overflow-y-auto">
                    {JSON.stringify(apiStatus.fullResponse, null, 2)}
                </pre>
              </div>
            )}
            <Button onClick={() => setIsStatusModalOpen(false)} className="mt-4">Close</Button>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isFailuresModalOpen} onOpenChange={setIsFailuresModalOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Email Delivery Failure Alerts</DialogTitle>
                <DialogDescription>
                    Showing recent email delivery failures for the selected department.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
              {emailFailures.length > 0 ? (
                <div className="space-y-4">
                  {emailFailures.map((failure, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Ticket className="h-4 w-4 text-primary"/>
                            <span className="font-semibold text-foreground">
                              Ticket #{failure.ticketNumber}:
                              <span className="font-normal text-muted-foreground ml-2">{failure.email}</span>
                            </span>
                          </div>
                          <Badge variant="destructive">Failed</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground italic mb-3">"{failure.subject}"</p>
                      
                      <div className="text-xs space-y-2 mb-3">
                          <div className="flex items-center">
                              <Building className="h-3 w-3 mr-2 text-muted-foreground"/>
                              <span className="text-muted-foreground mr-1">Department:</span>
                              <span className="font-medium text-foreground">{failure.departmentName}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-2 text-muted-foreground"/>
                            <span className="text-muted-foreground mr-1">Assignee:</span>
                            <span className="font-medium text-foreground">{failure.assignee?.name || 'Unassigned'}</span>
                          </div>
                      </div>

                      <div className="p-3 rounded-md bg-muted/50 text-xs space-y-1">
                          <p><strong className="text-foreground">Reason:</strong> {failure.reason}</p>
                          <p><strong className="text-foreground">Error:</strong> {failure.errorMessage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="font-semibold">No Failures Found</p>
                  <p className="text-sm text-muted-foreground mt-1">There are no recorded email delivery failures for this department.</p>
                </div>
              )}
            </div>
            <DialogFooter className="pt-4 border-t mt-4">
                <Button variant="outline" onClick={handleExportFailures} disabled={emailFailures.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Emails
                </Button>
                <Button variant="destructive" onClick={handleClearFailures} disabled={emailFailures.length === 0}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Failures
                </Button>
                <Button onClick={() => setIsFailuresModalOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SingleTicket;