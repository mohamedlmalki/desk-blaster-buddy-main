// server/index.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:8080" } });

const port = process.env.PORT || 3000;

const tokenCache = {};
const activeJobs = {};
const TICKET_LOG_PATH = path.join(__dirname, 'ticket-log.json');

// --- HELPER FUNCTIONS FOR TICKET LOG ---
const readTicketLog = () => {
    try {
        if (fs.existsSync(TICKET_LOG_PATH)) {
            const data = fs.readFileSync(TICKET_LOG_PATH);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Could not read ticket-log.json:', error);
    }
    return [];
};

const writeToTicketLog = (newEntry) => {
    const log = readTicketLog();
    log.push(newEntry);
    try {
        fs.writeFileSync(TICKET_LOG_PATH, JSON.stringify(log, null, 2));
    } catch (error) {
        console.error('[ERROR] Could not write to ticket-log.json:', error);
    }
};
// --- END HELPER FUNCTIONS ---


const createJobId = (socketId, profileName) => `${socketId}_${profileName}`;

app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

const parseError = (error) => {
    if (error.response) {
        if (error.response.data && error.response.data.message) {
            return {
                message: error.response.data.message,
                fullResponse: error.response.data
            };
        }
        if (typeof error.response.data === 'string' && error.response.data.includes('<title>')) {
            const titleMatch = error.response.data.match(/<title>(.*?)<\/title>/);
            const title = titleMatch ? titleMatch[1] : 'HTML Error Page Received';
            return {
                message: `Zoho Server Error: ${title}`,
                fullResponse: error.response.data
            };
        }
        return {
            message: `HTTP Error ${error.response.status}: ${error.response.statusText}`,
            fullResponse: error.response.data || error.response.statusText
        };
    } else if (error.request) {
        return {
            message: 'Network Error: No response received from Zoho API.',
            fullResponse: error.message
        };
    }
    return {
        message: error.message || 'An unknown error occurred.',
        fullResponse: error.stack
    };
};

const getValidAccessToken = async (profile) => {
    const now = Date.now();
    
    if (tokenCache[profile.profileName] && tokenCache[profile.profileName].data.access_token && tokenCache[profile.profileName].expiresAt > now) {
        return tokenCache[profile.profileName].data;
    }

    try {
        const params = new URLSearchParams({
            refresh_token: profile.refreshToken,
            client_id: profile.clientId,
            client_secret: profile.clientSecret,
            grant_type: 'refresh_token',
            scope: 'Desk.tickets.ALL,Desk.settings.ALL'
        });

        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
        
        if (response.data.error) {
            throw new Error(response.data.error);
        }
        
        const { expires_in } = response.data;
        tokenCache[profile.profileName] = { data: response.data, expiresAt: now + ((expires_in - 60) * 1000) };
        return response.data;

    } catch (error) {
        const { message } = parseError(error);
        console.error(`TOKEN_REFRESH_FAILED for ${profile.profileName}:`, message);
        throw error;
    }
};

const makeApiCall = async (method, relativeUrl, data, profile) => {
    const tokenResponse = await getValidAccessToken(profile);
    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
        throw new Error('Failed to retrieve a valid access token.');
    }

    const fullUrl = `https://desk.zoho.com${relativeUrl}`;

    const headers = { 
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'orgId': profile.orgId 
    };
    
    return axios({ method, url: fullUrl, data, headers });
};

// --- HTTP ENDPOINT FOR SINGLE TICKET ---
app.post('/api/tickets/single', async (req, res) => {
    const { email, subject, description, selectedProfileName, sendDirectReply } = req.body;

    if (!email || !selectedProfileName) {
        return res.status(400).json({ success: false, error: 'Missing email or profile.' });
    }
    try {
        const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
        const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
        if (!activeProfile) {
            return res.status(404).json({ success: false, error: 'Profile not found.' });
        }
        
        const ticketData = { 
            subject, 
            description, 
            departmentId: activeProfile.defaultDepartmentId, 
            contact: { email },
            channel: 'Email' 
        };

        const ticketResponse = await makeApiCall('post', '/api/v1/tickets', ticketData, activeProfile);
        const newTicket = ticketResponse.data;
        let fullResponseData = { ticketCreate: newTicket };

        writeToTicketLog({ ticketNumber: newTicket.ticketNumber, email });

        if (sendDirectReply) {
            try {
                const replyData = {
                    fromEmailAddress: activeProfile.fromEmailAddress,
                    to: email,
                    content: description,
                    contentType: 'html',
                    channel: 'EMAIL'
                };
                const replyResponse = await makeApiCall('post', `/api/v1/tickets/${newTicket.id}/sendReply`, replyData, activeProfile);
                fullResponseData.sendReply = replyResponse.data;
            } catch (replyError) {
                fullResponseData.sendReply = parseError(replyError);
            }
        }
        
        res.json({ success: true, fullResponse: fullResponseData });

    } catch (error) {
        const { message, fullResponse } = parseError(error);
        res.status(500).json({ success: false, error: message, fullResponse });
    }
});


