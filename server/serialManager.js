const fs = require('fs');
var path = require('path');
const os = require('os');
const SerialPort = require('serialport');
const TCPLink = require('./TCPLink');
const UDPLink = require('./UDPLink');
const net = require('net')
//Class for manager serial port <-> IP streaming

class serialManager {
    constructor() {
        //this.portA = {name: "COM17", baud: 57600, contype: "TCP", conIP: "0.0.0.0", conPort: 14550, status: "Started"};
        //this.portB = {name: "COM10", baud: 9600, contype: "UDP", conIP: "192.168.0.1", conPort: 15000, status: "Started"};
        this.iface = [];
        this.ports = [];

        this.activeLinks = [];

        this.filesavepath = path.join(".", 'serialSettings.json')

        this.scanInterfaces();

        //load the serial.json, if it exists
        fs.readFile(this.filesavepath, (err, data) => {
            if (err) {
                console.log("No " + this.filesavepath);
            }
            else {
                try {
                    this.ports = JSON.parse(data);
                    console.log(this.filesavepath + ' read');
                } catch(err) {
                    console.log("Cannot read" + this.filesavepath);
                    this.ports = [];
                }

            }

            //check the loaded settings against the current config
            // ie valid ports and IP's
            this.refreshPorts();

            // start any saved links
            for (var i = 0; i < this.ports.length; i++) {
                if (this.ports[i].status == 'Started') {
                    console.log("Starting saved link " + this.ports[i].name);
                    this.startLink(this.ports[i].name, this.ports[i].baud, this.ports[i].contype, this.ports[i].conIP, this.ports[i].conPort);
                }
            }
        });

    }

    refreshPorts() {
        //Scan for all serial ports
        this.ports = this.SyncScanSerial(this.ports, this.iface);
        console.log("There are " + this.ports.length + " valid ports");
    }

    updateLinkSettings(newPortInfo) {
        //update the settings for 1 port
        //start/stop as required
        //if started and settings changed, stop, change start
        //check the input is OK
        if (newPortInfo.field === "baud" && !(!Number.isNaN(newPortInfo.newValue) && newPortInfo.newValue > 0)) {
            console.log("Bad setting for " + newPortInfo.field + " => " + newPortInfo.newValue);
            return;
        }
        else if (newPortInfo.field === "contype" && !(newPortInfo.newValue === "UDP" || newPortInfo.newValue === "TCP")) {
            console.log("Bad setting for " + newPortInfo.field + " => " + newPortInfo.newValue);
            return;
        }
        else if (newPortInfo.field === "conIP" && !net.isIP(newPortInfo.newValue) === 4) {
            console.log("Bad setting for " + newPortInfo.field + " => " + newPortInfo.newValue);
            return;
        }
        else if (newPortInfo.field === "conPort" && !(!Number.isNaN(newPortInfo.newValue) && newPortInfo.newValue > 1000)) {
            console.log("Bad setting for " + newPortInfo.field + " => " + newPortInfo.newValue);
            return;
        }
        else if (newPortInfo.field === "status" && !(newPortInfo.newValue === "Started" || newPortInfo.newValue === "Stopped")) {
            console.log("Bad setting for " + newPortInfo.field + " => " + newPortInfo.newValue);
            return;
        }
        else {
            //save to file
            for (var i = 0; i < this.ports.length; i++) {
                if (this.ports[i].name == newPortInfo.name) {
                    this.ports[i][newPortInfo.field] = newPortInfo.newValue;
                    console.log("Changing settings for " + this.ports[i].name + "." + newPortInfo.field);
                    //and save to file
                    this.saveSerialSettings();
                    if (this.ports[i].status == "Started") {
                        //stop--modify-then-start link
                        if(this.ports[i].name in this.activeLinks) {
                            this.stopLink(this.ports[i].name);
                        }
                        require('deasync').sleep(200);
                        this.startLink(this.ports[i].name, this.ports[i].baud, this.ports[i].contype, this.ports[i].conIP, this.ports[i].conPort);
                    }
                    //stop link if requested
                    if (this.ports[i].status == "Stopped" && this.ports[i].name in this.activeLinks) {
                        this.stopLink(this.ports[i].name);
                    }
                }
            }
        }
    }

    stopLink(port) {
        //close down a particular link

        //first check if we've already got an active link
        if(!(port in this.activeLinks)) {
            console.log('Link not active');
            return;
        }
        console.log('Stopped link for ' + port);
        this.activeLinks[port].closeLink();
        //delete this.activeLinks[port];

    }

