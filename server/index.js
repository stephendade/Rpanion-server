const express = require('express')
const fileUpload = require('express-fileupload')
const compression = require('compression')
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
const logpaths = require('./paths.js')

const settings = require('settings-store')

const app = express()
const http = require('http').Server(app)
const path = require('path')
const os = require('os')
const appRoot = require('app-root-path')  // for resolving relative paths

// MEDIA_ROOT is the default storage area used by the Python helpers.
// For security, user-provided paths are required to live within it.
const MEDIA_ROOT = logpaths.mediaDir; // absolute path to rpanion-server/media


const io = require('socket.io')(http, { cookie: false })
const { check, validationResult } = require('express-validator')
const crypto = require('crypto');

// set up rate limiter: maximum of fifty requests per minute
const RateLimit = require('express-rate-limit')
const pppConnection = require('./pppConnection.js')
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
app.use(fileUpload({ limits: { fileSize: 1000 }, abortOnLimit: true, useTempFiles: true, tempFileDir: '/tmp/', safeFileNames: true, preserveExtension: 4 }))

// Init settings before running the other classes
settings.init({
  appName: 'Rpanion-server', // required,
  reverseDNS: 'com.server.rpanion', // required for macOS
  filename: logpaths.settingsFile
})

const vManager = new videoStream(settings)
const fcManager = new fcManagerClass(settings)
const logManager = new flightLogger()
const ntripClient = new ntrip(settings)
const cloud = new cloudManager(settings)
const logConversion = new logConversionManager(settings)
const adhocManager = new Adhoc(settings)
const userMgmt = new userLogin()
const pppConnectionManager = new pppConnection(settings)

