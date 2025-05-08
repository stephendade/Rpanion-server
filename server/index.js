const express = require('express')
const fileUpload = require('express-fileupload')
const compression = require('compression')
const bodyParser = require('body-parser')
const pino = require('pino-http')()
const process = require('process')
const jwt = require('jsonwebtoken');
const { common } = require('node-mavlink')

const networkManager = require('./networkManager')
const aboutPage = require('./aboutInfo')
const videoStream = require('./videostream')
const fcManagerClass = require('./flightController')
const flightLogger = require('./flightLogger.js')
const networkClients = require('./networkClients.js')
const ntrip = require('./ntrip.js')
const Adhoc = require('./adhocManager.js')
const cloudManager = require('./cloudUpload.js')
const VPNManager = require('./vpn')
const logConversionManager = require('./logConverter.js')
const userLogin = require('./userLogin.js')

const appRoot = require('app-root-path')
const settings = require('settings-store')

const app = express()
const http = require('http').Server(app)
const path = require('path')

const io = require('socket.io')(http, { cookie: false })
const { check, validationResult } = require('express-validator')
const crypto = require('crypto');

// set up rate limiter: maximum of fifty requests per minute
const RateLimit = require('express-rate-limit')
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50
})

// Generate a new key if not provided
function generateSecretKey() {
  return crypto.randomBytes(64).toString('hex');
}
const RPANION_SECRET_KEY = process.env.RPANION_SECRET_KEY || generateSecretKey();
let tokenBlacklist = [];

// apply rate limiter to all requests
app.use(limiter)

// use file uploader for Wireguard profiles
app.use(fileUpload({ limits: { fileSize: 500 }, abortOnLimit: true, useTempFiles: true, tempFileDir: '/tmp/', safeFileNames: true, preserveExtension: 4 }))

// Init settings before running the other classes
settings.init({
  appName: 'Rpanion-server', // required,
  reverseDNS: 'com.server.rpanion', // required for macOS
  filename: path.join(appRoot.toString(), './config/settings.json')
})

const vManager = new videoStream(settings)
const fcManager = new fcManagerClass(settings)
const logManager = new flightLogger()
const ntripClient = new ntrip(settings, )
const cloud = new cloudManager(settings)
const logConversion = new logConversionManager(settings)
const adhocManager = new Adhoc(settings)
const userMgmt = new userLogin()

// cleanup, if needed
process.on('SIGINT', quitting) // run signal handler when main process exits
// process.on('SIGTERM', quitting) // run signal handler when service exits. Need for Ubuntu??

function quitting () {
  cloud.quitting()
  logConversion.quitting()
  console.log('---Shutdown Rpanion---')
  process.exit(0)
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

// Got a camera heartbeat event, send to flight controller
vManager.eventEmitter.on('cameraheartbeat', (mavType, autopilot, component) => {
  try {
    if (fcManager.m) {
      fcManager.m.sendHeartbeat(mavType, autopilot, component)
    }
  } catch (err) {
    console.log(err)
  }
})

// Got a CAMERA_INFORMATION event, send to flight controller
vManager.eventEmitter.on('camerainfo', (msg, senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      fcManager.m.sendCommandAck(common.CameraInformation.MSG_ID, 0, senderSysId, senderCompId, targetComponent)
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log(err)
  }
})

// Got a VIDEO_STREAM_INFORMATION event, send to flight controller
vManager.eventEmitter.on('videostreaminfo', (msg, senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      fcManager.m.sendCommandAck(common.VideoStreamInformation.MSG_ID, 0, senderSysId, senderCompId, targetComponent)
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log(err)
  }
})

// Connecting the flight controller datastream to the logger
// and ntrip and video
fcManager.eventEmitter.on('gotMessage', (packet, data) => {
  try {
    ntripClient.onMavPacket(packet, data)
    vManager.onMavPacket(packet, data)
  } catch (err) {
    console.log(err)
  }
})

fcManager.eventEmitter.on('newLink', () => {
})

