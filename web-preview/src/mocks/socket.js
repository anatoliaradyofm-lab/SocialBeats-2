// socket.io-client + socketService — mock
const mockSocket = { on: () => mockSocket, off: () => mockSocket, emit: () => mockSocket, connect: () => mockSocket, disconnect: () => mockSocket, connected: false, id: 'preview' };
export const io = () => mockSocket;
export default { connect: () => mockSocket, disconnect: () => {}, emit: () => {}, on: () => {}, off: () => {}, getSocket: () => mockSocket };
