const SerialPort = require('serialport');
//var net = require('net');
//const dgram = require('dgram');
var udp = require('datagram-stream');
//Class for a single Serial <-> IP (UDP) link

class UDPLink {
    
    constructor(comPort, baud, IP, IPport) {
        this.port = new SerialPort(comPort, {baudRate: baud, highWaterMark: 131072}, function (err) {
            if (err) {
                console.log('Serial Error: ', err.message)
                return null;
            }
        });
        this.stream = udp({
            address     : '0.0.0.0'         //address to bind to
            , broadcast : IP //broadcast ip address to send to
            , port      : IPport              //udp port to send to
            , bindingPort : IPport            //udp port to listen on. Default: port
            , reuseAddr : true              //boolean: allow multiple processes to bind to the
                                            //         same address and port. Default: true
            }, function (err) {
                if (err) {
                    console.log('UDP Server Error: ', err.message)    
                    return null;
                }                
         });
        this.port.pipe(this.stream);
        this.stream.pipe(this.port);    
        console.log('UDP <-> Serial Running')
        this.port.on('error', (err) => {
            console.log('Serial Port Error: ', err.message)    
            return null;
        });
        this.stream.on('close', (err) => {
			if (this.port.isOpen) {
				console.log('Closing UDP Link');
				this.port.close();
			}
        });
    }
    
    closeLink() {
        this.stream.close();
        //this.port.destroy();
        
    }

}

module.exports = UDPLink