fcManager.eventEmitter.on('stopLink', () => {
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

// User login
app.post('/api/login', [check('username').escape().isLength({ min: 2, max:20 }), check('password').escape().isLength({ min: 2, max:20 })], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/login', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  // Capture the input fields
  let username = req.body.username
  let password = req.body.password

  userMgmt.checkLoginDetails(username, password).then((match) => {
    if (match) {
      // Generate a token with user information
      const token = jwt.sign({ username: username }, RPANION_SECRET_KEY, {
        expiresIn: '1h', // Token expires in 1 hour
      })
      res.send({
        token: token
      })
    } else {
      res.status(401).send(JSON.stringify({error: 'Invalid username or password'}))
    }
  })
})

// List all users
app.get('/api/users', authenticateToken, (req, res) => {
  userMgmt.getAllUsers().then((users) => {
    res.send(JSON.stringify({users: users}))
  })
})

// Update existing user password
app.post('/api/updateUserPassword', authenticateToken, [check('username').escape().isLength({ min: 2, max:20 }), check('password').escape().isLength({ min: 2, max:20 })], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/updateUserPassword', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  const { username, password } = req.body;

  if (!username || !password) {
    //return res.status(400).send({
    //  error: 'Username and password are required'
    //})
    res.status(400).send(JSON.stringify({error: 'Username and password are required'}))
  }

  userMgmt.changePassword(username, password).then((success) => {
    if (success) {
      res.send(JSON.stringify({infoMessage: 'User password updated successfully'}))
    } else {
      res.status(500).send(JSON.stringify({error: 'Error updating user password'}))
    }
  })
})

// Create new user
app.post('/api/createUser', authenticateToken, [check('username').escape().isLength({ min: 2, max:20 }), check('password').escape().isLength({ min: 2, max:20 })], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/logout', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).send(JSON.stringify({error: 'Username and password are required'}))
  }

  userMgmt.addUser(username, password).then((success) => {
    if (success) {
      res.send(JSON.stringify({infoMessage: 'User created successfully'}))
    } else {
      res.status(500).send(JSON.stringify({error: 'Error creating user'}))
    }
  })
})

// Delete a user
app.post('/api/deleteUser', authenticateToken, [check('username').escape().isLength({ min: 2, max:20 })], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/logout', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  const { username } = req.body

  if (!username) {
    return res.status(400).send(JSON.stringify({error: 'Username is required'}))
  }

  userMgmt.deleteUser(username).then((success) => {
    if (success) {
      res.send(JSON.stringify({infoMessage: 'User deleted successfully'}))
    } else {
      res.status(500).send(JSON.stringify({error: 'Error deleting user'}))
    }
  })
})

// User logout
app.post('/api/logout', authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // Add token to the blacklist
  tokenBlacklist.push(token)

  res.send({
    token: token
  })
})

// Simple token authentication call
app.post('/api/auth', authenticateToken, async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({error: null}))
})

// Middleware to check if the request has a valid token
function authenticateToken(req, res, next) {
  let authHeader = null
  let token = null
  // Skip authentication in development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  try {
    authHeader = req.headers['authorization']
    token = authHeader && authHeader.split(' ')[1]
  } catch (err) {
    return res.status(401).json({ message: 'Access denied. No token provided.' })
  }

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' })

  // Check if the token is blacklisted
  if (tokenBlacklist.includes(token)) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  jwt.verify(token, RPANION_SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' })
    req.user = user // Attach user to request
    next()
  })
}

