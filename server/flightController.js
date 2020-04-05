const SerialPort = require('serialport');
const fs = require('fs');
const path = require('path');
var events = require('events');
var winston = require('./winstonconfig')(module);

const mavManager = require('../mavlink/mavManager.js');

class FCDetails {
    constructor(settings) {
        //if the device was successfully opend and got packets
        this.previousConnection = false;

        // all detected serial ports and baud rates
        this.serialDevices = [];
        this.baudRates = [{value: 9600, label: '9600'},
                          {value: 19200, label: '19200'},
                          {value: 38400, label: '38400'},
                          {value: 57600, label: '57600'},
                          {value: 115200, label: '115200'},
                          {value: 230400, label: '230400'},
                          {value: 460800, label: '460800'},
                          {value: 921600, label: '921600'}];
        this.mavlinkVersions = [{value: 1, label: '1.0'},
                                {value: 2, label: '2.0'}];
        //JSON of active device (port and baud and mavversion). User selected
        //null if user selected no link (or no serial port of that name)
        this.activeDevice = null;
        //the serial device object
        this.port = null;
        //the mavlink manager object
        this.m = null;

        //For sending events outside of object
        this.eventEmitter = new events.EventEmitter();

        //Interval to check connection status and re-connect
        //if required
        this.intervalObj = null;

        //UDP Outputs
        this.outputs = [];

        //find all serial devices
        this.getSerialDevicesSync();

        //load settings
        this.settings = settings;
        this.activeDevice = this.settings.value("flightcontroller.activeDevice", null);
        this.outputs = this.settings.value("flightcontroller.outputs", []);

        if (this.activeDevice !== null) {
            //restart link if saved serial device is found
            this.getSerialDevices((err, devices, bauds, seldevice, selbaud, active) => {
                for (var i = 0, len = devices.length; i < len; i++) {
                    if (this.activeDevice.serial.value === devices[i].value) {
                        this.startLink((err, active) => {
                            if (err) {
                                console.log("Can't open found FC " + this.activeDevice.serial.value + ", resetting link");
                                winston.info("Can't open found FC " + this.activeDevice.serial.value + ", resetting link");
                                this.activeDevice = null;
                            }
                        });
                        break;
                    }
                }
                if (this.port === null) {
                    console.log("Can't find saved FC, resetting");
                    winston.info("Can't find saved FC, resetting");
                    this.activeDevice = null;
                }
            });

        }
    }

    getUDPOutputs() {
        //get list of current UDP outputs
        var ret = [];
        for (var i = 0, len = this.outputs.length; i < len; i++) {
            ret.push({IPPort: this.outputs[i].IP + ":" + this.outputs[i].port});
        }
        return ret;
    }

    addUDPOutput(newIP, newPort) {
        //add a new udp output, if not already in
        //check if this ip:port is already in the list
        for (var i = 0, len = this.outputs.length; i < len; i++) {
            if (this.outputs[i].IP == newIP && this.outputs[i].port == newPort) {
                return this.getUDPOutputs();
            }
        }
        //add it in
        this.outputs.push({IP: newIP, port: newPort});
        console.log("Added UDP Output " + newIP + ":" + newPort);
        winston.info("Added UDP Output " + newIP + ":" + newPort);

        //restart udp outputs, if link active
        if (this.m) {
            this.m.restartUDP(this.outputs);
        }

        this.saveSerialSettings();
        return this.getUDPOutputs();
    }

    removeUDPOutput(remIP, remPort) {
        //remove new udp output
        //check if this ip:port is already in the list
        for (var i = 0, len = this.outputs.length; i < len; i++) {
            if (this.outputs[i].IP == remIP && this.outputs[i].port == remPort) {
                //and remove
                this.outputs.splice(i, 1);
                console.log("Removed UDP Output " + remIP + ":" + remPort);
                winston.info("Removed UDP Output " + remIP + ":" + remPort);

                //restart udp outputs, if link active
                if (this.m) {
                    this.m.restartUDP(this.outputs);
                }

                this.saveSerialSettings();
                return this.getUDPOutputs();
            }
        }

        return this.getUDPOutputs();
    }