// Graceful shutdown implementation
let isShuttingDown = false
const SHUTDOWN_TIMEOUT = 10000 // 10 seconds

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return
  }
  
  isShuttingDown = true
  console.log(`Received ${signal}. Shutting down gracefully...`)
  
  // Set a timeout to force shutdown if graceful shutdown takes too long
  const forceShutdownTimer = setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing shutdown...')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT)
  
  try {
    // Stop accepting new connections
    if (http && http.listening) {
      console.log('Closing HTTP server...')
      console.log(`Waiting for ${activeConnections.size} active connections to finish...`)
      
      await new Promise((resolve, reject) => {
        http.close((err) => {
          if (err) {
            console.error('Error closing HTTP server:', err)
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
    
    // Stop Socket.IO connections
    if (io) {
      console.log('Closing Socket.IO connections...')
      io.close()
      console.log('Socket.IO closed')
    }
    
    // Clear intervals
    if (FCStatusLoop) {
      clearInterval(FCStatusLoop)
      FCStatusLoop = null
      console.log('Status loop cleared')
    }
    
    // Stop all managed services
    console.log('Stopping managed services...')

    // Stop camera processes cleanly
    if (vManager) {
      vManager.stopCamera();
      console.log('Camera processes stopped');
    }

    pppConnectionManager.quitting()
    cloud.quitting()
    logConversion.quitting()
    console.log('All services stopped')
    
    clearTimeout(forceShutdownTimer)
    console.log('---Shutdown Rpanion Complete---')
    process.exit(exitCode)
  } catch (err) {
    console.error('Error during graceful shutdown:', err)
    clearTimeout(forceShutdownTimer)
    process.exit(1)
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT', 0)
})

// Handle SIGTERM (systemd stop)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM', 0)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  gracefulShutdown('uncaughtException', 1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
  gracefulShutdown('unhandledRejection', 1)
})

// Handle nodemon restarts (SIGUSR2)
process.once('SIGUSR2', () => {
  console.log('Received SIGUSR2. Shutting down gracefully...')
  gracefulShutdown('SIGUSR2', 0).then(() => {
    process.kill(process.pid, 'SIGUSR2')
  })
})

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


// Capture a single still photo when in photo mode
// This code responds to the button on the web interface
app.post('/api/capturestillphoto', authenticateToken, function (req, res) {
  if (vManager.active && vManager.cameraMode === 'photo') {
    console.log("[API /api/capturestillphoto] Conditions met. Calling vManager.captureStillPhoto()");
    const currentPosition = fcManager.getSystemStatus().vehiclePosition;
    
    // Call without MAVLink sender/target info as it's a UI trigger
    vManager.captureStillPhoto(null, null, null, currentPosition);
    res.status(200).send({ message: 'Capture signal sent.' });
  } else {
    console.log("[API /api/capturestillphoto] Conditions NOT met. Sending 400.");
    res.status(400).send({ error: 'Camera not active or not in photo mode.' });
  }
})

// Toggle local video recording on/off
// This code responds to the button on the web interface
app.post('/api/togglevideorecording', authenticateToken, function (req, res) {
  console.log(`[API /togglevideorecording] Received request. Server state: vManager.active=${vManager.active}, vManager.cameraMode=${vManager.cameraMode}`);

  // Check if active and in the correct mode
  if (vManager.active && vManager.cameraMode === 'video') {
    try {
      vManager.toggleVideoRecording(); // Use the new method name
      console.log('Toggled video recording via API.');
      res.status(200).send({ success: true, message: 'Toggle signal sent.' });
    } catch (err) {
      console.log('Error toggling video recording:', err);
      res.status(500).send({ error: 'Failed to send toggle signal.' });
    }
  } else {
    console.log(`[API /togglevideorecording] Condition NOT met (active=${vManager.active}, mode=${vManager.cameraMode}). Sending 400.`);
    res.status(400).send({ error: 'Camera is not active in video recording mode.' });
  }
})

// This function responds to a MAVLink command to capture a photo.
vManager.eventEmitter.on('digicamcontrol', (senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      // Acknowledge the MAV_CMD_DO_DIGICAM_CONTROL command
      fcManager.m.sendCommandAck(203, 0, senderSysId, senderCompId, targetComponent)
    }
  } catch (err) {
    console.log('Error acknowledging DoDigicamControl:', err);
  }
})

// Got a camera heartbeat event, send to flight controller
vManager.eventEmitter.on('cameraheartbeat', (mavType, autopilot, component) => {
  try {
    if (fcManager.m) {
      fcManager.m.sendHeartbeat(mavType, autopilot, component)
    }
  } catch (err) {
    console.log('Error sending camera heartbeat:', err);
  }
})

// Got a CAMERA_INFORMATION event, send to flight controller
vManager.eventEmitter.on('camerainfo', (msg, senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      // Acknowledge the CAMERA_INFORMATION request
      fcManager.m.sendCommandAck(common.CameraInformation.MSG_ID, 0, senderSysId, senderCompId, targetComponent)
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log('Error sending CameraInformation:', err);
  }
})

// Got a VIDEO_STREAM_INFORMATION event, send to flight controller
vManager.eventEmitter.on('videostreaminfo', (msg, senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      // Acknowledge the VIDEO_STREAM_INFORMATION request
      fcManager.m.sendCommandAck(common.VideoStreamInformation.MSG_ID, 0, senderSysId, senderCompId, targetComponent)
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log('Error sending VideoStreamInformation:', err);
  }
})

