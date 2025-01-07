// websocket.js

export class WebSocketClient {
    constructor(uri) {
        this.uri = uri;
        this.socket = null;
    }

    connect(onMessage) {
        this.socket = new WebSocket(this.uri);

        this.socket.addEventListener('open', () => {
            console.log('WebSocket connection established');
        });

        this.socket.addEventListener('message', (event) => {
            if (onMessage) {
                onMessage(event);
            }
        });

        this.socket.addEventListener('close', () => {
            console.log('WebSocket connection closed');
        });

        this.socket.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(data);
        } else {
            console.warn('WebSocket is not open. Unable to send data.');
        }
    }
}
