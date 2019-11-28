const process = require('process');
const {exec, spawn} = require('child_process');
const os = require('os');

class videoStream {
    constructor() {
        this.active = false;
        this.deviceStream = null;
        this.deviceAddresses = [];
        this.devices = null;
    }

    //video streaming
    getVideoDevices(callback) {
        //get all video device details
        exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                this.devices = JSON.parse(stdout);
                return callback(null, this.devices)
            }
        });

    }

    scanInterfaces() {
        //scan for available IP (v4 only) interfaces
        var iface = [];
        var ifaces = os.networkInterfaces();

        for (const ifacename in ifaces) {
            var alias = 0;
            for (var j = 0; j < ifaces[ifacename].length; j++) {
                if ('IPv4' == ifaces[ifacename][j].family && alias >= 1) {
                  // this single interface has multiple ipv4 addresses
                  //console.log("Found IP " + ifacename + ':' + alias, ifaces[ifacename][j].address);
                  iface.push(ifaces[ifacename][j].address);
                } else if ('IPv4' == ifaces[ifacename][j].family) {
                  // this interface has only one ipv4 adress
                  //console.log("Found IP " + ifacename, ifaces[ifacename][j].address);
                  iface.push(ifaces[ifacename][j].address);
                }
                ++alias;
            }
        }
        return iface;
    }

    startStopStreaming(device, height, width, format, callback) {
        //user wants to start or stop streaming
        if (!this.active) {
            //check it's a valid video device
            var found = false;
            for (var j = 0; j < this.devices.length; j++) {
                if (device === this.devices[j].value) {
                    found = true;
                }
            }
            if (!found) {
                return;
            }

            this.active = true;
            this.ifaces = this.scanInterfaces();
            this.deviceAddresses = [];
            for (var j = 0; j < this.ifaces.length; j++) {
                this.deviceAddresses.push("rtsp://" + this.ifaces[j] + ":8554/video");
            }

            console.log(format);

            this.deviceStream = spawn("python3", ["./python/rtsp-server.py",
                                                  "--video=" + device,
                                                  "--height=" + height,
                                                  "--width=" + width,
                                                  "--format=" + format,
                                                  "--bitrate=" + 1000,
                                                  ]);
            this.deviceStream.stdout.on('data', (data) => {
              console.log(`GST stdout: ${data}`);
            });

            this.deviceStream.stderr.on('data', (data) => {
              console.error(`GST stderr: ${data}`);
            });

            this.deviceStream.on('close', (code) => {
              console.log(`GST process exited with code ${code}`);
                this.deviceStream.stdin.pause();
                this.deviceStream.kill();
                this.deviceStream
                this.active = false;
                this.deviceAddress = "N/A";
            });

            return callback(null, this.active, this.deviceAddresses);
        }
        else {
            this.deviceStream.stdin.pause();
            this.deviceStream.kill();
            this.deviceStream
            this.active = false;
            this.deviceAddresses = [];
        }
        return callback(null, this.active, this.deviceAddresses);
    }
}

module.exports = videoStream
