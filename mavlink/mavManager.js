// Mavlink Manager
var events = require('events')
var udp = require('dgram')
var winston = require('../server/winstonconfig')(module)

class mavManager {
  constructor (dialect, version, outputs) {
    this.mav = null
    this.mavmsg = null
    this.buf = 0
    this.version = version
    this.dialect = dialect

    // load the correct MAVLink definitions
    if (version === 1 && dialect === "common") {
      var { mavlink10, MAVLink10Processor } = require('./mavlink_common_v1')
      this.mav = new MAVLink10Processor(null, 255, 0)
      this.mavmsg = mavlink10
    } else if (version === 2 && dialect === "common") {
      var { mavlink20, MAVLink20Processor } = require('./mavlink_common_v2')
      this.mav = new MAVLink20Processor(null, 255, 0)
      this.mavmsg = mavlink20
    } else if (version === 1 && dialect === "ardupilot") {
      var { mavlink10, MAVLink10Processor } = require('./mavlink_ardupilot_v1')
      this.mav = new MAVLink10Processor(null, 255, 0)
      this.mavmsg = mavlink10
    } else if (version === 2 && dialect === "ardupilot") {
      var { mavlink20, MAVLink20Processor } = require('./mavlink_ardupilot_v2')
      this.mav = new MAVLink20Processor(null, 255, 0)
      this.mavmsg = mavlink20
    } else {
      console.log('Error - no valid MAVLink version or dialect')
      winston.error('Error - no valid MAVLink version or dialect: ', { message: version })
    }

    this.eventEmitter = new events.EventEmitter()

    // are we in a system reboot?
    this.isRebooting = false

    // System status
    this.statusNumRxPackets = 0
    this.statusFWName = ''
    this.statusVehType = ''
    this.timeofLastPacket = 0
    this.statusText = ''

    // the vehicle
    this.targetSystem = null
    this.targetComponent = null

    // outputs
    this.outputs = []
    this.udpStream = udp.createSocket('udp4')
    this.UDPMav = []

    // event for recieving udp messages from clients (ie commands)
    this.udpStream.on('message', (msg, info) => {
      if (this.outputs.length > 0) {
        // check it's from a valid client
        for (var i = 0, len = this.outputs.length; i < len; i++) {
          if (this.UDPMav.length === this.outputs.length && info.address === this.outputs[i].IP && parseInt(info.port) === this.outputs[i].port) {
            // decode and send to FC
            this.UDPMav[i].parseBuffer(msg)
          }
        }
      }
    })

    this.restartUDP(outputs)

    this.mav.on('error', function (e) {
      // console.log(e);
    })

    // what to do when we get a message
    this.mav.on('message', (msg) => {
      // raise event for external objects
      this.eventEmitter.emit('gotMessage', msg)

      // send on to UDP clients - very easy. No mavlink processor required
      if (this.outputs.length > 0) {
        for (var i = 0, len = this.outputs.length; i < len; i++) {
          this.udpStream.send(msg.msgbuf, this.outputs[i].port, this.outputs[i].IP, function (error) {
            if (error) {
              console.log('UDP Error: ' + error)
              winston.error('UDP Error: ', { message: error })
            } else {
              // console.log('Data sent !!!');
            }
          })
        }
      }
      if (msg.id === -1) {
        // bad message - can't process here any further
        return
      }
      this.statusNumRxPackets += 1
      this.timeofLastPacket = (Date.now().valueOf())
      if (msg.name === 'HEARTBEAT') {
        // System status
        this.statusFWName = msg.autopilot
        this.statusVehType = msg.type

        // set the target system/comp ID if needed
        if (this.targetSystem === null) {
          console.log('Vehicle is S/C: ' + msg.header.srcSystem + '/' + msg.header.srcComponent)
          winston.info('Vehicle is S/C: ' + msg.header.srcSystem + '/' + msg.header.srcComponent)
          this.targetSystem = msg.header.srcSystem
          this.targetComponent = msg.header.srcComponent
        }
      } else if (msg.name === 'STATUSTEXT') {
        // Remove whitespace
        this.statusText += msg.text.trim().replace(/[^ -~]+/g, '') + '\n'
      } else if (msg.name === 'POWER_STATUS') {
        // console.log(msg);
        // this.statusText += msg.text;
      }
    })
  }

