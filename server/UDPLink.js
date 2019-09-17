const SerialPort = require('serialport');
var EventEmitter = require('events');
var udp = require('datagram-stream');
//Class for a single Serial <-> IP (UDP) link

class UDPLink extends EventEmitter {

    constructor(comPort, baud, IP, IPport) {
        super();
        this.comPort = comPort;
        this.port = new SerialPort(comPort, {baudRate: baud, highWaterMark: 131072}, function (err) {
            if (err) {
                this.closeLink();
                console.log('Serial Error: ', err.message)
            }
        });
        this.stream = udp({
            address     : IP         //address to bind to
            , broadcast : '255.255.255.255' //broadcast ip address to send to
            , port      : IPport              //udp port to send to
            , bindingPort : IPport            //udp port to listen on. Default: port
            , reuseAddr : true              //boolean: allow multiple processes to bind to the
                                            //         same address and port. Default: true
            }, function (err) {
                if (err) {
                    this.closeLink();
                    console.log('UDP Server Error: ', err.message)
                }
         });
        var sta = this.port.pipe(this.stream);
        var stb = this.stream.pipe(this.port);
        console.log('UDP <-> Serial Running')
        sta.on('error', (err) => {
            this.closeLink();
            console.log('Closing Serial Port: ', err.message)
        });
        stb.on('close', (err) => {
            console.log('Closing UDP Link: ', err.message);
            this.closeLink();
        });
        stb.on('error', (err) => {
            console.log('Stream error: ', err.message);
            this.closeLink();
        });
    }

    closeLink() {
        if (this.port.isOpen) {
            this.port.close();
        }
        this.stream.close();
        this.emit('closed', this.comPort);
        //this.port.destroy();

    }

}

module.exports = UDPLink
