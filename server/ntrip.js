// NTRIP Manager
const { NtripClient } = require('ntrip-client')
const { geoToEcef } = require('ntrip-client/lib/nmea/ecef')
const events = require('events')
const os = require('os')
const { common } = require('node-mavlink')

class ntrip {
  constructor (settings, winston) {
    this.options = {
      host: '',
      port: 2101,
      mountpoint: '',
      username: '',
      password: '',
      // ECEF format!
      xyz: [0, 0, 0],
      // the interval of send nmea, unit is millisecond
      interval: 2000,
      active: false
    }

    this.winston = winston

    // status. 0=not active, 1=waiting for FC, 2=waiting for GPS lock, 3=waiting for NTRIP server, 4=getting packets
    // -1=ntrip error
    this.status = 0

    // time of last RTCM packet. Used for detecting loss of connection
    this.timeofLastPacket = 0

    // For sending events outside of object
    this.eventEmitter = new events.EventEmitter()

    // message sequence number
    this.seq = 0

    // load settings
    this.settings = settings
    this.options.host = this.settings.value('ntrip.host', '')
    this.options.port = this.settings.value('ntrip.port', 2101)
    this.options.mountpoint = this.settings.value('ntrip.mountpoint', '')
    this.options.username = this.settings.value('ntrip.username', '')
    this.options.password = this.settings.value('ntrip.password', '')
    this.options.active = this.settings.value('ntrip.active', false)

    this.client = null
    this.startStopNTRIP()
  }

  getSettings (callback) {
    // get current settings
    return callback(this.options.host,
      this.options.port,
      this.options.mountpoint,
      this.options.username,
      this.options.password,
      this.options.active)
  }

  startStopNTRIP () {
    if (this.options.active) {
      this.client = new NtripClient(this.options)
      this.client.headers.Host = os.hostname()
      this.seq = 0

      this.client.on('data', (data) => {
        if (this.options.active) {
          try {
            this.status = 4
            this.timeofLastPacket = (Date.now().valueOf())
            this.eventEmitter.emit('rtcmpacket', data, this.seq)
            this.seq = this.seq + 1
          } catch (e) {
          }
        }
      })

      this.client.on('close', () => {
        console.log('NTRIP client close')
      })

      this.client.on('error', (err) => {
        // halt on error
        if (this.options.active) {
          console.log('NTRIP error')
          console.log(err)
          this.winston.info(err)
          this.status = -1
        }
      })

      this.client.run()
      console.log('NTRIP started')
      this.winston.info('NTRIP started')
      this.status = 1
    } else {
      // stop the client
      if (this.client) {
        if (this.client.client) {
          this.client.client.removeAllListeners()
          this.client.client.destroy()
          this.client.client = null
        }
      }

      this.status = 0
      console.log('NTRIP stopped')
      this.winston.info('NTRIP stopped')
    }
  }

  setSettings (host, port, mount, username, password, active) {
    // save new settings
    this.options.host = host
    this.options.port = port
    this.options.mountpoint = mount
    this.options.username = username
    this.options.password = password
    this.options.active = active

    // and save
    try {
      this.settings.setValue('ntrip.host', this.options.host)
      this.settings.setValue('ntrip.port', this.options.port)
      this.settings.setValue('ntrip.mountpoint', this.options.mountpoint)
      this.settings.setValue('ntrip.username', this.options.username)
      this.settings.setValue('ntrip.password', this.options.password)
      this.settings.setValue('ntrip.active', this.options.active)
      console.log('Saved NTRIP settings')
      this.winston.info('Saved NTRIP settings')
    } catch (e) {
      console.log(e)
      this.winston.info(e)
    }

    this.startStopNTRIP()
  }

  onMavPacket (packet, data) {
    // FC is active
    if (!this.options.active) {
      return
    }

    if (this.status === 1) {
      this.status = 2
    }

    // new MAVLink packet recieved - get the lat/lon
    if (packet.header.msgid === common.GpsRawInt.MSG_ID && data.fixType >= 2) {
      // note conversion from lat/lon/alt to ECEF
      this.options.xyz = geoToEcef([data.lat / 1E7, data.lon / 1E7, data.alt / 1E3])

      if (this.client) {
        this.client.xyz = this.options.xyz
      }
      if (this.status === 2) {
        this.status = 3
      }
    }
  }

  conStatusStr () {
    // connection status - connected, not connected, no packets for x sec
    if ((Date.now().valueOf()) - this.timeofLastPacket < 2000 && this.status === 4) {
      return 'Active - receiving RTCM packets'
    } else if (this.timeofLastPacket > 0 && this.status === 4) {
      this.status = 3
      return 'No RTCM server connection'
    } else if (this.status === 3) {
      return 'No RTCM server connection'
    } else if (this.status >= 2) {
      return 'Waiting for GPS lock'
    } else if (this.status === 1) {
      return 'Waiting for flight controller packets'
    } else if (this.status === 0) {
      return 'Not active'
    } else if (this.status === -1) {
      return 'Error - unable to connect to NTRIP server'
    }
  }
}

module.exports = ntrip