// Serve the vpn zerotier info
app.get('/api/vpnzerotier', authenticateToken, (req, res) => {
  VPNManager.getVPNStatusZerotier(null, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Add zerotier network
app.post('/api/vpnzerotieradd', authenticateToken, [check('network').isAlphanumeric()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/vpnzerotieradd', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  VPNManager.addZerotier(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Remove zerotier network
app.post('/api/vpnzerotierdel', authenticateToken, [check('network').isAlphanumeric()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/vpnzerotierdel', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }
  VPNManager.removeZerotier(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusZerotier: statusJSON }))
  })
})

// Serve the vpn wireguard info
app.get('/api/vpnwireguard', authenticateToken, (req, res) => {
  VPNManager.getVPNStatusWireguard(null, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Add new wireguard network
app.post('/api/vpnwireguardprofileadd', authenticateToken, (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0 || req.files.wgprofile.truncated) {
    console.log("Couldn't upload")
    return res.redirect('../vpn')
  }

  VPNManager.addWireguardProfile(req.files.wgprofile.name, req.files.wgprofile.tempFilePath, () => {
    return res.redirect('../vpn')
  })
})

// Activate wireguard network
app.post('/api/vpnwireguardactivate', authenticateToken, [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/vpnwireguardactivate', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  VPNManager.activateWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Deactivate wireguard network
app.post('/api/vpnwireguarddeactivate', authenticateToken, [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/vpnwireguarddeactivate', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  VPNManager.deactivateWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Delete wireguard network
app.post('/api/vpnwireguardelete', authenticateToken, [check('network').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/vpnwireguardelete', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  VPNManager.deleteWireguardProfile(req.body.network, (stderr, statusJSON) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
  })
})

// Serve the ntrip info
app.get('/api/ntripconfig', authenticateToken, (req, res) => {
  ntripClient.getSettings((host, port, mountpoint, username, password, active, useTLS) => {
    res.setHeader('Content-Type', 'application/json')
    // console.log(JSON.stringify({host: host,  port: port, mountpoint: mountpoint, username: username, password: password}))
    res.send({ host, port, mountpoint, username, password, active, useTLS })
  })
})

// Serve the cloud info
app.get('/api/cloudinfo', authenticateToken, (req, res) => {
  cloud.getSettings((doBinUpload, binUploadLink, syncDeletions, pubkey) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ doBinUpload, binUploadLink, syncDeletions, pubkey }))
  })
})

// activate or deactivate bin log upload
app.post('/api/binlogupload', authenticateToken, [check('doBinUpload').isBoolean(),
  check('binUploadLink').not().isEmpty().not().contains(';').not().contains('\'').not().contains('"').trim(),
  check('syncDeletions').isBoolean()], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    console.log('Bad POST vars in /api/binlogupload', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  } else {
    cloud.setSettingsBin(req.body.doBinUpload, req.body.binUploadLink, req.body.syncDeletions)
    // send back refreshed settings
    cloud.getSettings((doBinUpload, binUploadLink, syncDeletions) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ doBinUpload, binUploadLink, syncDeletions }))
    })
  }
})

// Serve the logconversion info
app.get('/api/logconversioninfo', authenticateToken, (req, res) => {
  logConversion.getSettings((doLogConversion) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ doLogConversion }))
  })
})

// activate or deactivate logconversion
app.post('/api/logconversion', authenticateToken, [check('doLogConversion').isBoolean()
], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    console.log('Bad POST vars in /api/logconversion', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  } else {
    logConversion.setSettingsLog(req.body.doLogConversion)
    // send back refreshed settings
    logConversion.getSettings((doLogConversion) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ doLogConversion }))
    })
  }
})

// Serve the adhocwifi info
app.get('/api/adhocadapters', authenticateToken, (req, res) => {
  adhocManager.getAdapters((err, netDeviceList, netDeviceSelected, settings) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: netDeviceList, netDeviceSelected, curSettings: settings }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: [], netDeviceSelected: [], cursettings: [], error: err }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/adhocadapters ', { message: err })
    }
  })
})

// activate or deactivate adhoc wifi
app.post('/api/adhocadaptermodify', authenticateToken, [check('settings.isActive').isBoolean(),
  check('toState').isBoolean(),
  check('netDeviceSelected').isAlphanumeric(),
  check('settings.ipaddress').if(check('toState').isIn([true])).isIP(),
  check('settings.wpaType').isIn(['none', 'wep']),
  check('settings.password').if(check('settings.wpaType').isIn(['wep'])).isAlphanumeric(),
  check('settings.ssid').if(check('toState').isIn([true])).isAlphanumeric(),
  check('settings.band').isIn(['a', 'bg']),
  check('settings.channel').if(check('toState').isIn([true])).isInt(),
  check('settings.gateway').optional({ checkFalsy: true }).if(check('toState').isIn([true])).isIP()], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log(req.body)
    console.log('Bad POST vars in /api/adhocadaptermodify', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  } else {
    adhocManager.setAdapter(req.body.toState, req.body.netDeviceSelected, req.body.settings, (err, netDeviceList, netDeviceSelected, settings) => {
      if (!err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { netDevice: netDeviceList, netDeviceSelected, curSettings: settings }
        res.send(JSON.stringify(ret))
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { netDevice: netDeviceList, netDeviceSelected, curSettings: settings, error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/adhocadapters ', { message: err })
      }
    })
  }
})

// change ntrip settings
app.post('/api/ntripmodify', authenticateToken, [check('active').isBoolean(),
  check('host').isLength({ min: 5 }),
  check('port').isPort(),
  check('mountpoint').isLength({ min: 1 }),
  check('username').isLength({ min: 5 }),
  check('password').isLength({ min: 5 }),
  check('useTLS').isBoolean()], function (req, res) {
  // User wants to start/stop NTRIP
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/ntripmodify', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  ntripClient.setSettings(JSON.parse(req.body.host), req.body.port, JSON.parse(req.body.mountpoint), JSON.parse(req.body.username),
                          JSON.parse(req.body.password), req.body.active, req.body.useTLS)
  ntripClient.getSettings((host, port, mountpoint, username, password, active, useTLS) => {
    res.setHeader('Content-Type', 'application/json')
    // console.log(JSON.stringify({host: host,  port: port, mountpoint: mountpoint, username: username, password: password}))
    res.send(JSON.stringify({ host, port, mountpoint, username, password, active, useTLS }))
  })
})