    getSystemStatus() {
        //get the system status
        if (this.m !== null) {
            return {numpackets: this.m.statusNumRxPackets,
                    FW: this.m.autopilotFromID(),
                    vehType: this.m.vehicleFromID(),
                    conStatus: this.m.conStatusStr(),
                    statusText: this.m.statusText};
        }
        else {
            return {numpackets: 0,
                    FW: "",
                    vehType: "",
                    conStatus: "Not connected",
                    statusText: ""};
        }
    }

    rebootFC() {
        //command the flight controller to reboot
        if (this.m !== null) {
            console.log("Rebooting FC");
            winston.info("Rebooting FC");
            this.m.sendReboot();
        }
    }

    startLink(callback) {
        //start the serial link
        console.log("Opening Link " + this.activeDevice.serial.value + " @ " + this.activeDevice.baud.value + ", MAV v" + this.activeDevice.mavversion.value);
        winston.info("Opening Link " + this.activeDevice.serial.value + " @ " + this.activeDevice.baud.value + ", MAV v" + this.activeDevice.mavversion.value);
        this.port = new SerialPort(this.activeDevice.serial.value, {baudRate: parseInt(this.activeDevice.baud.value)}, (err) => {
            if (err) {
                this.closeLink((err) => {
                    winston.error('Error in startLink() port ', { message: err });
                });
                console.log('Serial Error: ', err.message);
                winston.error('Serial Error: ', { message: err })
                return callback(err.message, false)
            }

            //only restart the mavlink processor if it's a new link,
            //not a reconnect attempt
            if (this.m === null) {
                this.m = new mavManager(this.activeDevice.mavversion.value, this.outputs);
            }

            this.eventEmitter.emit('newLink');

            this.m.eventEmitter.on('sendData', (buffer) => {
                if (this.port) {
                    this.port.write(buffer, function(err) {
                      if (err) {
                          winston.error('Error in startLink() serial ', { message: err });
                          console.log('FC Serial Error on write: ', err.message);
                          return callback(null, false)
                      }
                    });
                }
            });
            this.m.eventEmitter.on('gotMessage', (msg) => {
                //got valid message - send on to attached classes
                this.previousConnection = true;
                this.eventEmitter.emit('gotMessage', msg);
            });

            return callback(null, true);
        });
        // Switches the port into "flowing mode"
        this.port.on('data', (data) => {
            if (this.m !== null) {
                this.m.parseBuffer(data);
            }
        });
    }

    closeLink(callback) {
        //stop the serial link
        if (this.port && this.port.isOpen) {
            this.port.close();
            console.log("Closed Serial");
            winston.info("Closed Serial");
            this.eventEmitter.emit('stopLink');
            return callback(null)
        }
        else if (this.port) {
            console.log("Already Closed Serial");
            winston.info("Already Closed Serial");
            this.eventEmitter.emit('stopLink');
            return callback(null)
        }
    }

    getSerialDevicesSync(){
        //synchonous version of getSerialDevices()
        var ret;
        this.getSerialDevices((err, devices, bauds, seldevice, selbaud, active) => {
            ret = devices;
        });
        while(ret === undefined) {
            require('deasync').sleep(100);
        }
        //return ret;
    }

