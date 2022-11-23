const express = require('express')
const fileUpload = require('express-fileupload')
const compression = require('compression')
const bodyParser = require('body-parser')
const pino = require('express-pino-logger')()
const process = require('process')

const networkManager = require('./networkManager')
const aboutPage = require('./aboutInfo')
const videoStream = require('./videostream')
const fcManagerClass = require('./flightController')
const flightLogger = require('./flightLogger.js')
const networkClients = require('./networkClients.js')
const ntrip = require('./ntrip.js')
const adhocManager = require('./adhocManager.js')
const cloudManager = require('./cloudUpload.js')
const VPNManager = require('./vpn')
const logConversionManager = require('./logConverter.js')


const winston = require('./winstonconfig')(module)

const appRoot = require('app-root-path')
const settings = require('settings-store')
const { exec, execSync } = require('child_process')

const app = express()
const http = require('http').Server(app)
const path = require('path')

// set up rate limiter: maximum of fifty requests per minute
const RateLimit = require('express-rate-limit')
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50
})

// apply rate limiter to all requests
app.use(limiter)

// use file uploader for Wireguard profiles
app.use(fileUpload({ limits: { fileSize: 500 }, abortOnLimit: true, useTempFiles: true, tempFileDir: '/tmp/', safeFileNames: true, preserveExtension: 4 }))

const io = require('socket.io')(http, { cookie: false })
const { check, validationResult, oneOf } = require('express-validator')

// Init settings before running the other classes
settings.init({
  appName: 'Rpanion-server', // required,
  reverseDNS: 'com.server.rpanion', // required for macOS
  filename: path.join(appRoot.toString(), 'settings.json')
})

const vManager = new videoStream(settings, winston)
const fcManager = new fcManagerClass(settings, winston)
const logManager = new flightLogger(settings, winston)
const ntripClient = new ntrip(settings, winston)
const cloud = new cloudManager(settings, winston)
const logConversion = new logConversionManager(settings, winston)


// cleanup, if needed
process.on('SIGINT', quitting) // run signal handler when main process exits

function quitting () {
  cloud.quitting()
  logConversion.quitting()
  console.log('---Shutdown Rpanion---')
  winston.info('---Shutdown Rpanion---')
  process.exit()
}

// Got an RTCM message, send to flight controller
ntripClient.eventEmitter.on('rtcmpacket', (msg, seq) => {
  // logManager.writetlog(msg.buf);
  try {
    if (fcManager.m) {
      fcManager.m.sendRTCMMessage(msg, seq)
    }
  } catch (err) {
    console.log(err)
  }
})

// Connecting the flight controller datastream to the logger
// and ntrip
fcManager.eventEmitter.on('gotMessage', (msg) => {
  try {
    logManager.writetlog(msg)
    ntripClient.onMavPacket(msg)
  } catch (err) {
    console.log(err)
  }
})

fcManager.eventEmitter.on('newLink', () => {
  try {
    logManager.newtlog()
  } catch (err) {
    console.log(err)
  }
})

fcManager.eventEmitter.on('stopLink', () => {
  try {
    logManager.stoptlog()
  } catch (err) {
    console.log(err)
  }
})

fcManager.eventEmitter.on('armed', () => {
})

fcManager.eventEmitter.on('disarmed', () => {
})

let FCStatusLoop = null

app.use(bodyParser.urlencoded({ extended: true }))
app.use(pino)

// Simply pass `compression` as an Express middleware!
app.use(compression())
app.use(bodyParser.json())

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, '..', '/build')))

