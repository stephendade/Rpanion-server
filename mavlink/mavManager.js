// Mavlink Manager
const events = require('events')
const udp = require('dgram')
const winston = require('../server/winstonconfig')(module)

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
    this.fcVersion = ''
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
      if (msg._id === -1) {
        // bad message - can't process here any further
        return
      }

      // set the target system/comp ID if needed
      // ensure it's NOT a GCS, as mavlink-router will sometimes route
      // messages from connected GCS's
      if (this.targetSystem === null && msg._name === 'HEARTBEAT' && msg.type !== 6) {
        console.log('Vehicle is S/C: ' + msg._header.srcSystem + '/' + msg._header.srcComponent)
        winston.info('Vehicle is S/C: ' + msg._header.srcSystem + '/' + msg._header.srcComponent)
        this.targetSystem = msg._header.srcSystem
        this.targetComponent = msg._header.srcComponent

        // send off initial messages
        this.sendVersionRequest()
      } else if (this.targetSystem !== msg._header.srcSystem) {
        // don't use packets from other systems or components in Rpanion-server
        return
      }

      // raise event for external objects
      this.eventEmitter.emit('gotMessage', msg)

      this.statusNumRxPackets += 1
      this.timeofLastPacket = (Date.now().valueOf())
      if (msg._name === 'HEARTBEAT') {
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
      } else if (msg._name === 'STATUSTEXT') {
        // Remove whitespace
        this.statusText += msg.text.trim().replace(/[^ -~]+/g, '') + '\n'
      } else if (msg._name === 'AUTOPILOT_VERSION') {
        // decode Ardupilot version
        this.fcVersion = this.decodeFlightSwVersion(msg.flight_sw_version)
        console.log(this.fcVersion)
        winston.info(this.fcVersion)
      }
    })
  }

  decodeFlightSwVersion (flightSwVersion) {
    // decode 32 bit flight_sw_version mavlink parameter - corresponds to encoding in ardupilot GCS_MAVLINK::send_autopilot_version
    const fwTypeId = (flightSwVersion >> 0) % 256
    const patch = (flightSwVersion >> 8) % 256
    const minor = (flightSwVersion >> 16) % 256
    const major = (flightSwVersion >> 24) % 256
    let fwStr = ''

    switch (fwTypeId) {
      case 0:
        fwStr = 'dev'
        break
      case 64:
        fwStr = 'alpha'
        break
      case 128:
        fwStr = 'beta'
        break
      case 192:
        fwStr = 'rc'
        break
      case 255:
        fwStr = 'official'
        break
      default:
        fwStr = 'Unknown'
        break
    }
    return `${major}.${minor}.${patch}-${fwStr}`
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
    this.targetSystem = null
    this.targetComponent = null

    this.udpStream = udp.createSocket('udp4')
    this.statusBytesPerSec = { avgBytesSec: 0, bytes: 0, lastTime: Date.now().valueOf() }

    this.udpStream.on('message', (msg, rinfo) => {
      // lock onto server port
      if (this.RinudpPort === null || this.RinudpIP === null) {
        this.RinudpPort = rinfo.port
        this.RinudpIP = rinfo.address
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

    const buf = Buffer.from(msgbuf)
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
    const msg = new this.mavmsg.messages.command_long(this.targetSystem, this.targetComponent, this.mavmsg.MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN, 0,
      1, 0, 0, 0, 0, 0, 0)
    this.isRebooting = true
    // this.eventEmitter.emit('sendData', msg.pack(this.mav))
    this.sendData(msg.pack(this.mav))
  }

  sendVersionRequest () {
    // request ArduPilot version
    const msg = new this.mavmsg.messages.command_long(this.targetSystem, this.targetComponent, this.mavmsg.MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES, 1,
      1, 0, 0, 0, 0, 0, 0)
    this.sendData(msg.pack(this.mav))
  }

  sendDSRequest () {
    // create a datastream request packet
    // console.log("Sent DS");
    const msg = new this.mavmsg.messages.request_data_stream(this.targetSystem, this.targetComponent, this.mavmsg.MAV_DATA_STREAM_ALL, 1, 1)
    this.sendData(msg.pack(this.mav))
  }

  sendRTCMMessage (gpmessage, seq) {
    // create a rtcm message for the flight controller
    let flags = 0
    if (gpmessage.length > 180) {
      flags = 1
    }
    // add in the sequence number
    flags |= (seq & 0x1F) << 3

    if (gpmessage.length > 4 * 180) {
      // can't send this with GPS_RTCM_DATA
      return
    }
    // send data in 180 byte parts
    let buf = Buffer.from(gpmessage)
    const msgset = []
    const maxBytes = 180
    while (true) {
      if (buf.length > maxBytes) {
        // slice
        msgset.push(buf.slice(0, maxBytes))
        buf = buf.slice(maxBytes)
      } else {
        // need to pad to 180 chars? No, message packing
        // will do this for us
        msgset.push(buf)
        break
      }
    }

    for (let i = 0, len = msgset.length; i < len; i++) {
      const msg = new this.mavmsg.messages.gps_rtcm_data(flags | (i << 1), msgset[i].length, msgset[i])
      this.sendData(msg.pack(this.mav))
    }
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
    if ((Date.now().valueOf()) - this.timeofLastPacket < 5000) {
      return 'Connected'
    } else if (this.timeofLastPacket > 0) {
      return 'Connection lost for ' + (Date.now().valueOf() - this.timeofLastPacket) / 1000 + ' seconds'
    } else {
      return 'Not connected'
    }
  }

  conStatusInt () {
    // connection status - connected (1), not connected (0), no packets for x sec (-1)
    if ((Date.now().valueOf()) - this.timeofLastPacket < 5000) {
      return 1
    } else if (this.timeofLastPacket > 0) {
      return -1
    } else {
      return 0
    }
  }
}

module.exports = mavManager