// Got a CAMERA_SETTINGS event, send to flight controller
vManager.eventEmitter.on('camerasettings', (msg, senderSysId, senderCompId, targetComponent) => {
  try {
    if (fcManager.m) {
      // Acknowledge the CAMERA_SETTINGS request
      fcManager.m.sendCommandAck(common.CameraSettings.MSG_ID, 0, senderSysId, senderCompId, targetComponent)
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log('Error sending CameraSettings:', err);
    // console.log(err)
  }
})

// Got a CAMERA_TRIGGER event, send to flight controller
vManager.eventEmitter.on('cameratrigger', (msg, senderCompId) => {
  try {
    if (fcManager.m) {
      // Send the CAMERA_TRIGGER message to the flight controller
      fcManager.m.sendData(msg, senderCompId)
    }
  } catch (err) {
    console.log('Error sending CameraTrigger:', err);
  }
})

vManager.eventEmitter.on('filesaved', (filepath) => {
  try {
    io.sockets.emit('camera:filesaved', { filename: filepath });
    console.log('Pushed filesaved to clients:', filepath);
  } catch (e) {
    console.error('Failed to emit filesaved:', e);
  }
});

// Connecting the flight controller datastream to the logger
// and ntrip and video
fcManager.eventEmitter.on('gotMessage', (packet, data) => {
  try {
    ntripClient.onMavPacket(packet, data)
    vManager.onMavPacket(packet, data)
  } catch (err) {
    console.log('Error processing MAVLink message in listener:', err);
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

app.use(express.urlencoded({ extended: true }))
app.use(pino)

// Simply pass `compression` as an Express middleware!
app.use(compression())
app.use(express.json())

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
  // Skip authentication in development mode
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Determine if this is a Socket.IO request
  const isSocketIO = typeof res.status !== 'function'
  
  // Helper function to send error responses
  const sendError = (statusCode, message) => {
    if (isSocketIO) {
      return next(new Error(message))
    }
    return res.status(statusCode).json({ message })
  }

  // Extract token
  let token;
  try {
    const authHeader = req.headers['authorization']
    token = authHeader && authHeader.split(' ')[1]
  } catch (err) {
    return sendError(401, 'Access denied. No token provided.')
  }

  if (!token) {
    return sendError(401, 'Access denied. No token provided.')
  }

  // Check if the token is blacklisted
  if (tokenBlacklist.includes(token)) {
    return sendError(401, 'Invalid token')
  }

  // Verify token
  jwt.verify(token, RPANION_SECRET_KEY, (err, user) => {
    if (err) {
      return sendError(403, 'Invalid token')
    }
    req.user = user
    next()
  })
}

//pppConnectionManager url endpoints
app.get('/api/pppconfig', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  pppConnectionManager.getPPPSettings((err, settings) => {  
    if (err) {
      console.log('Error in /api/pppconfig', { message: err })
      res.send(JSON.stringify({ error: err }))
      return
    }
    res.send(JSON.stringify(settings))
  })
})

app.post('/api/pppmodify', authenticateToken, [
  check('device').not().isEmpty(),
  check('baudrate').isInt(), 
  check('localIP').isIP(),
  check('remoteIP').isIP(),
  check('enabled').isBoolean()
], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/pppmodify', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  if (req.body.enabled === true) {
    console.log('Starting PPP connection');
    res.setHeader('Content-Type', 'application/json')
    pppConnectionManager.startPPP(req.body.device, req.body.baudrate, req.body.localIP, req.body.remoteIP, (err, settings) => {
      if (err !== null) {
        console.log('Error in /api/pppmodify', { message: err })
        console.log(JSON.stringify({settings, error: err }))
        res.send(JSON.stringify({settings, error: err.toString() }))
        return
      } else {
        res.send(JSON.stringify({settings}))
        return
      }
    })
  }
  else if (req.body.enabled === false) {
    pppConnectionManager.stopPPP((err, settings) => {
      if (err) {
        //console.log('Error in /api/pppmodify', { message: err })
        console.log(JSON.stringify({settings, error: err }))
        res.send(JSON.stringify({settings, error: err }))
        return
      } else {
        res.send(JSON.stringify({settings}))
        return
      }
    })
  }
})

// Serve the logfile
app.get('/api/logfile', authenticateToken, (req, res) => {
  aboutPage.getsystemctllog((logStr) => {
    console.log(logStr)
    res.setHeader('Content-Disposition', 'attachment; filename="rpanion.log"')
    res.setHeader('Content-Type', 'text/plain')
    res.send(logStr)
  })
})

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
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ error: 'Bad wireguard profile' }))
  }

  VPNManager.addWireguardProfile(req.files.wgprofile.name, req.files.wgprofile.tempFilePath, (err) => {
    if (err) {
      console.log('Error in /api/vpnwireguardprofileadd', { message: err })
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify({ error: err }))
    } else {
      // get refreshed status
      VPNManager.getVPNStatusWireguard(null, (stderr, statusJSON) => {
        res.setHeader('Content-Type', 'application/json')
        res.send(JSON.stringify({ error: stderr, statusWireguard: statusJSON }))
      })
    }
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
app.use('/logdownload', express.static(logpaths.flightsLogsDir))

app.get('/api/logfiles', authenticateToken, (req, res) => {
  logManager.getLogs((err, tlogs, binlogs, kmzlogs, media) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ TlogFiles: tlogs, BinlogFiles: binlogs, KMZlogFiles: kmzlogs, MediaFiles: media, url: req.protocol + '://' + req.headers.host }))
  })
})