// Serve the vpn zerotier info
app.get('/api/vpnzerotier', (req, res) => {
  VPNManager.getVPNStatusZerotier(null, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Add zerotier network
app.post('/api/vpnzerotieradd', [check('network').isAlphanumeric()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/vpnzerotieradd', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }
  VPNManager.addZerotier(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Remove zerotier network
app.post('/api/vpnzerotierdel', [check('network').isAlphanumeric()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/vpnzerotierdel', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }
  VPNManager.removeZerotier(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Serve the vpn wireguard info
app.get('/api/vpnwireguard', (req, res) => {
  VPNManager.getVPNStatusWireguard(null, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Add new wireguard network
app.post('/api/vpnwireguardprofileadd', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0 || req.files.wgprofile.truncated) {
    console.log("Couldn't upload")
    return res.redirect('../vpn')
  }

  VPNManager.addWireguardProfile(req.files.wgprofile.name, req.files.wgprofile.tempFilePath, () => {
    return res.redirect('../vpn')
  })
})

// Activate wireguard network
app.post('/api/vpnwireguardactivate', [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/vpnwireguardactivate', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }

  VPNManager.activateWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Deactivate wireguard network
app.post('/api/vpnwireguarddeactivate', [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/vpnwireguarddeactivate', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }

  VPNManager.deactivateWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Delete wireguard network
app.post('/api/vpnwireguardelete', [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/vpnwireguardelete', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }

  VPNManager.deleteWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Serve the ntrip info
app.get('/api/ntripconfig', (req, res) => {
  ntripClient.getSettings((host, port, mountpoint, username, password, active) => {
    res.setHeader('Content-Type', 'application/json')
    // console.log(JSON.stringify({host: host,  port: port, mountpoint: mountpoint, username: username, password: password}))
    res.send(JSON.stringify({ host: host, port: port, mountpoint: mountpoint, username: username, password: password, active: active }))
  })
})

// Serve the cloud info
app.get('/api/cloudinfo', (req, res) => {
  cloud.getSettings((doBinUpload, binUploadLink, syncDeletions, pubkey) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ doBinUpload: doBinUpload, binUploadLink: binUploadLink, syncDeletions: syncDeletions, pubkey: pubkey }))
  })
})

// activate or deactivate bin log upload
app.post('/api/binlogupload', [check('doBinUpload').isBoolean(),
  check('binUploadLink').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim(),
  check('syncDeletions').isBoolean()], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    winston.error('Bad POST vars in /api/binlogupload', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  } else {
    cloud.setSettingsBin(req.body.doBinUpload, req.body.binUploadLink, req.body.syncDeletions)
    // send back refreshed settings
    cloud.getSettings((doBinUpload, binUploadLink, syncDeletions) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ doBinUpload: doBinUpload, binUploadLink: binUploadLink, syncDeletions: syncDeletions }))
    })
  }
})


// Serve the logconversion info
app.get('/api/logconversioninfo', (req, res) => {
  logConversion.getSettings((doLogConversion) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ doLogConversion: doLogConversion}))
  })
})

// activate or deactivate logconversion
app.post('/api/logconversion', [check('doLogConversion').isBoolean()
  ], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    winston.error('Bad POST vars in /api/logconversion', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  } else {
    logConversion.setSettingsLog(req.body.doLogConversion)
    // send back refreshed settings
    logConversion.getSettings((doLogConversion) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ doLogConversion: doLogConversion}))
    })
  }
})

// Serve the adhocwifi info
app.get('/api/adhocadapters', (req, res) => {
  adhocManager.getAdapters((err, netDeviceList, netDeviceSelected, settings) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: netDeviceList, netDeviceSelected: netDeviceSelected, curSettings: settings }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: [], netDeviceSelected: [], cursettings: [], error: err }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/adhocadapters ', { message: err })
    }
  })
})