    getSerialDevices(callback) {
        //get all serial devices
        this.serialDevices = [];

        SerialPort.list().then(
          ports => {for (var i = 0, len = ports.length; i < len; i++) {
                        if (ports[i].pnpId !== undefined) {

                            //usb-ArduPilot_Pixhawk1-1M_32002A000847323433353231-if00
                            //console.log("Port: ", ports[i].pnpID);
                            if (ports[i].pnpId.split("_").length > 2) {
                                var name = ports[i].pnpId.split("_")[1] + " (" + ports[i].path + ")";
                            }
                            else {
                                var name = ports[i].manufacturer + " (" + ports[i].path + ")";
                            }
                            //console.log("Port: ", ports[i].pnpID);
                            this.serialDevices.push({value: ports[i].path, label: name, pnpId: ports[i].pnpId});
                        }
                    }
                   //for the Ras Pi's inbuilt UART
                    if (fs.existsSync('/dev/serial0')) {
                        this.serialDevices.push({value: '/dev/serial0', label: '/dev/serial0', pnpId: ''});
                    }

                    //has the active device been disconnected?
                    if (this.port && !this.port.isOpen) {
                        console.log("Lost active device");
                        winston.info("Lost active device");
                        //this.active = false;
                        this.m = null;
                    }
                    //set the active device as selected
                    if (this.activeDevice) {
                        return callback(null, this.serialDevices, this.baudRates, this.activeDevice.serial, this.activeDevice.baud, this.mavlinkVersions, this.activeDevice.mavversion, true);
                    }
                    else if (this.serialDevices.length > 0){
                        return callback(null, this.serialDevices, this.baudRates, this.serialDevices[0], this.baudRates[0], this.mavlinkVersions, this.mavlinkVersions[0], false);
                    }
                    else {
                        return callback(null, this.serialDevices, this.baudRates, [], this.baudRates[0], this.mavlinkVersions, this.mavlinkVersions[0], false);
                    }
                },
          err => console.error(err)
        );
    }

    startStopTelemetry(device, baud, mavversion, callback) {
        //user wants to start or stop telemetry
        //callback is (err, isSuccessful)

        //check port, mavversion and baud are valid (if starting telem)
        if(!this.activeDevice) {
            this.activeDevice = {serial: null, baud: null};
            for (var i = 0, len = this.serialDevices.length; i < len; i++) {
                if (this.serialDevices[i].pnpId === device.pnpId) {
                    this.activeDevice.serial = this.serialDevices[i];
                    break;
                }
            }
            for (i = 0, len = this.baudRates.length; i < len; i++) {
                if (this.baudRates[i].value === baud.value) {
                    this.activeDevice.baud = this.baudRates[i];
                    break;
                }
            }
            for (i = 0, len = this.mavlinkVersions.length; i < len; i++) {
                if (this.mavlinkVersions[i].value === mavversion.value) {
                    this.activeDevice.mavversion = this.mavlinkVersions[i];
                    break;
                }
            }

            if (this.activeDevice.baud === null || this.activeDevice.serial === null || this.activeDevice.mavversion === null) {
                return callback("Bad serial device or baud or mavlink version", this.activeDevice !== null);
            }

            //this.activeDevice = {serial: device, baud: baud};
            this.startLink((err) => {
                this.saveSerialSettings();
                // start timeout function for auto-reconnect
                this.intervalObj = setInterval(() => {
                    if (this.m && this.m.statusNumRxPackets == 0) {
                        //waiting for initial connection
                        console.log('Initial DS Request');
                        winston.info('Initial DS Request');
                        this.m.sendDSRequest();
                    }
                    //check for timeouts in serial link (ie disconnected cable or reboot)
                    //console.log('Status: ' + this.m.conStatusInt());
                    if (this.m && this.m.conStatusInt() === -1) {
                        console.log('Trying to reconnect FC...');
                        winston.info('Trying to reconnect FC...');
                        this.closeLink((err) => {
                            this.startLink((err) => {
                                if (err) {
                                }
                                else {
                                    //resend DS request to init link
                                    console.log('Continue DS Request');
                                    winston.info('Continue DS Request');
                                    this.m.sendDSRequest();
                                }
                            });
                        });
                    }
                }, 1000);
                return callback(null, this.activeDevice !== null);
            });
        }
        else {
            this.activeDevice = null;
            this.closeLink((err) => {
                this.saveSerialSettings();
                clearInterval(this.intervalObj);
                this.previousConnection = false;
                this.m = null
                return callback(null, this.activeDevice !== null);
            });
        }

    }

    saveSerialSettings() {
        //Save the current settings to file
        this.settings.setValue("flightcontroller.activeDevice", this.activeDevice);
        this.settings.setValue("flightcontroller.outputs", this.outputs);
        console.log("Saved FC settings");
        winston.info("Saved FC settings");
    }

}

module.exports = FCDetails;
