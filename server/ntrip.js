// NTRIP Manager
const events = require('events')
const os = require('os')
const { common } = require('node-mavlink')
const net = require('net')
const tls = require('tls')


const pad = (n, width, z) => {
  n = n + ''
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n
}

/**
 * Get checksum from raw data
 *
 * @param {string} data - raw data
 * @return {string} checksum en hex
 */
const getChecksum = (data) => {
  let checksum
  data = data.toString()
  const idx1 = data.indexOf('$G')
  const idx2 = data.indexOf('*')
  checksum = data
    .slice(idx1 + 1, idx2)
    .split('')
    .reduce((y, x) => y ^ x.charCodeAt(0), 0)
  return checksum
};

const toHexString = (checksum) => {
  const buf = Buffer.allocUnsafe(1)
  buf.fill(checksum)
  return buf.toString('hex')
};

const encodeTime = (time) => {
  const date = new Date(time)

  const hours = pad(date.getUTCHours(), 2, 0)
  const minutes = pad(date.getUTCMinutes(), 2, 0)
  const secs = pad(date.getUTCSeconds(), 2, 0)
  const msecs = pad(date.getUTCMilliseconds(), 3, 0)
  return `${hours}${minutes}${secs}.${msecs}`
};

/**
 * Decimal latitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const latToDmm = (data) => {
  const tmp = data.toString().split('.')
  const deg = pad(Math.abs(tmp[0]), 2, '0')
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6)
  const fixedArr = fixed.toString().split('.')
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1]
  // const mim = pad((('0.' + (tmp[1] || 0)) * 60).toFixed(4), 7, '0');
  const sign = data < 0 ? 'S' : 'N'
  return `${deg}${mim},${sign}`
};

/**
 * Decimal longitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const lngToDmm = (data) => {
  const tmp = data.toString().split('.')
  const deg = pad(Math.abs(tmp[0]), 3, '0')
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6)
  const fixedArr = fixed.toString().split('.')
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1]
  const sign = data < 0 ? 'W' : 'E'
  return `${deg}${mim},${sign}`
};

/**
 * encode data to GGA
 * @param {*} data
 */
const encodeGGA = (data) => {
  const result = ['$' + data.type]
  result.push(encodeTime(data.datetime))

  result.push(latToDmm(data.loc[0]))
  result.push(lngToDmm(data.loc[1]))
  result.push(data.gpsQuality)
  result.push(pad(data.satellites, 2, 0))
  result.push(data.hdop.toFixed(3))
  result.push(data.altitude)
  result.push(data.altitudeUnit || 'M')
  result.push(data.geoidalSeparation)
  result.push(data.geoidalSeparationUnit || 'M')
  if (data.ageGpsData) {
    result.push(data.ageGpsData ? data.ageGpsData.toFixed(3) : data.ageGpsData)
  }
  if (data.refStationId) {
    result.push(
      data.refStationId
        ? pad(parseInt(data.refStationId), 4, 0)
        : data.refStationId
    );
  }

  const resultMsg = result.join(',') + '*'
  return resultMsg + toHexString(getChecksum(resultMsg)).toUpperCase()
};