app.post('/api/deletelogfiles', authenticateToken, [check('logtype').isIn(['tlog', 'binlog', 'kmzlog', 'media'])], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/deletelogfiles', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  logManager.clearlogs(req.body.logtype, fcManager.binlog)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({}))
})

app.get('/api/approot', authenticateToken, (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify({ appRoot: appRoot.toString() }))
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

  vManager.getVideoDevices((err, responseData) => {
    res.setHeader('Content-Type', 'application/json');
    if (err) {
      console.error('Error getting video devices /api/videodevices:', err);
      // Determine appropriate status code and send minimal fallback data
      const status = (err === 'No video devices found') ? 404 : 500;
      return res.status(status).json({
        error: `Failed to get video devices: ${err}`,
        active: vManager.active,
        cameraMode: vManager.cameraMode,
        networkInterfaces: vManager.scanInterfaces()
      });
    }
    // Send the whole responseData object directly
    res.send(JSON.stringify(responseData));
  });
});

// GET Still Camera Device information
app.get('/api/camera/still_devices', authenticateToken, (req, res) => {
  vManager.getStillDevices((err, stillData) => {
    res.setHeader('Content-Type', 'application/json');
    if (err) {
      console.error('Error getting still devices:', err);
      return res.status(500).json({
        error: `Failed to get still camera devices: ${err}`,
        devices: []
      });
    }

    // stillData contains { devices, selectedDevice, selectedCap }
    res.send(JSON.stringify({
      ...stillData,
      error: null
    }));
  });
});

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
  fcManager.getDeviceSettings((err, devices, bauds, seldevice, selbaud, mavers, selmav,
    active, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest, doLogging,
    udpInputPort, selInputType, inputTypes) => {
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
        doLogging,
        udpInputPort,
        selInputType,
        inputTypes
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
        doLogging,
        udpInputPort,
        selInputType,
        inputTypes
      }))
      console.log('Error in /api/FCDetails ', { message: err })
    }
  })
})

app.post('/api/shutdowncc', authenticateToken, function () {
  // User wants to shutdown the computer
  aboutPage.shutdownCC()
})

app.post('/api/resetsettings', authenticateToken, function (req, res) {
  // User wants to reset all settings to defaults
  try {
    const fs = require('fs')
    const settingsPath = logpaths.settingsFile
    
    // Delete the settings file
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath)
      console.log('Settings file deleted:', settingsPath)
    }
    
    // Create empty settings object
    fs.writeFileSync(settingsPath, '{}')
    console.log('Settings reset to defaults')
    
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ success: true, message: 'Settings have been reset. Please restart the application for changes to take effect.' }))
  } catch (error) {
    console.error('Error resetting settings:', error)
    res.status(500).send(JSON.stringify({ error: 'Failed to reset settings: ' + error.message }))
  }
})