// Serve the AP clients info
app.get('/api/networkclients', authenticateToken, (req, res) => {
  networkClients.getClients((err, apnamev, apclientsv) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: err, apname: apnamev, apclients: apclientsv }))
  })
})

// Serve the logfiles
app.use('/logdownload', express.static(path.join(__dirname, '..', '/flightlogs')))

// Serve the logfiles
app.use('/rplogs', express.static(path.join(__dirname, '..', '/logs')))

app.get('/api/logfiles', authenticateToken, (req, res) => {
  logManager.getLogs((err, tlogs, binlogs, kmzlogs) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ TlogFiles: tlogs, BinlogFiles: binlogs, KMZlogFiles: kmzlogs, url: req.protocol + '://' + req.headers.host }))
  })
})

app.post('/api/deletelogfiles', authenticateToken, [check('logtype').isIn(['tlog', 'binlog', 'kmzlog'])], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/deletelogfiles', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  logManager.clearlogs(req.body.logtype, fcManager.binlog)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({}))
})

app.get('/api/softwareinfo', authenticateToken, (req, res) => {
  aboutPage.getSoftwareInfo((OSV, NodeV, RpanionV, hostname, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ OSVersion: OSV, Nodejsversion: NodeV, rpanionversion: RpanionV, hostname }))
      console.log('/api/softwareinfo OS:' + OSV + ' Node:' + NodeV + ' Rpanion:' + RpanionV + ' Hostname: ' + hostname)
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ OSVersion: err, Nodejsversion: err, rpanionversion: err, hostname: err }))
      console.log('Error in /api/softwareinfo ', { message: err })
    }
  })
})

app.get('/api/videodevices', authenticateToken, (req, res) => {
  vManager.populateAddresses()
  vManager.getVideoDevices((err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDP, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres, useCameraHeartbeat, selMavURI) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({
        ifaces: vManager.ifaces,
        dev: devices,
        vidDeviceSelected: seldevice,
        vidres: vidres,
        vidResSelected: selRes,
        streamingStatus: active,
        streamAddresses: vManager.deviceAddresses,
        rotSelected: selRot,
        bitrate: selbitrate,
        fpsSelected: selfps,
        UDPChecked: SeluseUDP,
        useUDPIP: SeluseUDPIP,
        useUDPPort: SeluseUDPPort,
        timestamp,
        error: null,
        fps: fps,
        FPSMax: FPSMax,
        enableCameraHeartbeat: useCameraHeartbeat,
        mavStreamSelected: selMavURI
      }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ error: err }))
      console.log('Error in /api/videodevices ', { message: err })
    }
  })
})

app.get('/api/hardwareinfo', authenticateToken, (req, res) => {
  aboutPage.getHardwareInfo((RAM, CPU, hatData, sysData, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ CPUName: CPU, RAMName: RAM, HATName: hatData, SYSName: sysData }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ CPUName: err, RAMName: err, HATName: err, SYSName: err }))
      console.log('Error in /api/hardwareinfo ', { message: err })
    }
  })
})

app.get('/api/diskinfo', authenticateToken, (req, res) => {
  aboutPage.getDiskInfo((total, used, percent, err) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ diskSpaceStatus: 'Used ' + used + '/' + total + ' Gb (' + percent + '%)' }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ diskSpaceStatus: err }))
      console.log('Error in /api/diskinfo ', { message: err })
    }
  })
})

app.get('/api/FCOutputs', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: fcManager.getUDPOutputs() }))
})

app.get('/api/FCDetails', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  fcManager.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, active, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest, tlogging) => {
    // hacky way to pass through the
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
        enableHeartbeat,
        enableTCP,
        enableUDPB,
        UDPBPort,
        enableDSRequest,
        tlogging
      }))
    } else {
      console.log(devices)
      res.send(JSON.stringify({
        error: err.toString(),
        telemetryStatus: active,
        serialPorts: devices,
        baudRates: bauds,
        serialPortSelected: seldevice,
        mavVersions: mavers,
        mavVersionSelected: selmav,
        baudRateSelected: selbaud,
        enableHeartbeat,
        enableTCP,
        enableUDPB,
        UDPBPort,
        enableDSRequest,
        tlogging
      }))
      console.log('Error in /api/FCDetails ', { message: err })
    }
  })
})

