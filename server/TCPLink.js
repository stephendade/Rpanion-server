const SerialPort = require('serialport');
var net = require('net');
var EventEmitter = require('events');
//Class for a single Serial <-> IP (TCP) link

//var TCPEvents = new events.EventEmitter();

class TCPLink extends EventEmitter {
    constructor(comPort, baud, IP, IPport) {
        //start the server (server, then serial port)
        super();
        this.client = null;
        this.comPort = comPort;

        this.server = net.createServer((socket) => {
            console.log('TCP Client connected');
            this.client = socket;
            this.port = new SerialPort(comPort, {baudRate: baud, highWaterMark: 131072}, function (err) {
                if (err) {
                    this.closeLink();
                    console.log('Serial Error: ', err.message)
                }
            }.bind(this));
            var sta = this.port.pipe(this.client);
            var stb = this.client.pipe(this.port);
            console.log('TCP <-> Serial Running');
            this.client.on('end', () => {
                console.log('TCP Client disconnected');
                if (this.port.isOpen) {
                    this.port.close();
                }
            });
            stb.on('close', () => {
                console.log("Closing TCP Socket");
                if (this.port.isOpen) {
                    this.port.close();
                }
            });
            stb.on('error', (err) => {
                if (this.port.isOpen) {
                    this.port.close();
                }
                console.log('Client socket Error: ', err.message)
            });
            sta.on('error', (err) => {
                this.closeLink();
                console.log('Serial Port Error: ', err.message);
            });
        });
        this.server.on('error', (err) => {
            this.closeLink();
            console.log('TCP Error: ', err.message)
        });
        this.server.listen(IPport, IP, () => {
          console.log('TCP Server bound on ' + IPport);

        });
    }

    closeLink() {
        if (this.port && this.port.isOpen) {
            this.port.close();
        }
        if (this.client != null) {
            this.client.destroy();
        }
        this.server.close();
        this.emit('closed', this.comPort);
    }

}

module.exports = TCPLink
