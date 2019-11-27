//Mavlink Manager
var events = require('events');
var udp = require('dgram');

class mavManager {
    constructor(version, outputs) {
        this.mav = null;
        this.buf = 0;
        if (version == 1) {
            //{mavlink, MAVLinkProcessor}
            var {mavlink, MAVLinkProcessor} = require('./mavlink_common_v1');
            this.mav = new MAVLinkProcessor(null, 255, 0);
        }
        else if (version == 2){
            var {mavlink, MAVLinkProcessor} = require('./mavlink_common_v2');
            this.mav = new MAVLinkProcessor(null, 255, 0);
        }
        else {
            console.log("Error - no valid MAVLink version");
        }

        this.eventEmitter = new events.EventEmitter();

        //are we in a system reboot?
        this.isRebooting = false;

        //System status
        this.statusNumRxPackets = 0;
        this.statusFWName = "";
        this.statusVehType = "";
        this.timeofLastPacket = 0;
        this.statusText = "";

        //the vehicle
        this.targetSystem = null;
        this.targetComponent = null;

        //outputs
        this.outputs = outputs;
        this.udpStream = udp.createSocket('udp4');
        this.UDPMav = [];

        //each udp output has a mavlink processor
        //this ensures non-fragmented mavlink packets from the clients
        for (var i = 0, len = this.outputs.length; i < len; i++) {
            console.log("New UDP output to " + this.outputs[i].IP + ":" + this.outputs[i].port);
            var newmav = new MAVLinkProcessor(null, 255, 0);
            newmav.on('message', (msg) => {
                this.eventEmitter.emit('sendData', msg.msgbuf);
            });
            this.UDPMav.push(newmav);
        }

        //event for recieving udp messages from clients (ie commands)
        this.udpStream.on('message', (msg, info) => {
            //check it's from a valid client
            for (var i = 0, len = this.outputs.length; i < len; i++) {
                if (this.UDPMav.length == this.outputs.length && info.address === this.outputs[i].IP && parseInt(info.port) === this.outputs[i].port) {
                    //decode and send to FC
                    this.UDPMav[i].parseBuffer(msg);
                }
            }
        });

        this.mav.on('error', function (e) {
            //console.log(e);
        });

        //what to do when we get a message
        this.mav.on('message', (msg) => {
            if (this.statusNumRxPackets == 0) {
                this.sendDSRequest();
            }
            this.statusNumRxPackets += 1;
            this.timeofLastPacket = (Date.now().valueOf());
            if (msg.name === "HEARTBEAT") {
                //System status
                this.statusFWName = msg.autopilot;
                this.statusVehType = msg.type;

                //set the target system/comp ID if needed
                if (this.targetSystem === null) {
                    console.log("Vehicle is S/C: " + msg.header.srcSystem + "/" + msg.header.srcComponent);
                    this.targetSystem = msg.header.srcSystem;
                    this.targetComponent = msg.header.srcComponent;
                }
            }
            else if (msg.name == "STATUSTEXT") {
                //Remove whitespace
                this.statusText += msg.text.trim().replace(/[^ -~]+/g, "") + "\n";
            }
            else if (msg.name == "POWER_STATUS") {
                //console.log(msg);
                //this.statusText += msg.text;
            }
            //and send on to UDP clients - very easy. No mavlink processor required
            for (var i = 0, len = this.outputs.length; i < len; i++) {
                this.udpStream.send(msg.msgbuf,this.outputs[i].port,this.outputs[i].IP,function(error){
                    if(error) {
                        //console.log('UDP Error');
                    }
                    else {
                        //console.log('Data sent !!!');
                    }
                });
            }
        });
    }

    parseBuffer(data) {
        //incoming data
        this.mav.parseBuffer(data);
    }

    sendReboot() {
        //create a reboot packet
        var msg = new mavlink.messages.command_long(this.targetSystem,this.targetComponent,mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 0,
                                       1, 0, 0, 0, 0, 0, 0);
        this.isRebooting = true;
        this.eventEmitter.emit('sendData', msg.pack(this.mav));
    }

    sendDSRequest() {
        //create a datastream request packet
        console.log("Sent DS");
        var msg = new mavlink.messages.request_data_stream(this.targetSystem,this.targetComponent, mavlink.MAV_DATA_STREAM_ALL, 1, 1);
        this.eventEmitter.emit('sendData', msg.pack(this.mav));
    }

    restartUDP(udpendpoints) {
        //restart all UDP endpoints
        this.outputs = udpendpoints;

        this.UDPMav = [];

        //each udp output has a mavlink processor
        //this ensures non-fragmented mavlink packets from the clients
        for (var i = 0, len = this.outputs.length; i < len; i++) {
            console.log("Restarting UDP output to " + this.outputs[i].IP + ":" + this.outputs[i].port);
            var newmav = new MAVLinkProcessor(null, 255, 0);
            newmav.on('message', (msg) => {
                this.eventEmitter.emit('sendData', msg.msgbuf);
            });
            this.UDPMav.push(newmav);
        }
    }

    autopilotFromID() {
        switch(this.statusFWName) {
          case 0:
            return "Generic";
            break;
          case 3:
            return "APM";
            break;
          case 4:
            return "OpenPilot";
            break;
          case 12:
            return "PX4";
            break;
          default:
            console.log("Got FWID " + this.statusFWName);
            return "Unknown";
        }
    }

    vehicleFromID() {
        switch(this.statusVehType) {
          case 0:
            return "Generic";
            break;
          case 1:
            return "Fixed Wing";
            break;
          case 2:
            return "Quadcopter";
            break;
          case 4:
            return "Helicopter";
            break;
          case 5:
            return "Antenna Tracker";
            break;
          case 6:
            return "GCS";
            break;
          case 10:
            return "Ground Rover";
            break;
          case 11:
            return "Boat";
            break;
          case 12:
            return "Submarine";
            break;
          case 13:
            return "Hexacopter";
            break;
          case 14:
            return "Octocopter";
            break;
          case 15:
            return "Tricopter";
            break;
          default:
            console.log("Got VEHID " + this.statusVehType);
            return "Unknown";
        }
    }

    conStatus() {
        //connection station - connected, not connected, no packets for x sec
        if ((Date.now().valueOf()) - this.timeofLastPacket < 2000) {
            return "Connected";
        }
        else if (this.timeofLastPacket > 0) {
            return "Connection lost for " + (Date.now().valueOf() - this.timeofLastPacket)/1000 + " seconds";
        }
        else {
            return "Not connected";
        }
    }

    modeFromID(ID) {

    }

}


module.exports = mavManager;