  parseBuffer (data) {
    // incoming data
    this.mav.parseBuffer(data)
  }

  sendReboot () {
    // create a reboot packet
    var msg = new this.mavmsg.messages.command_long(this.targetSystem, this.targetComponent, this.mavmsg.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 0,
      1, 0, 0, 0, 0, 0, 0)
    this.isRebooting = true
    this.eventEmitter.emit('sendData', msg.pack(this.mav))
  }

  sendDSRequest () {
    // create a datastream request packet
    // console.log("Sent DS");
    var msg = new this.mavmsg.messages.request_data_stream(this.targetSystem, this.targetComponent, this.mavmsg.MAV_DATA_STREAM_ALL, 1, 1)
    this.eventEmitter.emit('sendData', msg.pack(this.mav))
  }

  restartUDP (udpendpoints) {
    // restart all UDP endpoints
    this.outputs = []
    this.UDPMav = []

    // each udp output has a mavlink processor
    // this ensures non-fragmented mavlink packets from the clients
    for (var i = 0, len = udpendpoints.length; i < len; i++) {
      console.log('Restarting UDP output to ' + udpendpoints[i].IP + ':' + udpendpoints[i].port)
      winston.info('Restarting UDP output to ' + udpendpoints[i].IP + ':' + udpendpoints[i].port)

      // load the correct MAVLink definitions
      if (this.version === 1 && this.dialect === "common") {
        var { mavlink10, MAVLink10Processor } = require('./mavlink_common_v1')
        var newmav = new MAVLink10Processor(null, 255, 0)
      } else if (this.version === 2 && this.dialect === "common") {
        var { mavlink20, MAVLink20Processor } = require('./mavlink_common_v2')
        var newmav = new MAVLink20Processor(null, 255, 0)
      } else if (this.version === 1 && this.dialect === "ardupilot") {
        var { mavlink10, MAVLink10Processor } = require('./mavlink_ardupilot_v1')
        var newmav = new MAVLink10Processor(null, 255, 0)
      } else if (this.version === 2 && this.dialect === "ardupilot") {
        var { mavlink20, MAVLink20Processor } = require('./mavlink_ardupilot_v2')
        var newmav = new MAVLink20Processor(null, 255, 0)
      } else {
        console.log('Error - no valid MAVLink version or dialect')
        winston.error('Error - no valid MAVLink version or dialect: ', { message: version })
      }

      newmav.on('message', (msg) => {
        this.eventEmitter.emit('sendData', msg.msgbuf)
      })
      this.UDPMav.push(newmav)
    }

    this.outputs = udpendpoints
  }

  autopilotFromID () {
    switch (this.statusFWName) {
      case 0:
        return 'Generic'
      case 3:
        return 'APM'
      case 4:
        return 'OpenPilot'
      case 12:
        return 'PX4'
      default:
        return 'Unknown'
    }
  }

  vehicleFromID () {
    switch (this.statusVehType) {
      case 0:
        return 'Generic'
      case 1:
        return 'Fixed Wing'
      case 2:
        return 'Quadcopter'
      case 4:
        return 'Helicopter'
      case 5:
        return 'Antenna Tracker'
      case 6:
        return 'GCS'
      case 10:
        return 'Ground Rover'
      case 11:
        return 'Boat'
      case 12:
        return 'Submarine'
      case 13:
        return 'Hexacopter'
      case 14:
        return 'Octocopter'
      case 15:
        return 'Tricopter'
      default:
        return 'Unknown'
    }
  }

  conStatusStr () {
    // connection status - connected, not connected, no packets for x sec
    if ((Date.now().valueOf()) - this.timeofLastPacket < 2000) {
      return 'Connected'
    } else if (this.timeofLastPacket > 0) {
      return 'Connection lost for ' + (Date.now().valueOf() - this.timeofLastPacket) / 1000 + ' seconds'
    } else {
      return 'Not connected'
    }
  }

  conStatusInt () {
    // connection status - connected (1), not connected (0), no packets for x sec (-1)
    if ((Date.now().valueOf()) - this.timeofLastPacket < 2000) {
      return 1
    } else if (this.timeofLastPacket > 0) {
      return -1
    } else {
      return 0
    }
  }
}

module.exports = mavManager
