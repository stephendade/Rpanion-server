// Mavlink Manager
var events = require('events')
var udp = require('dgram')
var winston = require('../server/winstonconfig')(module)

class mavManager {
  constructor (dialect, version, inudpIP, inudpPort) {
    this.mav = null
    this.mavmsg = null
    this.version = version
    this.dialect = dialect

    // load the correct MAVLink definitions
    if (version === 1 && dialect === 'common') {
      var { mavlink10, MAVLink10Processor } = require('./mavlink_common_v1')
      this.mav = new MAVLink10Processor(null, 255, 0)
      this.mavmsg = mavlink10
    } else if (version === 2 && dialect === 'common') {
      var { mavlink20, MAVLink20Processor } = require('./mavlink_common_v2')
      this.mav = new MAVLink20Processor(null, 255, 0)
      this.mavmsg = mavlink20
    } else if (version === 1 && dialect === 'ardupilot') {
      var { mavlink10, MAVLink10Processor } = require('./mavlink_ardupilot_v1')
      this.mav = new MAVLink10Processor(null, 255, 0)
      this.mavmsg = mavlink10
    } else if (version === 2 && dialect === 'ardupilot') {
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
    this.statusBytesPerSec = { avgBytesSec: 0, bytes: 0, lastTime: Date.now().valueOf() }
    this.statusFWName = ''
    this.statusVehType = ''
    this.timeofLastPacket = 0
    this.statusText = ''
    this.statusArmed = 0

    // the vehicle
    this.targetSystem = null
    this.targetComponent = null

    // udp input
    this.udpStream = udp.createSocket('udp4')
    this.inudpPort = inudpPort
    this.inudpIP = inudpIP
    this.RinudpPort = null
    this.RinudpIP = null

    this.udpStream.on('message', (msg, rinfo) => {
      // calculate bytes/sec rate (once per 2 sec)
      if ((this.statusBytesPerSec.lastTime + 2000) < Date.now().valueOf()) {
        this.statusBytesPerSec.avgBytesSec = Math.round(1000 * this.statusBytesPerSec.bytes / (Date.now().valueOf() - this.statusBytesPerSec.lastTime))
        this.statusBytesPerSec.bytes = 0
        this.statusBytesPerSec.lastTime = Date.now().valueOf()
      } else {
        this.statusBytesPerSec.bytes += msg.length
      }
      this.mav.parseBuffer(msg)
      // lock onto server port
      if (this.RinudpPort === null || this.RinudpIP === null) {
        this.RinudpPort = rinfo.port
        this.RinudpIP = rinfo.address
        this.eventEmitter.emit('linkready', true)
      }
    })

    this.udpStream.bind(inudpPort, inudpIP)

    this.mav.on('error', function (e) {
      // console.log(e);
    })

    // what to do when we get a message
    this.mav.on('message', (msg) => {
      // raise event for external objects
      this.eventEmitter.emit('gotMessage', msg)

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

        // arming status
        if ((msg.base_mode & this.mavmsg.MAV_MODE_FLAG_SAFETY_ARMED) !== 0 && this.statusArmed === 0) {
          console.log('Vehicle ARMED')
          winston.info('Vehicle ARMED')
          this.statusArmed = 1
          this.eventEmitter.emit('armed')
        } else if ((msg.base_mode & this.mavmsg.MAV_MODE_FLAG_SAFETY_ARMED) === 0 && this.statusArmed === 1) {
          console.log('Vehicle DISARMED')
          winston.info('Vehicle DISARMED')
          this.statusArmed = 0
          this.eventEmitter.emit('disarmed')
        }

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
      }
    })
  }

  close () {
    // close cleanly
    if (this.udpStream) {
      this.udpStream.close()
    }
  }

  restart () {
    // reset remote UDP stream
    this.close()
    this.RinudpPort = null
    this.RinudpIP = null
    this.udpStream = udp.createSocket('udp4')
    this.statusBytesPerSec = { avgBytesSec: 0, bytes: 0, lastTime: Date.now().valueOf() }

    this.udpStream.on('message', (msg, rinfo) => {
      // lock onto server port
      if (this.RinudpPort === null || this.RinudpIP === null) {
        this.RinudpPort = rinfo.port
        this.RinudpIP = rinfo.address
        this.sendDSRequest()
      } else {
        // calculate bytes/sec rate (once per 2 sec)
        if ((this.statusBytesPerSec.lastTime + 2000) < Date.now().valueOf()) {
          this.statusBytesPerSec.avgBytesSec = Math.round(1000 * this.statusBytesPerSec.bytes / (Date.now().valueOf() - this.statusBytesPerSec.lastTime))
          this.statusBytesPerSec.bytes = 0
          this.statusBytesPerSec.lastTime = Date.now().valueOf()
        } else {
          this.statusBytesPerSec.bytes += msg.length
        }
        this.mav.parseBuffer(msg)
      }
    })

    this.udpStream.bind(this.inudpPort, this.inudpIP)
  }

  sendData (msgbuf) {
    // msgbuf outgoing data
    if (this.RinudpPort === null || this.RinudpIP === null) {
      return
    }

    var buf = Buffer.from(msgbuf)
    this.udpStream.send(buf, this.RinudpPort, this.RinudpIP, function (error) {
      if (error) {
        this.udpStream.close()
        console.log(error)
      } else {
        // console.log(msgbuf)
        // console.log(buf)
      }
    })
  }

  sendReboot () {
    // create a reboot packet
    var msg = new this.mavmsg.messages.command_long(this.targetSystem, this.targetComponent, this.mavmsg.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 0,
      1, 0, 0, 0, 0, 0, 0)
    this.isRebooting = true
    // this.eventEmitter.emit('sendData', msg.pack(this.mav))
    this.sendData(msg.pack(this.mav))
  }

  sendDSRequest () {
    // create a datastream request packet
    // console.log("Sent DS");
    var msg = new this.mavmsg.messages.request_data_stream(this.targetSystem, this.targetComponent, this.mavmsg.MAV_DATA_STREAM_ALL, 1, 1)
    this.sendData(msg.pack(this.mav))
  }

  sendBinStreamRequest () {
    // create a bin log streaming request. Requires LOG_BACKEND = 3
    if (this.dialect !== 'ardupilot') {
      return
    }
    var msg = new this.mavmsg.messages.remote_log_block_status(this.targetSystem, this.mavmsg.MAV_COMP_ID_ALL, this.mavmsg.MAV_REMOTE_LOG_DATA_BLOCK_START, 1)
    this.sendData(msg.pack(this.mav))
  }

  sendBinStreamRequestStop () {
    // stop a bin log streaming request. Requires LOG_BACKEND = 3
    if (this.dialect !== 'ardupilot') {
      return
    }
    var msg = new this.mavmsg.messages.remote_log_block_status(this.targetSystem, this.mavmsg.MAV_COMP_ID_ALL, this.mavmsg.MAV_REMOTE_LOG_DATA_BLOCK_STOP, 1)
    this.sendData(msg.pack(this.mav))
  }

  sendBinStreamAck (seqno) {
    // send back acknowlegement of bin stream packet recieved
    if (this.dialect !== 'ardupilot') {
      return
    }
    var msg = new this.mavmsg.messages.remote_log_block_status(this.targetSystem, this.mavmsg.MAV_COMP_ID_ALL, seqno, 1)
    this.sendData(msg.pack(this.mav))
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
