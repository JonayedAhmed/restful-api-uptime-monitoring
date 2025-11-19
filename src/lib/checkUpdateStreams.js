/**
 * Title: Check Update Streams Manager
 * Description: Manages SSE connections for real-time check status updates
 * Author: Jonayed Ahmed Riduan
 * Date: 12/20/2024
 */

// Store active SSE connections per user
const userStreams = new Map(); // userId -> Set of response objects

// Register a new SSE connection for a user
function registerCheckUpdateStream(userId, res) {
    if (!userStreams.has(userId)) {
        userStreams.set(userId, new Set());
    }
    
    const streams = userStreams.get(userId);
    streams.add(res);
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat\n\n`);
        } catch (err) {
            clearInterval(heartbeat);
            streams.delete(res);
            if (streams.size === 0) {
                userStreams.delete(userId);
            }
        }
    }, 30000);
    
    // Clean up on connection close
    res.on('close', () => {
        clearInterval(heartbeat);
        streams.delete(res);
        if (streams.size === 0) {
            userStreams.delete(userId);
        }
    });
    
    console.log(`SSE: User ${userId} connected. Active connections: ${streams.size}`);
}

// Broadcast check update to all connected clients for a specific user
function broadcastCheckUpdate(userId, checkUpdate) {
    const streams = userStreams.get(userId);
    if (!streams || streams.size === 0) return;
    
    const data = JSON.stringify(checkUpdate);
    const deadStreams = [];
    
    streams.forEach(res => {
        try {
            res.write(`event: checkUpdate\n`);
            res.write(`data: ${data}\n\n`);
        } catch (err) {
            deadStreams.push(res);
        }
    });
    
    // Remove dead connections
    deadStreams.forEach(res => streams.delete(res));
    if (streams.size === 0) {
        userStreams.delete(userId);
    }
}

// Get count of active streams for a user (for debugging)
function getActiveStreamCount(userId) {
    const streams = userStreams.get(userId);
    return streams ? streams.size : 0;
}

module.exports = {
    registerCheckUpdateStream,
    broadcastCheckUpdate,
    getActiveStreamCount
};
