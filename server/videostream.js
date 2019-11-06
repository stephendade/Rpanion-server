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
    //get usb device name (sync)
    getUSBNiceName(vendorID, productID) {
        var ret;
        exec('lsusb -d ' + vendorID + ":" + productID, (error, stdout, stderr) => {
            if (!stderr) {
                ret = stdout.split(vendorID + ":" + productID)[1].trim()
            }
            else {
                ret = "";
            }
        });
        while(ret === undefined) {
            require('deasync').sleep(50);
        }
        return ret;
    };

    //video streaming
    getVideoDevices(callback) {
        //get all video device details
        exec('gst-device-monitor-1.0 Video/Source', (error, stdout, stderr) => {
            if (stderr) {
                console.error(`exec error: ${error}`);
                return callback(stderr);
            }
            else {
                //go line by line
                var lines = stdout.split("\n");
                this.devices = [];
                var curDevice = {caps: [],};
                for(var i=0;i<lines.length;i++) {
                    //new device found, or at end of list
                    if (lines[i] === "Device found:" || i == lines.length-1) {
                        if (curDevice.caps.length > 0) {
                            //fix up the camera name if required
                            if (curDevice.label.includes("UVC Camera")) {
                                var newname = this.getUSBNiceName(curDevice.vendorID, curDevice.productID);
                                if (newname !== "") {
                                    curDevice.label = newname;
                                }
                            }
                            console.log("Found video device: " + curDevice.label + ", " + curDevice.value);
                            this.devices.push(curDevice);
                        }
                        curDevice = {caps: []};
                    }
                    else if (lines[i].includes("device.path = ")){
                        curDevice.value = lines[i].split("=")[1].trim();
                    }
                    else if (lines[i].includes("device.vendor.id = ")){
                        curDevice.vendorID = lines[i].split("=")[1].trim();
                    }
                    else if (lines[i].includes("device.product.id = ")){
                        curDevice.productID = lines[i].split("=")[1].trim();
                    }
                    else if (lines[i].includes("device.product.name = ")){
                        curDevice.label = lines[i].split("=")[1].trim().replace(/"/gi,'').replace(/\\/gi,'');
                    }
                    else if (lines[i].includes("video/x-raw,")){
                        var capline = this.parsegst(lines[i]); //lines[i].split(",");
                        var newcap = {selectFramerates: []};
                        for(var j=0;j<capline.length;j++) {
                            if (capline[j].includes("width=(int)")) {
                                newcap.width = parseInt(capline[j].split(")")[1]);
                            }
                            else if (capline[j].includes("height=(int)")) {
                                newcap.height = parseInt(capline[j].split(")")[1]);
                            }
                            //two formats for framerate - (fraction)11/1 or (fraction){ 30/1, 15/1 }
                            else if (capline[j].includes("framerate=(fraction)")) {
                                if (!capline[j].includes("{")) {
                                    var maxFramerate = parseInt(capline[j].split(")")[1].split("/")[0].replace(/\D/g,''));
                                    newcap.selectFramerates.push({value: maxFramerate, label: maxFramerate});
                                }
                                else {
                                    var strframes = capline[j].match(/{([^}]+)}/)[1];
                                    var strframesArray = strframes.split(",");
                                    for(var k=0;k<strframesArray.length;k++) {
                                        var fps = parseInt(strframesArray[k].split("/"));
                                        newcap.selectFramerates.push({value: fps, label: fps});
                                    }
                                }
                            }
                        }
                        //video/x-raw, format=(string)YUY2, width=(int)1280, height=(int)720, pixel-aspect-ratio=(fraction)1/1, framerate=(fraction)11/1;
                        //framerate=(fraction){ 30/1, 15/1 };
                        //var newcap = {width: 20, height: 40, framerate: 45}
                        newcap.value = i; //curDevice.caps.length;
                        newcap.label = "(" + newcap.width + "x" + newcap.height + ")";
                        curDevice.caps.push(newcap);
                        //console.log(newcap);
                    }
                }
                return callback(null, this.devices)
            }
        });

    }

    parsegst(str) {
        //parse csv string from gst-device-monitor
      let result = [], item = '', depth = 0;

      function push() { if (item) result.push(item); item = ''; }

      for (let i = 0, c; c = str[i], i < str.length; i++) {
        if (!depth && c === ',') push();
        else {
          item += c;
          if (c === '[' || c === '{') depth++;
          if (c === ']' || c === '}') depth--;
        }
      }

      push();
      return result;
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

    startStopStreaming(device, height, width, framerate, callback) {
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

            this.deviceStream = spawn("python3", ["./python/rtsp-server.py",
                                                  "--video=" + device,
                                                  "--height=" + height,
                                                  "--width=" + width,
                                                  "--fps=" + framerate,
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