// activate or deactivate adhoc wifi
app.post('/api/adhocadaptermodify', [check('settings.isActive').isBoolean(),
  check('toState').isBoolean(),
  check('netDeviceSelected').isAlphanumeric(),
  check('settings.ipaddress').if(check('toState').isIn([true])).isIP(),
  check('settings.wpaType').isIn(['none', 'wep']),
  check('settings.password').if(check('settings.wpaType').isIn(['wep'])).isAlphanumeric(),
  check('settings.ssid').if(check('toState').isIn([true])).isAlphanumeric(),
  check('settings.band').isIn(['a', 'bg']),
  check('settings.channel').if(check('toState').isIn([true])).isInt()], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    winston.error('Bad POST vars in /api/adhocadaptermodify', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  } else {
    adhocManager.setAdapter(req.body.toState, req.body.netDeviceSelected, req.body.settings, (err, netDeviceList, netDeviceSelected, settings) => {
      if (!err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { netDevice: netDeviceList, netDeviceSelected: netDeviceSelected, curSettings: settings }
        res.send(JSON.stringify(ret))
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { netDevice: netDeviceList, netDeviceSelected: netDeviceSelected, curSettings: settings, error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/adhocadapters ', { message: err })
      }
    })
  }
})

// change ntrip settings
app.post('/api/ntripmodify', [check('active').isBoolean(),
  check('host').isLength({ min: 5 }),
  check('port').isPort(),
  check('mountpoint').isLength({ min: 1 }),
  check('username').isLength({ min: 5 }),
  check('password').isLength({ min: 5 })], function (req, res) {
  // User wants to start/stop NTRIP
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/ntripmodify', { message: errors.array().toString() })
    return res.status(422).json({ errors: errors.array() })
  }

  ntripClient.setSettings(JSON.parse(req.body.host), req.body.port, JSON.parse(req.body.mountpoint), JSON.parse(req.body.username), JSON.parse(req.body.password), req.body.active)
  ntripClient.getSettings((host, port, mountpoint, username, password, active) => {
    res.setHeader('Content-Type', 'application/json')
    // console.log(JSON.stringify({host: host,  port: port, mountpoint: mountpoint, username: username, password: password}))
    res.send(JSON.stringify({ host: host, port: port, mountpoint: mountpoint, username: username, password: password, active: active }))
  })
})

// Serve the AP clients info
app.get('/api/networkclients', (req, res) => {
  networkClients.getClients((err, apnamev, apclientsv) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: err, apname: apnamev, apclients: apclientsv }))
  })
})

// Serve the logfiles
app.use('/logdownload', express.static(path.join(__dirname, '..', '/flightlogs')))

// Serve the logfiles
app.use('/rplogs', express.static(path.join(__dirname, '..', '/logs')))

app.get('/api/logfiles', (req, res) => {
  logManager.getLogs((err, tlogs, binlogs, kmzlogs, activeLogging) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ enablelogging: activeLogging, TlogFiles: tlogs, BinlogFiles: binlogs, KMZlogFiles: kmzlogs, url: req.protocol + '://' + req.headers.host, logStatus: logManager.getStatus() }))
  })
})

app.post('/api/deletelogfiles', [check('logtype').isIn(['tlog', 'binlog', 'kmzlog'])], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/deletelogfiles', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }

  logManager.clearlogs(req.body.logtype, fcManager.binlog)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({}))
})

app.get('/api/newlogfile', (req, res) => {
  logManager.newtlog()
  //console.log(logConversion.tlogfilename)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({}))
})

app.get('/api/tlogfilename', (req, res) => {
  //console.log(logManager.activeFileTlog)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({tlogfilename: logManager.activeFileTlog}))
})

app.post('/api/logenable', [check('enable').isBoolean()], function (req, res) {
  // User wants to enable/disable logging
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/logenable', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ enablelogging: logManager.setLogging(req.body.enable) }))
})

app.get('/api/softwareinfo', (req, res) => {
  aboutPage.getSoftwareInfo((OSV, NodeV, RpanionV, hostname, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ OSVersion: OSV, Nodejsversion: NodeV, rpanionversion: RpanionV, hostname: hostname}))
      winston.info('/api/softwareinfo OS:' + OSV + ' Node:' + NodeV + ' Rpanion:' + RpanionV + ' Hostname: ' + hostname)
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ OSVersion: err, Nodejsversion: err, rpanionversion: err, hostname: err }))
      winston.error('Error in /api/softwareinfo ', { message: err })
    }
  })
})

