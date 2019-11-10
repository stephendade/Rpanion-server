var events = require('events');
//Mavlink Manager

class mavManager {
    constructor(version) {
        this.mav = null
        if (version == 1) {
            var mavlink = require('./mavlink_common_v1');
            this.mav = new MAVLink(null, 255, 0);
        }
        else if (version == 2){
            var mavlink = require('./mavlink_common_v2');
            this.mav = new MAVLink(null, 255, 0);
        }
        else {
            console.log("Error - no valid MAVLink version");
        }

        this.eventEmitter = new events.EventEmitter();

        //System status
        this.statusNumRxPackets = 0;
        this.statusFWName = "";
        this.statusVehType = "";
        this.timeofLastPacket = 0;
        this.statusText = "";

        //the vehicle
        this.targetSystem = null;
        this.targetComponent = null;

        //what to do when we get a message
        this.mav.on('message', (msg) => {
            this.statusNumRxPackets += 1;
            this.timeofLastPacket = (Date.now().valueOf());
            if (msg.name === "HEARTBEAT") {
                //System status
                this.statusFWName = msg.autopilot;
                this.statusVehType = msg.type;

                //set the target system/comp ID if needed
                if (this.targetSystem !== null) {
                    this.targetSystem = srcSystem;
                    this.targetComponent = srcComponent;
                }
            }
            else if (msg.type === "STATUSTEXT") {
                console.log(msg.text);
                this.statusText += msg.text;
            }
            //console.log(msg.name);
        });
    }

    parseBuffer(data) {
        //incoming data
        this.mav.parseBuffer(data);
    }

    sendReboot() {
        //create a reboot packet
        var msg = new mavlink.messages.command_long(1,0,mavlink.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 0,
                                       1, 0, 0, 0, 0, 0, 0);
        var buf = new Buffer(msg.pack(this.mav));
        this.eventEmitter.emit('sendData', buf);
    }

    sendDSRequest() {
        //create a reboot packet
        var msg = new mavlink.messages.request_data_stream(1, 1, mavlink.MAV_DATA_STREAM_ALL, 1, 1);
        var buf = new Buffer(msg.pack(this.mav));
        this.eventEmitter.emit('sendData', buf);
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