app.get('/api/profiles', (req, res) => {
    try {
        const profilesData = fs.readFileSync(path.join(__dirname, 'profiles.json'));
        const allProfiles = JSON.parse(profilesData);
        const safeProfiles = allProfiles.map(({ refreshToken, clientId, clientSecret, ...rest }) => rest);
        res.json(safeProfiles);
    } catch (error) {
        res.status(500).json({ message: "Could not load profiles." });
    }
});

io.on('connection', (socket) => {
    console.log(`[INFO] New connection. Socket ID: ${socket.id}`);

    socket.on('checkApiStatus', async (data) => {
        try {
            const { selectedProfileName } = data;
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
            const tokenResponse = await getValidAccessToken(activeProfile);
            socket.emit('apiStatusResult', { 
                success: true, 
                message: 'Token is valid. Connection to Zoho API is successful.',
                fullResponse: tokenResponse
            });
        } catch (error) {
            const { message, fullResponse } = parseError(error);
            socket.emit('apiStatusResult', { 
                success: false, 
                message: `Connection failed: ${message}`,
                fullResponse: fullResponse
            });
        }
    });
    
    const interruptibleSleep = (ms, jobId) => {
        return new Promise(resolve => {
            if (ms <= 0) return resolve();
            const interval = 100;
            let elapsed = 0;
            const timerId = setInterval(() => {
                if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') {
                    clearInterval(timerId);
                    return resolve();
                }
                elapsed += interval;
                if (elapsed >= ms) {
                    clearInterval(timerId);
                    resolve();
                }
            }, interval);
        });
    };

    // --- NEW: WebSocket listener for verifying a single ticket ---
    socket.on('verifySingleTicket', async ({ ticket, profileName }) => {
        try {
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === profileName);
            if (activeProfile && ticket) {
                await verifyTicketEmail(ticket, activeProfile, socket, 'singleTicketVerificationResult');
            }
        } catch (error) {
            console.error('[ERROR] in verifySingleTicket:', error);
        }
    });


    socket.on('sendTestTicket', async (data) => {
        const { email, subject, description, selectedProfileName, sendDirectReply, verifyEmail } = data;
        if (!email || !selectedProfileName) {
            return socket.emit('testTicketResult', { success: false, error: 'Missing email or profile.' });
        }
        try {
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
            if (!activeProfile) {
                return socket.emit('testTicketResult', { success: false, error: 'Profile not found.' });
            }
            
            const ticketData = { 
                subject, 
                description, 
                departmentId: activeProfile.defaultDepartmentId, 
                contact: { email },
                channel: 'Email' 
            };

            const ticketResponse = await makeApiCall('post', '/api/v1/tickets', ticketData, activeProfile);
            const newTicket = ticketResponse.data;
            let fullResponseData = { ticketCreate: newTicket };

            writeToTicketLog({ ticketNumber: newTicket.ticketNumber, email });

            if (sendDirectReply) {
                try {
                    const replyData = {
                        fromEmailAddress: activeProfile.fromEmailAddress,
                        to: email,
                        content: description,
                        contentType: 'html',
                        channel: 'EMAIL'
                    };
                    const replyResponse = await makeApiCall('post', `/api/v1/tickets/${newTicket.id}/sendReply`, replyData, activeProfile);
                    fullResponseData.sendReply = replyResponse.data;
                } catch (replyError) {
                    fullResponseData.sendReply = parseError(replyError);
                }
            }

            socket.emit('testTicketResult', { success: true, fullResponse: fullResponseData });

            if (verifyEmail) {
                verifyTicketEmail(newTicket, activeProfile, socket, 'testTicketVerificationResult');
            }

        } catch (error) {
            const { message, fullResponse } = parseError(error);
            socket.emit('testTicketResult', { success: false, error: message, fullResponse });
        }
    });

    socket.on('startBulkCreate', async (data) => {
        const { emails, subject, description, delay, selectedProfileName, sendDirectReply, verifyEmail } = data;
        
        const jobId = createJobId(socket.id, selectedProfileName);
        activeJobs[jobId] = { status: 'running' };

        try {
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
            if (!activeProfile) {
                throw new Error('Profile not found.');
            }
            if (sendDirectReply && !activeProfile.fromEmailAddress) {
                throw new Error(`Profile "${selectedProfileName}" is missing "fromEmailAddress".`);
            }
            
            for (let i = 0; i < emails.length; i++) {
                if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;
                while (activeJobs[jobId]?.status === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                if (i > 0 && delay > 0) await interruptibleSleep(delay * 1000, jobId);
                if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

                const email = emails[i];
                if (!email.trim()) continue;

                const ticketData = { 
                    subject, 
                    description, 
                    departmentId: activeProfile.defaultDepartmentId, 
                    contact: { email },
                    channel: 'Email' 
                };

                try {
                    const ticketResponse = await makeApiCall('post', '/api/v1/tickets', ticketData, activeProfile);
                    const newTicket = ticketResponse.data;
                    let successMessage = `Ticket #${newTicket.ticketNumber} created.`;
                    let fullResponseData = { ticketCreate: newTicket };
                    let overallSuccess = true; 

                    writeToTicketLog({ ticketNumber: newTicket.ticketNumber, email });

                    if (sendDirectReply) {
                        try {
                            const replyData = {
                                fromEmailAddress: activeProfile.fromEmailAddress,
                                to: email,
                                content: description,
                                contentType: 'html',
                                channel: 'EMAIL'
                            };

                            const replyResponse = await makeApiCall('post', `/api/v1/tickets/${newTicket.id}/sendReply`, replyData, activeProfile);
                            
                            successMessage = `Ticket #${newTicket.ticketNumber} created and reply sent.`;
                            fullResponseData.sendReply = replyResponse.data;
                        } catch (replyError) {
                            overallSuccess = false;
                            const { message } = parseError(replyError);
                            successMessage = `Ticket #${newTicket.ticketNumber} created, but reply failed: ${message}`;
                            fullResponseData.sendReply = { error: parseError(replyError) };
                        }
                    }

                    socket.emit('ticketResult', { 
                        email, 
                        success: overallSuccess,
                        ticketNumber: newTicket.ticketNumber, 
                        details: successMessage,
                        fullResponse: fullResponseData,
                        profileName: selectedProfileName
                    });

                    if (verifyEmail) {
                        verifyTicketEmail(newTicket, activeProfile, socket);
                    }

                } catch (error) {
                    const { message, fullResponse } = parseError(error);
                    socket.emit('ticketResult', { email, success: false, error: message, fullResponse, profileName: selectedProfileName });
                }
            }

        } catch (error) {
            socket.emit('bulkError', { message: error.message || 'A critical server error occurred.', profileName: selectedProfileName });
        } finally {
            if (activeJobs[jobId]) {
                const finalStatus = activeJobs[jobId].status;
                if (finalStatus === 'ended') {
                    socket.emit('bulkEnded', { profileName: selectedProfileName });
                } else {
                    socket.emit('bulkComplete', { profileName: selectedProfileName });
                }
                delete activeJobs[jobId];
            }
        }
    });
    
    const verifyTicketEmail = async (ticket, profile, socket, resultEventName = 'ticketUpdate') => {
        let fullResponse = { ticketCreate: ticket, verifyEmail: {} };
        try {
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const [workflowHistoryResponse, notificationHistoryResponse] = await Promise.all([
                makeApiCall('get', `/api/v1/tickets/${ticket.id}/History?eventFilter=WorkflowHistory`, null, profile),
                makeApiCall('get', `/api/v1/tickets/${ticket.id}/History?eventFilter=NotificationRuleHistory`, null, profile)
            ]);
    
            const allHistoryEvents = [
                ...(workflowHistoryResponse.data.data || []),
                ...(notificationHistoryResponse.data.data || [])
            ];
            
            fullResponse.verifyEmail.history = { workflowHistory: workflowHistoryResponse.data, notificationHistory: notificationHistoryResponse.data };
    
            if (allHistoryEvents.length > 0) {
                const verificationMessage = 'Email verification: Sent successfully.';
                const finalDetails = `Ticket #${ticket.ticketNumber} created. ${verificationMessage}`;
                socket.emit(resultEventName, {
                    ticketNumber: ticket.ticketNumber,
                    success: true, 
                    details: finalDetails,
                    fullResponse,
                    profileName: profile.profileName,
                });
            } else {
                const failureResponse = await makeApiCall('get', `/api/v1/emailFailureAlerts?department=${profile.defaultDepartmentId}`, null, profile);
                const failure = failureResponse.data.data?.find(f => f.ticketNumber === ticket.ticketNumber);
                
                fullResponse.verifyEmail.failure = failure || "No specific failure found for this ticket.";
    
                let verificationMessage = 'Email verification: Not Found.';
                if (failure) {
                    verificationMessage = `Email verification: Failed. Reason: ${failure.reason}`;
                }
                const finalDetails = `Ticket #${ticket.ticketNumber} created. ${verificationMessage}`;
                
                socket.emit(resultEventName, {
                    ticketNumber: ticket.ticketNumber,
                    success: false, 
                    details: finalDetails,
                    fullResponse,
                    profileName: profile.profileName,
                });
            }
    
        } catch (error) {
            const { message } = parseError(error);
            console.error(`Failed to verify email for ticket #${ticket.ticketNumber}:`, message);
            fullResponse.verifyEmail.error = message;
            socket.emit(resultEventName, {
                ticketNumber: ticket.ticketNumber,
                success: false,
                details: `Ticket #${ticket.ticketNumber} created. Email verification: Failed to check status.`,
                fullResponse,
                profileName: profile.profileName,
            });
        }
    };
    
    socket.on('pauseJob', ({ profileName }) => {
        const jobId = createJobId(socket.id, profileName);
        if (activeJobs[jobId]) {
            activeJobs[jobId].status = 'paused';
        }
    });

    socket.on('resumeJob', ({ profileName }) => {
        const jobId = createJobId(socket.id, profileName);
        if (activeJobs[jobId]) {
            activeJobs[jobId].status = 'running';
        }
    });

    socket.on('endJob', ({ profileName }) => {
        const jobId = createJobId(socket.id, profileName);
        if (activeJobs[jobId]) {
            activeJobs[jobId].status = 'ended';
        }
    });

    socket.on('disconnect', () => {
        Object.keys(activeJobs).forEach(jobId => {
            if (jobId.startsWith(socket.id)) {
                delete activeJobs[jobId];
            }
        });
    });

    socket.on('getEmailFailures', async (data) => {
        try {
            const { selectedProfileName } = data;
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
            if (!activeProfile) {
                throw new Error('Profile not found for fetching email failures.');
            }

            const departmentId = activeProfile.defaultDepartmentId;
            const response = await makeApiCall('get', `/api/v1/emailFailureAlerts?department=${departmentId}&limit=50`, null, activeProfile);
            
            const failures = response.data.data || [];
            const ticketLog = readTicketLog();
            const failuresWithEmails = failures.map(failure => {
                const logEntry = ticketLog.find(entry => String(entry.ticketNumber) === String(failure.ticketNumber));
                return {
                    ...failure,
                    email: logEntry ? logEntry.email : 'Unknown',
                };
            });

            socket.emit('emailFailuresResult', { success: true, data: failuresWithEmails });
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('emailFailuresResult', { success: false, error: message });
        }
    });

    socket.on('clearEmailFailures', async (data) => {
        try {
            const { selectedProfileName } = data;
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);
            if (!activeProfile) {
                throw new Error('Profile not found for clearing email failures.');
            }

            const departmentId = activeProfile.defaultDepartmentId;
            await makeApiCall('patch', `/api/v1/emailFailureAlerts?department=${departmentId}`, null, activeProfile);
            
            socket.emit('clearEmailFailuresResult', { success: true });
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('clearEmailFailuresResult', { success: false, error: message });
        }
    });
    
    socket.on('clearTicketLogs', () => {
        try {
            fs.writeFileSync(TICKET_LOG_PATH, JSON.stringify([], null, 2));
            socket.emit('clearTicketLogsResult', { success: true });
        } catch (error) {
            console.error('[ERROR] Could not clear ticket-log.json:', error);
            socket.emit('clearTicketLogsResult', { success: false, error: 'Failed to clear log file on server.' });
        }
    });

    socket.on('getMailReplyAddressDetails', async (data) => {
        try {
            const { selectedProfileName } = data;
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);

            if (!activeProfile) {
                return socket.emit('mailReplyAddressDetailsResult', { success: false, error: 'Profile not found' });
            }
            
            if (!activeProfile.mailReplyAddressId) {
                return socket.emit('mailReplyAddressDetailsResult', { success: true, notConfigured: true });
            }

            const response = await makeApiCall('get', `/api/v1/mailReplyAddress/${activeProfile.mailReplyAddressId}`, null, activeProfile);
            socket.emit('mailReplyAddressDetailsResult', { success: true, data: response.data });

        } catch (error) {
            const { message } = parseError(error);
            socket.emit('mailReplyAddressDetailsResult', { success: false, error: message });
        }
    });

    socket.on('updateMailReplyAddressDetails', async (data) => {
        try {
            const { selectedProfileName, displayName } = data;
            const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json')));
            const activeProfile = profiles.find(p => p.profileName === selectedProfileName);

            if (!activeProfile || !activeProfile.mailReplyAddressId) {
                throw new Error('Mail Reply Address ID is not configured for this profile.');
            }

            const updateData = { displayName };
            const response = await makeApiCall('patch', `/api/v1/mailReplyAddress/${activeProfile.mailReplyAddressId}`, updateData, activeProfile);
            
            socket.emit('updateMailReplyAddressResult', { success: true, data: response.data });
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('updateMailReplyAddressResult', { success: false, error: message });
        }
    });
    
});

server.listen(port, () => {
    console.log(`?? Server is running on http://localhost:${port}`);
});