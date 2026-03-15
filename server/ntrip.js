// NTRIP Manager
const { NtripClient } = require('ntrip-client')
const { geoToEcef } = require('ntrip-client/lib/nmea/ecef')
const { UNKOWN_HEADER_ERROR } = require('ntrip-decoder/lib/config'); // NOTE: depends on internal path of ntrip-client's dependency ntrip-decoder
const events = require('events')
const os = require('os')
const { common } = require('node-mavlink')

class ntrip {
  constructor (settings) {
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
      active: false,
      useTls: false
    }

    // status. 0=not active, 1=waiting for FC, 2=waiting for GPS lock, 3=waiting for NTRIP server, 4=getting packets
    // -1=ntrip error
    this.status = 0

    // additional error description to be displayed next to the status
    this.errorDescription = ""

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
    this.options.useTls = this.settings.value('ntrip.useTls', false)
    //NOTE: can allow untrusted/self-signed TLS by setting environment variable NODE_TLS_REJECT_UNAUTHORIZED='0'. 
    // Adding this as option rejectUnauthorized to settings would also be possible.

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
      this.options.active,
      this.options.useTls)
  }

  startStopNTRIP () {
    if (this.options.active) { // NTRIP enabled
      this.errorDescription = "Offline";
      this.client = new NtripClient(this.options)
      this.client.headers['Host'] = os.hostname()
      this.client.headers['Ntrip-Version'] = 'Ntrip/2.0'
      this.client.userAgent = 'NTRIP Rpanion-server'
      this.seq = 0

      this.client.on('data', (data) => {
        this.errorDescription = "Online"
        if (this.options.active) {
          // console.log('Received NTRIP data:' + data.toString('hex'))
          this.status = 4
          this.timeofLastPacket = (Date.now().valueOf())
          this.eventEmitter.emit('rtcmpacket', data, this.seq)
          this.seq = this.seq + 1
        }
      })

      this.client.on('close', () => {
        console.log('NTRIP client closed')
      })

      this.client.on('error', (err) => {
        this.errorDescription = "Network Error: " + this.formatError(err)
        console.log('[NTRIP] ' + this.errorDescription)
        if (this.options.active) {
          this.status = -1
        }
      })

      this.client.run()
      console.log('NTRIP started')  // Note: connect() is not actually blocking...
      this.status = 1
    } else { // NTRIP disabled
      this.errorDescription = "Disabled";
      // stop the client
      if (this.client) {
        this.client.close() // close NTRIP-client's socket and stop its loop
        this.client = null
      }

      this.status = 0
      console.log('NTRIP stopped')
    }
  }

  setSettings (host, port, mount, username, password, active, useTls) {
    // save new settings
    this.options.host = host
    this.options.port = port
    this.options.mountpoint = mount
    this.options.username = username
    this.options.password = password
    this.options.active = active
    this.options.useTls = useTls

    // and save
    try {
      this.settings.setValue('ntrip.host', this.options.host)
      this.settings.setValue('ntrip.port', this.options.port)
      this.settings.setValue('ntrip.mountpoint', this.options.mountpoint)
      this.settings.setValue('ntrip.username', this.options.username)
      this.settings.setValue('ntrip.password', this.options.password)
      this.settings.setValue('ntrip.active', this.options.active)
      this.settings.setValue('ntrip.useTls', this.options.useTls)
      console.log('Saved NTRIP settings')
    } catch (e) {
      console.log(e)
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
        this.client.setXYZ(this.options.xyz)
      }
      if (this.status === 2) {
        this.status = 3
      }
    }
  }

  formatError(err) {
    if (err instanceof Error) {
      return `[${err.name}] ${err.message}`;
    }
    if (err && typeof err.message === 'string') {
      return `[Error] ${err.message}`;
    }
    let errString = String(err)

    // if we receive an unexpected HTTP header, we can try to parse it to give some hints
    if (errString.startsWith(UNKOWN_HEADER_ERROR)) {
        const rest = errString.slice(UNKOWN_HEADER_ERROR.length).trim(); // Remove prefix
        const m = rest.match(/^HTTP\/\d+\.\d+\s+(\d{3})/); // Match HTTP status line
        if (m) {
            const code = Number(m[1]);
            switch (code) {
              case 401:
                console.log("[NTRIP] Identified header as HTTP 401: " + errString);
                errString = "Unauthorized (401). Incorrect credentials?";
              case 404:
                console.log("[NTRIP] Identified header as HTTP 404: " + errString);
                errString = "Mountpoint not found (404)";
              default:
                console.log("[NTRIP] HTTP header indicates failure: " + errString);
                errString = "Connection failed"  // err comes from a 3rd party server, we should not print it to UI directly, to avoid XSS
            }
        }
    }
    return errString;
  }

  conStatusStr () {
    let msg = ''
    // connection status - connected, not connected, no packets for x sec
    if ((Date.now().valueOf()) - this.timeofLastPacket < 2000 && this.status === 4) {
      msg = 'Active - receiving RTCM packets'
    } else if (this.timeofLastPacket > 0 && this.status === 4) {
      this.status = 3
      msg = 'No RTCM server connection'
    } else if (this.status === 3) {
      msg = 'No RTCM server connection'
    } else if (this.status >= 2) {
      msg = 'Waiting for GPS lock'
    } else if (this.status === 1) {
      msg = 'Waiting for flight controller packets'
    } else if (this.status === 0) {
      msg = 'Not active'
    } else if (this.status === -1) {
      msg = 'Error - unable to connect to NTRIP server'
      // NOTE: this status is not permanent. this.client may retry and eventually emit 'data' Events, or onMavPacket may trigger.
    }
    return msg + ' | ' + this.errorDescription
  }
}

module.exports = ntrip
