import React, { useMemo } from 'react'; // Import useMemo
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input'; // Import Input
import { CheckCircle2, XCircle, Eye, Hash, Mail, Clock, BarChart3, Download, Search } from 'lucide-react'; // Import more icons

export interface TicketResult {
  email: string;
  success: boolean;
  ticketNumber?: string;
  error?: string;
  details?: string;
  fullResponse?: any;
}

interface ResultsDisplayProps {
  results: TicketResult[];
  isProcessing: boolean;
  isComplete: boolean;
  totalTickets: number;
  countdown: number;
  filterText: string;
  onFilterTextChange: (text: string) => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ 
  results, 
  isProcessing, 
  isComplete,
  totalTickets,
  countdown,
  filterText,
  onFilterTextChange,
}) => {

  // --- START: NEW FEATURE 1 ---
  // Memoize the filtered results so it only recalculates when needed
  const filteredResults = useMemo(() => {
    if (!filterText) return results;
    return results.filter(r => 
      r.email.toLowerCase().includes(filterText.toLowerCase()) ||
      (r.details || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (r.error || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (r.success ? 'success' : 'failed').includes(filterText.toLowerCase())
    );
  }, [results, filterText]);
  // --- END: NEW FEATURE 1 ---

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  const progressPercent = totalTickets > 0 ? (results.length / totalTickets) * 100 : 0;

  // --- START: NEW FEATURE 2 ---
  // Logic for the export button
  const handleExport = () => {
    const header = "Email,Status,Details\n";
    const csvContent = filteredResults.map(r => {
      const status = r.success ? 'Success' : 'Failed';
      const details = (r.details || r.error || '').replace(/"/g, '""'); // Escape double quotes
      return `${r.email},${status},"${details}"`;
    }).join('\n');

    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "ticket-results.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- END: NEW FEATURE 2 ---

  if (results.length === 0 && !isProcessing) {
    return null;
  }

  return (
    <Card className="shadow-medium hover:shadow-large transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Processing Results</CardTitle>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="success" className="bg-success/10 text-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {successCount} Success
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive" className="bg-destructive/10">
                <XCircle className="h-3 w-3 mr-1" />
                {errorCount} Errors
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {isProcessing ? 'Creating tickets in real-time...' : 
           isComplete ? `All ${totalTickets} tickets have been processed.` : 
           'View results below.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {(isProcessing || (isComplete && results.length > 0)) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Progress</span>
              <div className="flex items-center space-x-2">
                {isProcessing && countdown > 0 && (
                  <Badge variant="outline" className="font-mono">
                    <Clock className="h-3 w-3 mr-1" />
                    Next ticket in {countdown}s
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">{results.length} / {totalTickets} processed</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        
        {results.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter results..."
                value={filterText}
                onChange={(e) => onFilterTextChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={handleExport} disabled={filteredResults.length === 0}>
              <Download className="h-4 w-4 mr-2"/>
              Export ({filteredResults.length})
            </Button>
          </div>
        )}

        {filteredResults.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                      <Hash className="h-4 w-4" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <Mail className="h-4 w-4" />
                        <span>Email</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredResults.map((result, index) => (
                    <tr 
                      key={index}
                      className={`transition-colors hover:bg-muted/30 ${
                        result.success ? 'bg-success/5' : 'bg-destructive/5'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-center text-muted-foreground font-mono">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {result.email}
                      </td>
                      <td className="px-4 py-3">
                        {result.success ? (
                          <Badge variant="success" className="bg-success/10 text-success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/10">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <span className={!result.success ? "text-destructive font-medium" : "font-medium"}>
                          {result.details || result.error}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl bg-card border-border shadow-large">
                            <DialogHeader>
                              <DialogTitle className="flex items-center space-x-2">
                                <Eye className="h-4 w-4" />
                                <span>
                                  {result.success 
                                    ? `Full Response - Ticket #${result.ticketNumber}`
                                    : `Error Response - ${result.email}`
                                  }
                                </span>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 p-1">
                              {result.fullResponse?.ticketCreate ? (
                                <>
                                  <div>
                                    <h4 className="text-sm font-semibold mb-2 text-foreground">Ticket Creation Response</h4>
                                    <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono text-foreground border border-border">
                                      {JSON.stringify(result.fullResponse.ticketCreate, null, 2)}
                                    </pre>
                                  </div>

                                  {'sendReply' in result.fullResponse && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 text-foreground">Send Reply Response</h4>
                                      <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono text-foreground border border-border">
                                        {JSON.stringify(result.fullResponse.sendReply, null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                  {'verifyEmail' in result.fullResponse && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 text-foreground">Email Verification Response</h4>
                                      <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono text-foreground border border-border">
                                        {JSON.stringify(result.fullResponse.verifyEmail, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div>
                                  <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono text-foreground border border-border">
                                    {JSON.stringify(result.fullResponse, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="mt-6 p-4 bg-gradient-success rounded-lg border border-success/20">
            <div className="flex items-center justify-center space-x-2 text-success-foreground">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Processing Complete!</span>
            </div>
            <p className="text-center text-sm text-success-foreground/80 mt-1">
              Successfully processed {successCount} out of {totalTickets} tickets
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};