app.get('/api/videodevices', (req, res) => {
  vManager.populateAddresses()
  vManager.getVideoDevices((err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDP, SeluseUDPIP, SeluseUDPPort, timestamp) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      if (!active) {
        res.send(JSON.stringify({
          dev: devices,
          vidDeviceSelected: ((devices.length > 0) ? devices[0] : []),
          vidres: ((devices.length > 0) ? devices[0].caps : []),
          vidResSelected: ((devices.length > 0) ? devices[0].caps[0] : []),
          // fpsSelected:  ((devices.length > 0) ? devices[0].caps[0].fpsmax : 1),
          fpsSelected: ((devices.length > 0) ? (devices[0].caps[0].fpsmax === 0 ? devices[0].caps[0].fps[0] : devices[0].caps[0].fpsmax) : 1),
          streamingStatus: active,
          streamAddresses: vManager.deviceAddresses,
          UDPChecked: SeluseUDP,
          useUDPIP: SeluseUDPIP,
          useUDPPort: SeluseUDPPort,
          timestamp: timestamp,
          errors: null
        }))
      } else {
        res.send(JSON.stringify({
          dev: devices,
          vidDeviceSelected: seldevice,
          vidres: seldevice.caps,
          vidResSelected: selRes,
          streamingStatus: active,
          streamAddresses: vManager.deviceAddresses,
          rotSelected: selRot,
          bitrate: selbitrate,
          fpsSelected: selfps,
          UDPChecked: SeluseUDP,
          useUDPIP: SeluseUDPIP,
          useUDPPort: SeluseUDPPort,
          timestamp: timestamp,
          errors: null
        }))
      }
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ errors: err }))
      winston.error('Error in /api/videodevices ', { message: err })
    }
  })
})

app.get('/api/hardwareinfo', (req, res) => {
  aboutPage.getHardwareInfo((RAM, CPU, hatData, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ CPUName: CPU, RAMName: RAM, HATName: hatData }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ CPUName: err, RAMName: err, HATName: err }))
      winston.error('Error in /api/hardwareinfo ', { message: err })
    }
  })
})

app.get('/api/diskinfo', (req, res) => {
  aboutPage.getDiskInfo((total, used, percent, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ diskSpaceStatus: 'Used ' + used + '/' + total + ' Gb (' + percent + '%)' }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ diskSpaceStatus: err }))
      winston.error('Error in /api/diskinfo ', { message: err })
    }
  })
})

app.get('/api/FCOutputs', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: fcManager.getUDPOutputs() }))
})

app.get('/api/FCDetails', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  fcManager.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, active, enableTCP, enableUDPB, UDPBPort) => {
    if (!err) {
      console.log('Sending')
      console.log(devices)
      res.send(JSON.stringify({
        telemetryStatus: active,
        serialPorts: devices,
        baudRates: bauds,
        serialPortSelected: seldevice,
        mavVersions: mavers,
        mavVersionSelected: selmav,
        baudRateSelected: selbaud,
        enableTCP: enableTCP,
        enableUDPB: enableUDPB,
        UDPBPort: UDPBPort
      }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ serialPortSelected: err, baudRateSelected: err }))
      winston.error('Error in /api/FCDetails ', { message: err })
    }
  })
})

app.post('/api/shutdowncc', function (req, res) {
  // User wants to shutdown the computer
  aboutPage.shutdownCC()
})

app.post('/api/updatemaster', function (req, res) {
  // User wants to update Rpanion to latest master
  aboutPage.updateRS(io)
})

