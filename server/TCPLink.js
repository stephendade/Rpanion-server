const SerialPort = require('serialport');
var net = require('net');
//Class for a single Serial <-> IP (TCP) link

class TCPLink {
        
        constructor(comPort, baud, IP, IPport) {
                //start the server (server, then serial port)
                this.client = null;
                this.server = net.createServer((socket) => {
                        console.log('TCP Client connected');
                        this.client = socket;
                        this.port = new SerialPort(comPort, {baudRate: baud, highWaterMark: 131072}, function (err) {
                                if (err) {
                                        console.log('Serial Error: ', err.message)
                                }
                        });
                        this.port.pipe(this.client);
                        this.client.pipe(this.port);        
                        console.log('TCP <-> Serial Running');
                        this.client.on('end', () => {
                                console.log('TCP Client disconnected');
                                if (this.port.isOpen) {
                                        this.port.close();
                                }
                        });
                        this.client.on('close', () => {
                                console.log("Closing TCP Socket");
                                if (this.port.isOpen) {
                                        this.port.close();
                                }
                        });
                        this.client.on('error', (err) => {
                                if (this.port.isOpen) {
                                        this.port.close();
                                }
                                console.log('Socket Error: ', err.message)
                                return null;
                        });
                        this.port.on('error', (err) => {
                                console.log('Serial Port Error: ', err.message)        
                                return null;
                        });
                });
                this.server.on('error', (err) => {
                        console.log('TCP Error: ', err.message)
                    return null;
                });
                this.server.listen(IPport, IP, () => {
                  console.log('TCP Server bound on ' + IPport);

                });
        }
        
        closeLink() {
                if (this.client != null) {
                        this.client.destroy();
                }
                this.server.close();                
        }
        
}

module.exports = TCPLink