app.post('/api/shutdowncc', authenticateToken, function () {
  // User wants to shutdown the computer
  aboutPage.shutdownCC()
})

app.post('/api/updatemaster', authenticateToken, function () {
  // User wants to update Rpanion to latest master
  aboutPage.updateRS(io)
})

app.post('/api/FCModify', authenticateToken, [check('device').isJSON(), check('baud').isJSON(), check('mavversion').isJSON(), check('enableHeartbeat').isBoolean(), check('enableTCP').isBoolean(), check('enableUDPB').isBoolean(), check('UDPBPort').isPort(), check('enableDSRequest').isBoolean(), check('tlogging').isBoolean()], function (req, res) {
  // User wants to start/stop FC telemetry
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/FCModify', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  fcManager.startStopTelemetry(JSON.parse(req.body.device), JSON.parse(req.body.baud), JSON.parse(req.body.mavversion), req.body.enableHeartbeat, req.body.enableTCP, req.body.enableUDPB, req.body.UDPBPort, req.body.enableDSRequest, req.body.tlogging, (err, isSuccess) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      // console.log(isSuccess);
      res.send(JSON.stringify({ telemetryStatus: isSuccess, error: null }))
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ telemetryStatus: false, error: err }))
      console.log('Error in /api/FCModify ', { message: err })
    }
  })
})

app.post('/api/FCReboot', authenticateToken, function () {
  fcManager.rebootFC()
})

app.post('/api/addudpoutput', authenticateToken, [check('newoutputIP').isIP(), check('newoutputPort').isInt({ min: 1 })], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/addudpoutput ', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  const newOutput = fcManager.addUDPOutput(req.body.newoutputIP, parseInt(req.body.newoutputPort))

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: newOutput }))
})

app.post('/api/removeudpoutput', authenticateToken, [check('removeoutputIP').isIP(), check('removeoutputPort').isInt({ min: 1 })], function (req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/removeudpoutput ', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  const newOutput = fcManager.removeUDPOutput(req.body.removeoutputIP, parseInt(req.body.removeoutputPort))

  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ UDPoutputs: newOutput }))
})

io.engine.use((req, res, next) => {
  const isHandshake = req._query.sid === undefined
  if (isHandshake) {
    authenticateToken(req, res, next)
  } else {
    next()
  }
})

io.on('connection', function () {
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

app.get('/api/networkadapters', authenticateToken, (req, res) => {
  networkManager.getAdapters((err, netDeviceList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: netDeviceList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netDevice: [] }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/networkadapters ', { message: err })
    }
  })
})

app.get('/api/wifiscan', authenticateToken, (req, res) => {
  networkManager.getWifiScan((err, wifiList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { detWifi: wifiList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { detWifi: [] }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/wifiscan ', { message: err })
    }
  })
})

app.get('/api/wirelessstatus', authenticateToken, (req, res) => {
  networkManager.getWirelessStatus((err, status) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: status }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { wirelessEnabled: true }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/wirelessstatus ', { message: err })
    }
  })
})

app.post('/api/setwirelessstatus', authenticateToken, [check('status').isBoolean()], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/setwirelessstatus ', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
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
      console.log('Error in /api/setwirelessstatus ', { message: err })
    }
  })
})

app.get('/api/networkconnections', authenticateToken, (req, res) => {
  networkManager.getConnections((err, netConnectionList) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnection: netConnectionList }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { netConnection: [] }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/networkconnections ', { message: err })
    }
  })
})