app.post('/api/FCModify', [check('device').isJSON(), check('baud').isJSON(), check('mavversion').isJSON(), check('enableTCP').isBoolean(), check('enableUDPB').isBoolean(), check('UDPBPort').isPort()], function (req, res) {
  // User wants to start/stop FC telemetry
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/FCModify', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }

  fcManager.startStopTelemetry(JSON.parse(req.body.device), JSON.parse(req.body.baud), JSON.parse(req.body.mavversion), req.body.enableTCP, req.body.enableUDPB, req.body.UDPBPort, (err, isSuccess) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      // console.log(isSuccess);
      res.send(JSON.stringify({ telemetryStatus: isSuccess, error: null }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ telemetryStatus: false, error: err }))
      winston.error('Error in /api/FCModify ', { message: err })
    }
  })
})

app.post('/api/FCReboot', function (req, res) {
  fcManager.rebootFC()
})

app.post('/api/addudpoutput', [check('newoutputIP').isIP(), check('newoutputPort').isInt({ min: 1 })], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/addudpoutput ', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }

  const newOutput = fcManager.addUDPOutput(req.body.newoutputIP, parseInt(req.body.newoutputPort))

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: newOutput }))
})

app.post('/api/removeudpoutput', [check('removeoutputIP').isIP(), check('removeoutputPort').isInt({ min: 1 })], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/removeudpoutput ', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }

  const newOutput = fcManager.removeUDPOutput(req.body.removeoutputIP, parseInt(req.body.removeoutputPort))

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: newOutput }))
})

io.on('connection', function (socket) {
  // only set interval if not already set
  if (FCStatusLoop !== null) {
    return
  }
  // send Flight Controller and NTRIP status out 1 per second
  FCStatusLoop = setInterval(function () {
    io.sockets.emit('FCStatus', fcManager.getSystemStatus())
    io.sockets.emit('NTRIPStatus', ntripClient.conStatusStr())
    io.sockets.emit('CloudBinStatus', cloud.conStatusBinStr())
    io.sockets.emit('LogConversionStatus', logConversion.conStatusLogStr())
  }, 1000)
})

app.get('/api/networkadapters', (req, res) => {
  networkManager.getAdapters((err, netDeviceList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: netDeviceList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: [] }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/networkadapters ', { message: err })
    }
  })
})

app.get('/api/wifiscan', (req, res) => {
  networkManager.getWifiScan((err, wifiList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { detWifi: wifiList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { detWifi: [] }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/wifiscan ', { message: err })
    }
  })
})

app.get('/api/wirelessstatus', (req, res) => {
  networkManager.getWirelessStatus((err, status) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: status }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: true }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/wirelessstatus ', { message: err })
    }
  })
})

app.post('/api/setwirelessstatus', [check('status').isBoolean()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/setwirelessstatus ', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }
  // user wants to toggle wifi enabled/disabled
  networkManager.setWirelessStatus(req.body.status, (err, status) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: status }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: status }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/setwirelessstatus ', { message: err })
    }
  })
})

app.get('/api/networkconnections', (req, res) => {
  networkManager.getConnections((err, netConnectionList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnection: netConnectionList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnection: [] }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/networkconnections ', { message: err })
    }
  })
})

app.post('/api/startstopvideo', [check('active').isBoolean(),
  check('device').isLength({ min: 2 }),
  check('height').isInt({ min: 1 }),
  check('width').isInt({ min: 1 }),
  check('useUDP').isBoolean(),
  check('useTimestamp').isBoolean(),
  check('useUDPPort').isPort(),
  check('useUDPIP').isIP(),
  check('bitrate').isInt({ min: 50, max: 10000 }),
  check('format').isIn(['video/x-raw', 'video/x-h264', 'image/jpeg']),
  check('fps').isInt({ min: -1, max: 100 }),
  check('rotation').isInt().isIn([0, 90, 180, 270])], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/startstopvideo ', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }
  // user wants to start/stop video streaming
  vManager.startStopStreaming(req.body.active, req.body.device, req.body.height, req.body.width, req.body.format, req.body.rotation, req.body.bitrate, req.body.fps, req.body.useUDP, req.body.useUDPIP, req.body.useUDPPort, req.body.useTimestamp, (err, status, addresses) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { streamingStatus: status, streamAddresses: addresses }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { streamingStatus: false, streamAddresses: ['Error ' + err] }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/startstopvideo ', { message: err })
    }
  })
})

