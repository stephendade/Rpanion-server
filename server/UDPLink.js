const SerialPort = require('serialport');
var EventEmitter = require('events');
var udp = require('dgram');
var pipe = require('stream').prototype.pipe
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

        this.stream = UdpStreamer(IP, IPport, function (err) {
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

/*
 * UDP streamer class. Any udp packet
 * sent to it will initiate a udp stream
 * back in response.
 */
function UdpStreamer(address, port, cb) {
    var socket;
    var localAddress = address;
    var localPort = port;
    var remotes = []; //array of [rinfo.port, rinfo.address] for all clients

    socket = udp.createSocket({type: 'udp4', reuseAddr: true });

    socket.write = function (message) {
        for (var i = 0; i < remotes.length; i++) {
            socket.send(message, 0, message.length, remotes[i][0], remotes[i][1]);
        }
        return true;
    };

    socket.end = function () {
        setImmediate(function () {
            socket.emit('end')
            socket.close();
        });
    };

    socket.pause = function () {
        socket.paused = true;
        return this;
    };

    socket.resume = function () {
        socket.paused = false;
        return this;
    };

    socket.on('message', function (msg, rinfo) {
        if (!isRemote(rinfo.port, rinfo.address)) {
            remotes.push([rinfo.port, rinfo.address]);
            console.log("New UDP Client at " + rinfo.address + ":" + rinfo.port);
        }
        socket.emit('data', msg);
    });

    function isRemote(port, address) {
        for (var i = 0; i < remotes.length; i++) {
            if (remotes[i][0] === port && remotes[i][1] === address) {
                return true;
            }
        }
        return false;
    }

    socket.on('error', startupErrorListener);

    socket.bind(localPort, localAddress);

    socket.on('listening', function () {
        socket.removeListener('error', startupErrorListener);
        return cb && cb();
    });

    socket.pipe = pipe;

    return socket;

    function startupErrorListener(err) {
        return cb && cb(err);
    }
}

module.exports = UDPLink