app.post('/api/startstopvideo', authenticateToken, [check('active').isBoolean(),
  check('device').if(check('active').isIn([true])).isLength({ min: 2 }),
  check('height').if(check('active').isIn([true])).isInt({ min: 1 }),
  check('width').if(check('active').isIn([true])).isInt({ min: 1 }),
  check('useUDP').if(check('active').isIn([true])).isBoolean(),
  check('useTimestamp').if(check('active').isIn([true])).isBoolean(),
  check('useCameraHeartbeat').if(check('active').isIn([true])).isBoolean(),
  check('useUDPPort').if(check('active').isIn([true])).isPort(),
  check('useUDPIP').if(check('active').isIn([true])).isIP(),
  check('bitrate').if(check('active').isIn([true])).isInt({ min: 50, max: 50000 }),
  check('format').if(check('active').isIn([true])).isIn(['video/x-raw', 'video/x-h264', 'image/jpeg']),
  check('fps').if(check('active').isIn([true])).isInt({ min: -1, max: 100 }),
  check('rotation').if(check('active').isIn([true])).isInt().isIn([0, 90, 180, 270])],
  check('compression').if(check('active').isIn([true])).isIn(['H264', 'H265']), (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/startstopvideo ', { message: errors.array() })
    const ret = { streamingStatus: false, streamAddresses: [], error: ['Error ' + JSON.stringify(errors.array())] }
    return res.status(422).json(ret)
  }
  // user wants to start/stop video streaming
  vManager.startStopStreaming(req.body.active, req.body.device, req.body.height, req.body.width, req.body.format, req.body.rotation,
                              req.body.bitrate, req.body.fps, req.body.useUDP, req.body.useUDPIP, req.body.useUDPPort,
                              req.body.useTimestamp, req.body.useCameraHeartbeat, req.body.mavStreamSelected, req.body.compression, (err, status, addresses) => {
    if (!err) {
      res.setHeader('Content-Type', 'application/json')
      const ret = { streamingStatus: status, streamAddresses: addresses }
      res.send(JSON.stringify(ret))
    } else {
      res.setHeader('Content-Type', 'application/json')
      const ret = { streamingStatus: false, streamAddresses: ['Error ' + err] }
      res.send(JSON.stringify(ret))
      console.log('Error in /api/startstopvideo ', { message: err })
    }
  })
})

// Get details of a network connection by connection ID
app.post('/api/networkIP', authenticateToken, [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/networkIP ', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
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
      console.log('Error in /api/networkIP ', { message: err })
    }
  })
})

// user wants to activate network
app.post('/api/networkactivate', authenticateToken, [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    console.log('Bad POST vars in /api/networkactivate ', { message: errors.array() })
  } else {
    console.log('Activating network ' + req.body.conName)
    networkManager.activateConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/networkactivate ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkActivateOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to deactivate network
app.post('/api/networkdeactivate', authenticateToken, [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    console.log('Bad POST vars in /api/networkdeactivate ', { message: errors.array() })
  } else {
    console.log('Dectivating network ' + req.body.conName)
    networkManager.deactivateConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/networkdeactivate ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkDectivateOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to delete network
app.post('/api/networkdelete', authenticateToken, [check('conName').isUUID()], (req, res) => {
  // Finds the validation errors in this request and wraps them in an object with handy functions
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'application/json')
    const ret = { error: 'Bad input - ' + errors.array()[0].param }
    res.send(JSON.stringify(ret))
    console.log('Bad POST vars in /api/networkdelete ', { message: errors.array() })
  } else {
    console.log('Deleting network ' + req.body.conName)
    networkManager.deleteConnection(req.body.conName, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/networkdelete ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkDeleteOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// user wants to edit network
app.post('/api/networkedit', authenticateToken, [check('conName').isUUID(),
  check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress.value').optional().isIP(),
  check('conSettings.subnet.value').optional().isIP(),
  check('conSettings.wpaType.value').optional().isIn(['none', 'wpa-psk']),
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
    console.log('Bad POST vars in /api/networkedit ', { message: errors.array() })
  } else {
    console.log('Editing network ' + req.body.conName)
    networkManager.editConnection(req.body.conName, req.body.conSettings, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/networkedit ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkEditOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
})

// User wants to add network
app.post('/api/networkadd', authenticateToken, [check('conSettings.ipaddresstype.value').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress.value').optional().isIP(),
  check('conSettings.subnet.value').optional().isIP(),
  check('conSettings.wpaType.value').optional().isIn(['none', 'wpa-psk']),
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
    console.log('Bad POST vars in /api/networkadd ', { message: errors.array() })
  } else {
    console.log('Adding network ' + req.body)
    networkManager.addConnection(req.body.conName, req.body.conType, req.body.conAdapter, req.body.conSettings, (err) => {
      if (err) {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: err }
        res.send(JSON.stringify(ret))
        console.log('Error in /api/networkadd ', { message: err })
      } else {
        res.setHeader('Content-Type', 'application/json')
        const ret = { error: null, action: 'NetworkAddOK' }
        res.send(JSON.stringify(ret))
      }
    })
  }
  console.log(req.body)
})

module.exports = app;

// Only start the server if this file is being run directly (not imported)
if (require.main === module) {
  const port = process.env.PORT || 3001;
  http.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