    startLink(port, baud, type, ip, ipport) {
        //Start a serial <-> IP link

        //first check if we've already got an active link
        if(port in this.activeLinks) {
            console.log('Link already in Manager');
            return;
        }
        if (type == 'TCP') {
            this.activeLinks[port] = new TCPLink(port, parseInt(baud), ip, ipport);
            this.activeLinks[port].on('closed', (port) => {
                console.log("Closing down link: " + port);
                delete this.activeLinks[port];
            });
            console.log('Started TCP link for ' + port);
        }
        else if (type == 'UDP') {
            this.activeLinks[port] = new UDPLink(port, parseInt(baud), ip, ipport);
            this.activeLinks[port].on('closed', (port) => {
                console.log("Closing down link: " + port);
                delete this.activeLinks[port];
            });
            console.log('Started UDP link for ' + port);
        }

    }

    SyncScanSerial(inPorts, ifaces){
        //synchonous version of scanSerial()
        var ret;
        this.scanSerial(inPorts, ifaces).then( function(ports, err){
            ret = ports;
        });
        while(ret === undefined) {
            require('deasync').sleep(100);
        }
        return ret;
    }

    scanSerial(inPorts, ifaces, errcallback) {
        //Get the serial ports and add to this.ports
        //assumes the serialSettings.json is already read in
        //var scanports = ["COM10", "COM5"];
        return new Promise(function(resolve, reject) {
        SerialPort.list().then( function(ports, err) {
            var ret = [];
            var retForm = []
            for (const portID in ports) {
                if (ports[portID].pnpId !== undefined ||
                    ports[portID].comName === "/dev/ttySC0" ||
                    ports[portID].comName === "/dev/ttySC1") {
                        console.log("Found port " + ports[portID].comName);
                        console.log(ports[portID])
                        ret.push(ports[portID].comName)
                }
            }
            if (fs.existsSync('/dev/serial0')) {
                ret.push('/dev/serial0');
            }
            for (var i = 0; i < ret.length; i++) {
                //add in ports, with saved settings if found in inPorts
                var added = false;
                for (var j = 0; j < inPorts.length; j++) {
                    if (inPorts[j].name == ret[i]) {
                        retForm.push(inPorts[j]);
                        console.log("Adding existing port " + ret[i]);
                        added = true;
                    }
                }
                //if not in this.ports, add it in as a new port
                if (!added) {
                    retForm.push({name: ret[i], baud: 115200, contype: "UDP", conIP: ifaces[0].value, conPort: 15000, status: "Stopped"});
                    console.log("Adding new port " + ret[i]);
                }
            }
            //reset any ifaces that are not valid
            for (i = 0; i < retForm.length; i++) {
                var goodIP = false;
                for (j = 0; j < ifaces.length; j++) {
                    if (ifaces[j].value === retForm[i].conIP) {
                        goodIP = true;
                    }
                }
                if (!goodIP) {
                    //iface no longer exists, reset it
                    console.log("Resetting IP for port " + retForm[i].name);
                    retForm[i].conIP = ifaces[0].value;
                    retForm[i].status = "Stopped";
                }
            }

            resolve(retForm);
        });
    });


    }

    scanInterfaces() {
        //scan for available IP (v4 only) interfaces
        var ifaces = os.networkInterfaces();

        for (const ifacename in ifaces) {
            var alias = 0;
            for (var j = 0; j < ifaces[ifacename].length; j++) {
                if ('IPv4' == ifaces[ifacename][j].family && alias >= 1) {
                  // this single interface has multiple ipv4 addresses
                  console.log("Found IP " + ifacename + ':' + alias, ifaces[ifacename][j].address);
                  this.iface.push({value: ifaces[ifacename][j].address, label: ifaces[ifacename][j].address});
                } else if ('IPv4' == ifaces[ifacename][j].family) {
                  // this interface has only one ipv4 adress
                  console.log("Found IP " + ifacename, ifaces[ifacename][j].address);
                  this.iface.push({value: ifaces[ifacename][j].address, label: ifaces[ifacename][j].address});
                }
                ++alias;
            }
        }
    }

    saveSerialSettings() {
        //Save the current settings to file
        let data = JSON.stringify(this.ports);

        fs.writeFile(this.filesavepath, data, (err) => {
            if (err) throw err;
            console.log(this.filesavepath + ' written');
        });
    }
}

module.exports = serialManager