app.post('/api/FCModify', authenticateToken, [check('device'), check('baud').isInt(), check('mavversion').isInt(), check('enableHeartbeat').isBoolean(), check('enableTCP').isBoolean(), check('enableUDPB').isBoolean(), check('UDPBPort').isPort(), check('enableDSRequest').isBoolean(), check('doLogging').isBoolean()], function (req, res) {
  // User wants to start/stop FC telemetry
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('Bad POST vars in /api/FCModify', { message: JSON.stringify(errors.array()) })
    return res.status(422).json({ error: JSON.stringify(errors.array()) })
  }

  fcManager.startStopTelemetry(req.body.device, req.body.baud, req.body.mavversion, req.body.enableHeartbeat,
                               req.body.enableTCP, req.body.enableUDPB, req.body.UDPBPort, req.body.enableDSRequest,
                               req.body.doLogging, req.body.inputType, req.body.udpInputPort, (err, isSuccess) => {
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
    io.sockets.emit('PPPStatus', pppConnectionManager.conStatusStr())
    io.sockets.emit('VideoStreamStatus', vManager.getStreamingStatus())
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

// POST to START a specific camera mode (streaming, photo, video)
app.post('/api/camera/start', authenticateToken, [
  check('cameraMode').isIn(['streaming', 'photo', 'video']),
  check('useCameraHeartbeat').isBoolean(),
  // Validation for modes that use a video pipeline ('streaming' or 'video')
  check('videoDevice').if(check('cameraMode').isIn(['streaming', 'video'])).isString().notEmpty(),
  check('height').if(check('cameraMode').isIn(['streaming', 'video'])).isInt({ min: 1 }),
  check('width').if(check('cameraMode').isIn(['streaming', 'video'])).isInt({ min: 1 }),
  check('bitrate').if(check('cameraMode').isIn(['streaming', 'video'])).isInt({ min: 50, max: 50000 }),
  check('fps').if(check('cameraMode').isIn(['streaming', 'video'])).isInt({ min: 0, max: 120 }),
  check('rotation').if(check('cameraMode').isIn(['streaming', 'video'])).isInt().isIn([0, 90, 180, 270]),
  // Validation ONLY for 'photo' mode
  check('stillDevice').if(check('cameraMode').equals('photo')).isString().notEmpty(),
  check('stillWidth').if(check('cameraMode').equals('photo')).isInt({ min: 1 }),
  check('stillHeight').if(check('cameraMode').equals('photo')).isInt({ min: 1 }),
  // Media destination for photo and video modes (optional, but validate if provided)
  check('mediaDestination')
    .if(check('cameraMode').isIn(['photo', 'video']))
    .optional({ checkFalsy: true }) // Allow blank inputs (to save to MEDIA_ROOT without a subdir)
    .isString()
    .trim()
    .customSanitizer(dest => {
      // For ease of use:
      // If the user pasted the full absolute media path, strip it down to just the folder name
      if (dest.startsWith(MEDIA_ROOT)) {
        dest = dest.slice(MEDIA_ROOT.length);
      }
      // Also for ease of use:
      // Strip leading slashes so that if an absolute path is entered
      // by mistake, it's converted to a relative path instead of being rejected
      return dest.replace(/^[\/\\]+/, '');
    })
      // Check for path traversal attemptsa and null characters
    .custom(dest => {
      if (dest.includes('\0')) {
        throw new Error('Media Destination contains invalid characters');
      }
      if (dest.includes('..')) {
        throw new Error('Directory traversal is not allowed');
      }
      // Final check that an absolute path didn't make it through the sanitizer
      if (path.isAbsolute(dest)) {
        throw new Error('Media Destination must be a relativefolder name, not an absolute path');
      }
      return true;
    })
], (req, res) => {
  console.log("--- Received /api/camera/start request ---");
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
 console.error('Validation failed for /api/camera/start:', errors.array());
    return res.status(422).json({ error: 'Invalid media destination', details: errors.array() });
  }

  const mode = req.body.cameraMode;
  vManager.cameraMode = mode;
  vManager.useCameraHeartbeat = req.body.useCameraHeartbeat;

// Sanitize the user-provided media destination
  let safeMediaDestination = null;
    if (req.body.mediaDestination) {

      // Force the input into a string format
      const userInput = String(req.body.mediaDestination);

      // Explicitly check for traversal strings inline
      if (userInput.includes('..') || userInput.includes('\0')) {
        return res.status(403).json({ error: 'Path traversal characters detected' });
      }

      const targetPath = path.join(MEDIA_ROOT, userInput);

      const relative = path.relative(MEDIA_ROOT, targetPath);
      // Double-check strict path boundaries to prevent any evasion
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return res.status(403).json({ error: 'Invalid media destination path boundaries' });
      }

      safeMediaDestination = targetPath;
      
    }

  // Map incoming request to the internal settings objects used by videostream.js
  if (mode === 'streaming' || mode === 'video') {
    vManager.videoSettings = {
      device: req.body.videoDevice,
      isRecording: req.body.isRecording === false || req.body.isRecording === 'false',
      height: parseInt(req.body.height, 10),
      width: parseInt(req.body.width, 10),
      format: req.body.format,
      bitrate: parseInt(req.body.bitrate, 10),
      fps: parseInt(req.body.fps, 10),
      rotation: parseInt(req.body.rotation, 10),
      useUDP: req.body.useUDP === true || req.body.useUDP === 'true',
      useUDPIP: req.body.useUDPIP,
      useUDPPort: parseInt(req.body.useUDPPort, 10),
      useTimestamp: req.body.useTimestamp === true || req.body.useTimestamp === 'true',
      mavStreamSelected: req.body.mavStreamSelected,
      compression: req.body.compression,
      mediaDestination: safeMediaDestination
    };
    vManager.stillSettings = null;
  } else if (mode === 'photo') {
    vManager.stillSettings = {
      device: req.body.stillDevice,
      width: parseInt(req.body.stillWidth, 10),
      height: parseInt(req.body.stillHeight, 10),
      format: req.body.stillFormat,
      mediaDestination: safeMediaDestination
    };
    vManager.videoSettings = null;
  }

  vManager.startCamera((err, result) => {
    res.setHeader('Content-Type', 'application/json');
    if (err) {
      // Use %s for the mode variable so it is treated as data, not a format string
      console.error(`Error starting camera in %s mode:`, mode, err);
      return res.status(500).json({ error: err.message || err });
    }
    res.send(JSON.stringify({ ...result, error: null }));
  });
});

// POST to STOP the currently active camera mode
app.post('/api/camera/stop', authenticateToken, (req, res) => {
  vManager.stopCamera((err, active) => {
    res.setHeader('Content-Type', 'application/json');
    if (err) {
      console.error('Error stopping camera:', err);
      return res.status(500).json({ error: 'Failed to stop camera cleanly' });
    }
    res.send(JSON.stringify({ active: active, error: null }));
  });
});

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
  check('conSettings.ipaddresstype').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress').optional().isIP(),
  check('conSettings.subnet').optional().isIP(),
  check('conSettings.wpaType').optional().isIn(['none', 'wpa-psk']),
  check('conSettings.password').optional().escape(),
  check('conSettings.ssid').optional().escape(),
  check('conSettings.attachedIface').optional().escape(),
  check('conSettings.band').optional().isIn(['a', 'bg']),
  check('conSettings.channel').optional().isInt(),
  check('conSettings.mode').optional().isIn(['infrastructure', 'ap'])
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
app.post('/api/networkadd', authenticateToken, [check('conSettings.ipaddresstype').isIn(['auto', 'manual', 'shared']),
  check('conSettings.ipaddress').optional().isIP(),
  check('conSettings.subnet').optional().isIP(),
  check('conSettings.wpaType').optional().isIn(['none', 'wpa-psk']),
  check('conSettings.password').optional().escape(),
  check('conSettings.ssid').optional().escape(),
  check('conSettings.band').optional().isIn(['a', 'bg']),
  check('conSettings.channel').optional().isInt(),
  check('conSettings.attachedIface').optional().escape(),
  check('conSettings.mode').optional().isIn(['infrastructure', 'ap']),
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

// Pass GUI requests to the React app only in production mode
if (process.env.NODE_ENV !== 'development')
{
  app.get(['/', '/controller', '/about', '/network',
          '/video', '/vpn', '/ntrip', '/cloud', '/flightlogs',
          '/apclients', '/adhoc', '/logoutconfirm', '/users', '/ppp'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', '/build/index.html'))
  })
}

// Track active connections for graceful shutdown
const activeConnections = new Set()

// Add connection tracking middleware
app.use((req, res, next) => {
  // Return 503 if shutting down
  if (isShuttingDown) {
    res.set('Connection', 'close')
    return res.status(503).json({ error: 'Server is shutting down' })
  }
  
  // Track this connection
  activeConnections.add(res)
  
  // Remove when done
  res.on('finish', () => {
    activeConnections.delete(res)
  })
  
  res.on('close', () => {
    activeConnections.delete(res)
  })
  
  next()
})

module.exports = app;

// Only start the server if this file is being run directly (not imported)
if (require.main === module) {
  const port = process.env.PORT || 3001;
  http.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log('Press Ctrl+C to stop');
  });
}