// Get details of a network connection by connection ID
app.post('/api/networkIP', [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    winston.error('Bad POST vars in /api/networkIP ', { message: errors.array() })
    return res.status(422).json({ errors: errors.array() })
  }
  networkManager.getConnectionDetails(req.body.conName, (err, conDetails) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnectionDetails: conDetails }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnectionDetails: {} }
      res.send(JSON.stringify(ret))
      winston.error('Error in /api/networkIP ', { message: err })
    }
  })
})

// user wants to activate network
app.post('/api/networkactivate', [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    winston.error('Bad POST vars in /api/networkactivate ', { message: errors.array() })
  } else {
    console.log('Activating network ' + req.body.conName)
    networkManager.activateConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/networkactivate ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkActivateOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to deactivate network
app.post('/api/networkdeactivate', [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    winston.error('Bad POST vars in /api/networkdeactivate ', { message: errors.array() })
  } else {
    console.log('Dectivating network ' + req.body.conName)
    networkManager.deactivateConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/networkdeactivate ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkDectivateOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to delete network
app.post('/api/networkdelete', [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    winston.error('Bad POST vars in /api/networkdelete ', { message: errors.array() })
  } else {
    console.log('Deleting network ' + req.body.conName)
    networkManager.deleteConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/networkdelete ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkDeleteOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to edit network
app.post('/api/networkedit', [check('conName').isUUID(),
  check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress.value').optional().isIP(),
  check('conSettings.subnet.value').optional().isIP(),
  check('conSettings.wpaType.value').optional().isIn(['wpa-none', 'wpa-psk']),
  check('conSettings.password.value').optional().escape(),
  check('conSettings.ssid.value').optional().escape(),
  check('conSettings.attachedIface.value').optional().escape(),
  check('conSettings.band.value').optional().isIn(['a', 'bg']),
  check('conSettings.channel.value').optional().isInt(),
  check('conSettings.mode.value').optional().isIn(['infrastructure', 'ap'])
],
(req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    winston.error('Bad POST vars in /api/networkedit ', { message: errors.array() })
  } else {
    console.log('Editing network ' + req.body.conName)
    networkManager.editConnection(req.body.conName, req.body.conSettings, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/networkedit ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkEditOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// User wants to add network
app.post('/api/networkadd', [check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress.value').optional().isIP(),
  check('conSettings.subnet.value').optional().isIP(),
  check('conSettings.wpaType.value').optional().isIn(['wpa-none', 'wpa-psk']),
  check('conSettings.password.value').optional().escape(),
  check('conSettings.ssid.value').optional().escape(),
  check('conSettings.band.value').optional().isIn(['a', 'bg']),
  check('conSettings.channel.value').optional().isInt(),
  check('conSettings.attachedIface.value').optional().escape(),
  check('conSettings.mode.value').optional().isIn(['infrastructure', 'ap']),
  check('conName').escape(),
  check('conType').escape(),
  check('conAdapter').escape()
],
(req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    winston.error('Bad POST vars in /api/networkadd ', { message: errors.array() })
  } else {
    console.log('Adding network ' + req.body)
    networkManager.addConnection(req.body.conName, req.body.conType, req.body.conAdapter, req.body.conSettings, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        winston.error('Error in /api/networkadd ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkAddOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
  console.log(req.body)
})

// Handles any requests that don't match the ones above (ie pass to react app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '/build/index.html'))
})

const port = process.env.PORT || 3001
http.listen(port, () => {
  console.log('Express server is running on localhost:' + port)
  winston.info('Express server is running on localhost:' + port)
})