class NtripClientWrapper extends events.EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.client = null
    this.ggaInterval = null
    this.loc = [0, 0]
    this.status = "Offline"
  }

  startSendingGGA() {
    this.ggaInterval = setInterval(() => {
      if (this.client && this.client.writable) {
        const ggaMessage = this.generateGGAMessage()
        this.client.write(ggaMessage)
      }
    }, 60000)
  }

  stopSendingGGA() {
    if (this.ggaInterval) {
      clearInterval(this.ggaInterval)
      this.ggaInterval = null
    }
  }

  generateGGAMessage() {
    // Generate a GGA message here
    return encodeGGA({
      datetime: Date.now(),
      loc: this.loc,
      gpsQuality: 1,
      satellites: 0,
      hdop: 0,
      altitude: 0,
      geoidalSeparation: 0,
      ageGpsData: 1,
      refStationId: 1,
      type: 'GPGGA'
    })
  }

  connect() {
    const { host, port, username, password, mountpoint, useTls } = this.options
    const auth = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
    const headers = {
      'Ntrip-Version': 'Ntrip/2.0',
      'User-Agent': 'NTRIP rpanion-server',
      'Authorization': `Basic ${auth}`,
      'Host': os.hostname()
    }

    const requestOptions = {
      host,
      port
    }

    const connectCallback = (client) => {
      client.on('error', (err) => {
        this.emit('error', err)
        this.status = toString(err)
      })

      client.on('end', () => {
        this.emit('close')
        this.stopSendingGGA()
      })

      let customHeader = '';
      for (const key in headers) {
        customHeader += `${key}: ${headers[key]}\r\n`
      }
      const data = `GET /${mountpoint} HTTP/1.1\r\n${customHeader}\n\r\n`
      client.write(data)

      client.on('data', (data) => {
        // print data as ascii
        let header_lines = data.toString().split("\r\n")
        for (let line of header_lines) {
          // check for 401 and 404 errors
          if (line.includes('401 Unauthorized')) {
            this.emit('error', '401 Unauthorized')
            this.stopSendingGGA()
            this.status = "Incorrect credentials"
            return
          } else if (line.includes('404 Not Found')) {
            this.emit('error', '404 Not Found')
            this.stopSendingGGA()
            this.status = "Mount point not found"
            return
          }
        }
        this.emit('data', data)
        this.status = "Online"
      })

      this.startSendingGGA()
    }

    if (useTls) {
      this.client = tls.connect(requestOptions, () => connectCallback(this.client))
    } else {
      this.client = net.connect(requestOptions)
      this.client.on('error', (err) => {
        this.emit('error', err)
        this.status = "Bad Host/Port or network error"
      })
      this.client.on('connect', () => connectCallback(this.client))
    }
  }

  disconnect() {
    if (this.client) {
      this.stopSendingGGA()
      this.client.end()
      this.client = null
      
    }
  }
}

class ntrip {
  constructor (settings, winston) {
    this.options = {
      host: '',
      port: 2101,
      mountpoint: '',
      username: '',
      password: '',
      // the interval of send nmea, unit is millisecond
      interval: 2000,
      active: false,
      useTls: false
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
    this.options.useTls = this.settings.value('ntrip.useTls', false)

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
    if (this.options.active) {
      this.client = new NtripClientWrapper(this.options)
      this.seq = 0

      this.client.on('data', (data) => {
        if (this.options.active) {
          try {
            this.status = 4
            this.timeofLastPacket = (Date.now().valueOf())
            this.eventEmitter.emit('rtcmpacket', data, this.seq)
            this.seq = this.seq + 1
          } catch (e) {
            console.log('Bad ntrip data')
          }
        }
      })

      this.client.on('close', () => {
        console.log('NTRIP client close')
      })

      this.client.on('error', (err) => {
        // halt on error
        if (this.options.active) {
          console.log('NTRIP error ' + err)
          this.winston.info('NTRIP error ' + err)
          this.status = -1
        }
      })

      this.client.connect()
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

  // for running tests only
  generateGGAMessage (loc) {
    if (this.client) {
      this.client.loc = loc
      return this.client.generateGGAMessage()
    } else {
      let client = new NtripClientWrapper(this.options)
      client.loc = loc
      return client.generateGGAMessage()
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
      if (this.client) {
        this.client.loc = [data.lat / 1E7, data.lon / 1E7]
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
      let errDesc = this.client.status
      return 'No RTCM server connection - ' + errDesc
    } else if (this.status === 3) {
      let errDesc = this.client.status
      return 'No RTCM server connection - ' + errDesc
    } else if (this.status >= 2) {
      return 'Waiting for GPS lock'
    } else if (this.status === 1) {
      return 'Waiting for flight controller packets'
    } else if (this.status === 0) {
      return 'Not active'
    } else if (this.status === -1) {
      let errDesc = this.client.status
      return 'Error - unable to connect to NTRIP server - ' + errDesc
    }
  }
}

module.exports = ntrip
