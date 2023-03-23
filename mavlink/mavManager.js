// Mavlink Manager
const events = require('events')
const udp = require('dgram')
const winston = require('../server/winstonconfig')(module)
const { MavLinkPacketSplitter, MavLinkPacketParser, MavLinkProtocolV2, minimal, common, ardupilotmega, MavLinkProtocolV1 } = require('node-mavlink')
const { PassThrough } = require('stream')

// create a registry of mappings between a message id and a data class
const REGISTRY = {
  ...minimal.REGISTRY,
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY
}

class mavManager {
  constructor (version, inudpIP, inudpPort) {
    this.mav = null
    this.mavmsg = null
    this.version = version

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
    this.seq = 0

    // the vehicle
    this.targetSystem = null
    this.targetComponent = null

    // udp input
    this.udpStream = udp.createSocket('udp4')
    this.inudpPort = inudpPort
    this.inudpIP = inudpIP
    this.RinudpPort = null
    this.RinudpIP = null
    this.inStream = new PassThrough()

    this.udpStream.on('message', (msg, rinfo) => {
      // calculate bytes/sec rate (once per 2 sec)
      if ((this.statusBytesPerSec.lastTime + 2000) < Date.now().valueOf()) {
        this.statusBytesPerSec.avgBytesSec = Math.round(1000 * this.statusBytesPerSec.bytes / (Date.now().valueOf() - this.statusBytesPerSec.lastTime))
        this.statusBytesPerSec.bytes = 0
        this.statusBytesPerSec.lastTime = Date.now().valueOf()
      } else {
        this.statusBytesPerSec.bytes += msg.length
      }

      // lock onto server port
      if (this.RinudpPort === null || this.RinudpIP === null) {
        this.RinudpPort = rinfo.port
        this.RinudpIP = rinfo.address
        console.log(this.RinudpPort)
        this.eventEmitter.emit('linkready', true)
      }

      this.inStream.write(msg)
    })

    this.udpStream.bind(inudpPort, inudpIP)

    this.mav = this.inStream.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser())

    // what to do when we get a message
    this.mav.on('data', packet => {
      const clazz = REGISTRY[packet.header.msgid]
      if (!clazz) {
        // bad message - can't process here any further
        // console.log("Generic: ", packet)
        this.eventEmitter.emit('gotMessage', packet, null)
        return
      }
      const data = packet.protocol.data(packet.payload, clazz)
      // console.log(packet)

      // set the target system/comp ID if needed
      // ensure it's NOT a GCS, as mavlink-router will sometimes route
      // messages from connected GCS's
      if (this.targetSystem === null && packet.header.msgid === minimal.Heartbeat.MSG_ID && data.type !== 6) {
        console.log('Vehicle is S/C: ' + packet.header.sysid + '/' + packet.header.compid)
        winston.info('Vehicle is S/C: ' + packet.header.sysid + '/' + packet.header.compid)
        this.targetSystem = packet.header.sysid
        this.targetComponent = packet.header.compid

        // send off initial messages
        this.sendVersionRequest()
      } else if (this.targetSystem !== packet.header.sysid) {
        // don't use packets from other systems or components in Rpanion-server
        return
      }

      // raise event for external objects
      this.eventEmitter.emit('gotMessage', packet, data)

      this.statusNumRxPackets += 1
      this.timeofLastPacket = (Date.now().valueOf())
      if (packet.header.msgid === minimal.Heartbeat.MSG_ID) {
        // System status
        this.statusFWName = data.autopilot
        this.statusVehType = data.type

        // arming status
        if ((data.base_mode & 128) !== 0 && this.statusArmed === 0) {
          console.log('Vehicle ARMED')
          winston.info('Vehicle ARMED')
          this.statusArmed = 1
          this.eventEmitter.emit('armed')
        } else if ((data.base_mode & 128) === 0 && this.statusArmed === 1) {
          console.log('Vehicle DISARMED')
          winston.info('Vehicle DISARMED')
          this.statusArmed = 0
          this.eventEmitter.emit('disarmed')
        }
      } else if (packet.header.msgid === common.StatusText.MSG_ID) {
        // Remove whitespace
        this.statusText += data.text.trim().replace(/[^ -~]+/g, '') + '\n'
      } else if (packet.header.msgid === common.AutopilotVersion.MSG_ID) {
        // decode Ardupilot version
        this.fcVersion = this.decodeFlightSwVersion(data.flightSwVersion)
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
        this.inStream.write(msg)
      }
    })

    this.udpStream.bind(this.inudpPort, this.inudpIP)
  }

  sendData (msg) {
    // msgbuf outgoing data
    if (this.RinudpPort === null || this.RinudpIP === null) {
      return
    }

    let protocol = null
    if (this.version === 2) {
      protocol = new MavLinkProtocolV2(255, 1)
    } else {
      protocol = new MavLinkProtocolV1(255, 1)
    }

    const buffer = protocol.serialize(msg, this.seq++)
    this.seq &= 255

    this.udpStream.send(buffer, this.RinudpPort, this.RinudpIP, function (error) {
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
    const command = new common.PreflightRebootShutdownCommand(this.targetSystem, this.targetComponent)
    command.confirmation = 1
    command.autopilot = 1
    this.isRebooting = true
    this.sendData(command)
  }

  sendVersionRequest () {
    // request ArduPilot version
    const command = new common.RequestMessageCommand(this.targetSystem, this.targetComponent)
    command.messageId = common.AutopilotVersion.MSG_ID
    command.confirmation = 1
    this.sendData(command)
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
      const msg = new common.GpsRtcmData()
      msg.flags = flags | (i << 1)
      msg.len = msgset[i].length
      msg.data = msgset[i]
      this.sendData(msg)
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
