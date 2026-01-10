const fs = require('fs')
const events = require('events')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const mavManager = require('../mavlink/mavManager.js')
const logpaths = require('./paths.js')
const { detectSerialDevices, isModemManagerInstalled, isPi, getSerialPathFromValue } = require('./serialDetection.js')

class FCDetails {
  constructor (settings) {
    // if the device was successfully opend and got packets
    this.previousConnection = false

    // all detected serial ports and baud rates
    this.serialDevices = []
    this.baudRates = [{ value: 9600, label: '9600' },
      { value: 19200, label: '19200' },
      { value: 38400, label: '38400' },
      { value: 57600, label: '57600' },
      { value: 111100, label: '111100' },
      { value: 115200, label: '115200' },
      { value: 230400, label: '230400' },
      { value: 256000, label: '256000' },
      { value: 460800, label: '460800' },
      { value: 500000, label: '500000' },
      { value: 921600, label: '921600' },
      { value: 1500000, label: '1500000' }]
    this.mavlinkVersions = [{ value: 1, label: '1.0' },
      { value: 2, label: '2.0' }]
    this.inputTypes = [{ value: 'UART', label: 'UART' },
      { value: 'UDP', label: 'UDP Server' }]
    // JSON of active device (input type, port and baud and mavversion). User selected
    // null if user selected no link (or no serial port of that name)
    this.activeDevice = null

    // mavlink-router process
    this.router = null

    // the mavlink manager object
    this.m = null

    // For sending events outside of object
    this.eventEmitter = new events.EventEmitter()

    // Interval to check connection status and re-connect
    // if required
    this.intervalObj = null

    // UDP Outputs
    this.UDPoutputs = []

    // Send out MAVLink heartbeat packets?
    this.enableHeartbeat = false
  
    // Use TCP output?
    this.enableTCP = false

    // Use UDP Broadcast?
    this.enableUDPB = true
    this.UDPBPort = 14550

    // Send datastream requests to flight controller?
    this.enableDSRequest = false

    // Current binlog via mavlink-router
    this.binlog = null

    this.doLogging = false

    // DataFlash logger process
    this.dflogger = null

    // Is the connection active?
    this.active = false

    // mavlink-routerd path
    this.mavlinkRouterPath = null

    // load settings
    this.settings = settings
    this.activeDevice = this.settings.value('flightcontroller.activeDevice', null)
    this.UDPoutputs = this.settings.value('flightcontroller.outputs', [])
    this.enableHeartbeat = this.settings.value('flightcontroller.enableHeartbeat', false)
    this.enableTCP = this.settings.value('flightcontroller.enableTCP', false)
    this.enableUDPB = this.settings.value('flightcontroller.enableUDPB', true)
    this.UDPBPort = this.settings.value('flightcontroller.UDPBPort', 14550)
    this.enableDSRequest = this.settings.value('flightcontroller.enableDSRequest', false)
    this.doLogging = this.settings.value('flightcontroller.doLogging', false)
    this.active = this.settings.value('flightcontroller.active', false)

    if (this.active) {
      // restart link if saved serial device is found
      this.getDeviceSettings((err, devices) => {
        if (this.activeDevice.inputType === 'UART') {
          let found = false
          for (let i = 0, len = devices.length; i < len; i++) {
            if (this.activeDevice.serial === devices[i].value) {
              found = true
              this.startLink((err) => {
                if (err) {
                  console.log("Can't open found FC " + this.activeDevice.serial + ', resetting link')
                  this.activeDevice = null
                  this.active = false
                }
                this.startInterval()
              })
              break
            }
          }
          if (!found) {
            console.log("Can't open saved connection, resetting")
            this.activeDevice = null
            this.active = false
          }
        } else if (this.activeDevice.inputType === 'UDP') {
          this.startLink((err) => {
            if (err) {
              console.log("Can't open UDP port " + this.activeDevice.udpInputPort + ', resetting link')
              this.activeDevice = null
              this.active = false
            }
            this.startInterval()
          })
        }
      })
    }
  }

  validMavlinkRouter () {
    // check mavlink-router is installed and updates folder
    const ls = spawnSync('which', ['mavlink-routerd'])
    console.log(ls.stdout.toString())
    if (ls.stdout.toString().trim() == '') {
      // also check the parent directory
      const parentDir = path.dirname(__dirname)
      const mavlinkRouterPath = path.join(parentDir, 'mavlink-routerd')
      if (fs.existsSync(mavlinkRouterPath)) {
        console.log('Found mavlink-routerd in ' + parentDir)
        this.mavlinkRouterPath = parentDir + "/mavlink-routerd"
        return true
      }
      this.mavlinkRouterPath = null
      return false
    } else {
      console.log('Found mavlink-routerd in ' + ls.stdout.toString().trim())
      this.mavlinkRouterPath = ls.stdout.toString().trim()
      return true
    }
  }



  getUDPOutputs () {
    // get list of current UDP outputs
    const ret = []
    for (let i = 0, len = this.UDPoutputs.length; i < len; i++) {
      ret.push({ IPPort: this.UDPoutputs[i].IP + ':' + this.UDPoutputs[i].port })
    }
    return ret
  }

  addUDPOutput (newIP, newPort) {
    // add a new udp output, if not already in
    // check if this ip:port is already in the list
    for (let i = 0, len = this.UDPoutputs.length; i < len; i++) {
      if (this.UDPoutputs[i].IP === newIP && this.UDPoutputs[i].port === newPort) {
        return this.getUDPOutputs()
      }
    }

    // check that it's not the internal 127.0.0.1:14540
    if (newIP === '127.0.0.1' && newPort === 14540) {
      return this.getUDPOutputs()
    }

    // add it in
    this.UDPoutputs.push({ IP: newIP, port: newPort })
    console.log('Added UDP Output ' + newIP + ':' + newPort)

    // restart mavlink-router, if link active
    if (this.m) {
      this.closeLink(() => {
        this.startLink((err) => {
          if (err) {
            console.log(err)
          }
        })
      })
    }

    // try to save. Will be invalid if running under test runner
    try {
      this.saveSerialSettings()
    } catch (e) {
      console.log(e)
    }

    return this.getUDPOutputs()
  }

  removeUDPOutput (remIP, remPort) {
    // remove new udp output

    // check that it's not the internal 127.0.0.1:14540
    if (remIP === '127.0.0.1' && remPort === 14540) {
      return this.getUDPOutputs()
    }

    // check if this ip:port is already in the list
    for (let i = 0, len = this.UDPoutputs.length; i < len; i++) {
      if (this.UDPoutputs[i].IP === remIP && this.UDPoutputs[i].port === remPort) {
        // and remove
        this.UDPoutputs.splice(i, 1)
        console.log('Removed UDP Output ' + remIP + ':' + remPort)

        // restart mavlink-router, if link active
        if (this.m) {
          this.closeLink(() => {
            this.startLink((err) => {
              if (err) {
                console.log(err)
              }
            })
          })
        }

        // try to save. Will be invalid if running under test runner
        try {
          this.saveSerialSettings()
        } catch (e) {
          console.log(e)
        }

        return this.getUDPOutputs()
      }
    }

    return this.getUDPOutputs()
  }

  getSystemStatus () {
    // get the system status
    if (this.m !== null) {
      return {
        numpackets: this.m.statusNumRxPackets,
        FW: this.m.autopilotFromID(),
        vehType: this.m.vehicleFromID(),
        conStatus: this.m.conStatusStr(),
        statusText: this.m.statusText,
        byteRate: this.m.statusBytesPerSec.avgBytesSec,
        fcVersion: this.m.fcVersion
      }
    } else {
      return {
        numpackets: 0,
        FW: '',
        vehType: '',
        conStatus: 'Not connected',
        statusText: '',
        byteRate: 0,
        fcVersion: ''
      }
    }
  }

  rebootFC () {
    // command the flight controller to reboot
    if (this.m !== null) {
      console.log('Rebooting FC')
      this.m.sendReboot()
    }
  }

  startBinLogging () {
    // command the flight controller to start streaming bin log
    if (this.m !== null) {
      console.log('Bin log start request')
      this.m.sendBinStreamRequest()
    }
  }

  stopBinLogging () {
    // command the flight controller to stop streaming bin log
    if (this.m !== null) {
      console.log('Bin log stop request')
      this.m.sendBinStreamRequestStop()
    }
  }

  startDFLogger () {
    // Start the dataflash logger Python process
    if (this.dflogger !== null) {
      console.log('DFLogger already running')
      return
    }

    console.log('Starting DataFlash logger')
    const pythonPath = logpaths.getPythonPath()
    const dfloggerPath = path.join(__dirname, '..', 'python', 'dflogger.py')
    
    this.dflogger = spawn(pythonPath, [
      dfloggerPath,
      '--connection', 'udp:127.0.0.1:14541',
      '--logdir', logpaths.flightsLogsDir,
      '--rotate-on-disarm'
    ])

    this.dflogger.stdout.on('data', (data) => {
      console.log(`DFLogger: ${data}`)
    })

    this.dflogger.stderr.on('data', (data) => {
      console.error(`DFLogger stderr: ${data}`)
    })

    this.dflogger.on('close', (code) => {
      console.log(`DFLogger exited with code ${code}`)
      this.dflogger = null
    })
  }

  stopDFLogger () {
    // Stop the dataflash logger Python process
    if (this.dflogger === null) {
      console.log('DFLogger not running')
      return
    }

    console.log('Stopping DataFlash logger')
    this.dflogger.kill('SIGTERM')
    this.dflogger = null
  }

  getDFLoggerStatus () {
    // Get the current status of the dataflash logger
    return {
      running: this.dflogger !== null
    }
  }

  startLink (callback) {
    // start the serial link
    if (this.activeDevice.inputType === 'UDP') {
      console.log('Opening UDP Link ' + '0.0.0.0:' + this.activeDevice.udpInputPort + ', MAV v' + this.activeDevice.mavversion)
    } else {
      console.log('Opening UART Link ' + this.activeDevice.serial + ' @ ' + this.activeDevice.baud + ', MAV v' + this.activeDevice.mavversion)
    }
    // this.outputs.push({ IP: newIP, port: newPort })

    // build up the commandline for mavlink-router
    const cmd = ['-e', '127.0.0.1:14540', '-e', '127.0.0.1:14541', '--tcp-port']
    if (this.enableTCP === true) {
      cmd.push('5760')
    } else {
      cmd.push('0')
    }
    for (let i = 0, len = this.UDPoutputs.length; i < len; i++) {
      cmd.push('-e')
      cmd.push(this.UDPoutputs[i].IP + ':' + this.UDPoutputs[i].port)
    }
    //cmd.push('--log')
    //cmd.push(logpaths.flightsLogsDir)
    //if (this.doLogging === true) {
    //  cmd.push('--telemetry-log')
    //}
    if (this.enableUDPB === true) {
      cmd.push('0.0.0.0:' + this.UDPBPort)
    }
    if (this.activeDevice.inputType === 'UART') {
      const serialPath = getSerialPathFromValue(this.activeDevice.serial, this.serialDevices)
      cmd.push(serialPath + ':' + this.activeDevice.baud)
    } else if (this.activeDevice.inputType === 'UDP') {
      cmd.push('0.0.0.0:' + this.activeDevice.udpInputPort)
    }
    console.log(cmd)

    // check mavlink-router exists
    if (!this.validMavlinkRouter()) {
      console.log('Could not find mavlink-routerd')
      this.active = false
      return callback('Could not find mavlink-routerd', false)
    }

    // start mavlink-router
    this.router = spawn(this.mavlinkRouterPath, cmd)
    this.router.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })

    this.router.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
      if (data.toString().includes('Logging target') && data.toString().includes('.bin')) {
        // remove old log, if it exists and is >60kB
        try {
          if (this.binlog !== null) {
            const fileStat = fs.lstatSync(this.binlog)
            if (Math.round(fileStat.size / 1024) < 60) {
              fs.unlinkSync(this.binlog)
            }
          }
        } catch (err) {
          console.log(err)
        }
        const res = data.toString().split(' ')
        const curLog = (res[res.length - 1]).trim()
        this.binlog = path.join(logpaths.flightsLogsDir, curLog)
        console.log('Current log is: ' + this.binlog)
      }
    })

    this.router.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
      console.log('Closed Router')
      this.eventEmitter.emit('stopLink')
    })

    console.log('Opened Router')

    // only restart the mavlink processor if it's a new link,
    // not a reconnect attempt
    if (this.m === null) {
      this.m = new mavManager(this.activeDevice.mavversion, '127.0.0.1', 14540, this.enableDSRequest)
      this.m.eventEmitter.on('gotMessage', (packet, data) => {
        // got valid message - send on to attached classes
        this.previousConnection = true
        this.eventEmitter.emit('gotMessage', packet, data)
      })
    }

    // arming events - just pass them on
    this.m.eventEmitter.on('armed', () => {
      this.eventEmitter.emit('armed')
    })
    this.m.eventEmitter.on('disarmed', () => {
      this.eventEmitter.emit('disarmed')
    })
    this.eventEmitter.emit('newLink')

    // Start dataflash logger if logging enabled
    if (this.doLogging === true) {
      this.startDFLogger()
    }

    this.active = true
    return callback(null, true)
  }

  closeLink (callback) {
    // stop the serial link
    this.active = false
    
    // Stop dataflash logger if running
    if (this.dflogger !== null) {
      this.stopDFLogger()
    }
    
    if (this.router && this.router.exitCode === null) {
      this.router.kill('SIGINT')
      console.log('Trying to close router')
      return callback(null)
    } else {
      console.log('Already Closed Router')
      this.eventEmitter.emit('stopLink')
      return callback(null)
    }
  }

  checkSerialPortIssues () {
    // Check if ModemManager is installed
    if (isModemManagerInstalled()) {
      return new Error('The ModemManager package is installed. This must be uninstalled (via sudo apt remove modemmanager), due to conflicts with serial ports')
    }

    // Check if serial console is active on Raspberry Pi
    if (fs.existsSync('/boot/cmdline.txt') && isPi()) {
      const data = fs.readFileSync('/boot/cmdline.txt', { encoding: 'utf8', flag: 'r' })
      if (data.includes('console=serial0')) {
        return new Error('Serial console is active on /dev/serial0. Use raspi-config to deactivate it')
      }
    }

    return null
  }

  async getDeviceSettings (callback) {
    // get all serial devices
    this.serialDevices = []
    let retError = null

    // Detect all serial devices using hardwareDetection module
    this.serialDevices = await detectSerialDevices()

    // Check for configuration issues
    retError = this.checkSerialPortIssues()

    // set the active device as selected
    if (this.active && this.activeDevice && this.activeDevice.inputType === 'UART') {
      return callback(retError, this.serialDevices, this.baudRates, this.activeDevice.serial,
        this.activeDevice.baud, this.mavlinkVersions, this.activeDevice.mavversion,
        this.active, this.enableHeartbeat, this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest, this.doLogging, this.activeDevice.udpInputPort,
        this.inputTypes[0].value, this.inputTypes)
    } else if (this.active && this.activeDevice && this.activeDevice.inputType === 'UDP') {
      return callback(retError, this.serialDevices, this.baudRates, this.serialDevices.length > 0 ? this.serialDevices[0].value : [], this.baudRates[3].value,
        this.mavlinkVersions, this.activeDevice.mavversion, this.active, this.enableHeartbeat,
        this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest, this.doLogging, this.activeDevice.udpInputPort,
        this.inputTypes[1].value, this.inputTypes)
    } else {
      // no connection
      return callback(retError, this.serialDevices, this.baudRates, this.serialDevices.length > 0 ? this.serialDevices[0].value : [],
        this.baudRates[3].value, this.mavlinkVersions, this.mavlinkVersions[1].value, this.active, this.enableHeartbeat,
        this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest, this.doLogging, 9000, this.inputTypes[0].value, this.inputTypes)
    }
  }

  startInterval () {
    // start the 1-sec loop checking for disconnects
    this.intervalObj = setInterval(() => {
    
    // Send heartbeats, if they are enabled
    if(this.enableHeartbeat){
      this.m.sendHeartbeat()
    }
      // check for timeouts in serial link (ie disconnected cable or reboot)
      if (this.m && this.m.conStatusInt() === -1) {
        console.log('Trying to reconnect FC...')
        this.closeLink(() => {
          this.startLink((err) => {
            if (err) {
              console.log(err)
            } else {
              // DS request is in this.m.restart()
              this.m.restart()
            }
          })
        })
      }
    }, 1000)
  }

  startStopTelemetry (device, baud, mavversion, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest,
                      doLogging, inputType, udpInputPort, callback) {
    // user wants to start or stop telemetry
    // callback is (err, isSuccessful)

    this.enableHeartbeat = enableHeartbeat
    this.enableTCP = enableTCP
    this.enableUDPB = enableUDPB
    this.UDPBPort = UDPBPort
    this.enableDSRequest = enableDSRequest
    this.doLogging = doLogging

    if (this.m) {
      this.m.enableDSRequest = enableDSRequest
    }

    // check port, mavversion and baud are valid (if starting telem)
    if (!this.active) {
      this.activeDevice = { serial: null, baud: null, inputType: 'UART', mavversion: null, udpInputPort: 9000 }
      this.activeDevice.mavversion = mavversion

      if (inputType === 'UART') {
        this.activeDevice.inputType = 'UART'
        for (let i = 0, len = this.serialDevices.length; i < len; i++) {
          if (this.serialDevices[i].value === device) {
            this.activeDevice.serial = this.serialDevices[i].value
            break
          }
        }
        for (let i = 0, len = this.baudRates.length; i < len; i++) {
          if (this.baudRates[i].value === baud) {
            this.activeDevice.baud = this.baudRates[i].value
            break
          }
        }
        console.log('Selected device: ' + device + ' @ ' + baud)
        console.log(this.activeDevice)

        if (this.activeDevice.serial === null || this.activeDevice.baud === null || this.activeDevice.serial.value === null || this.activeDevice.mavversion === null || this.enableTCP === null) {
          this.activeDevice = null
          this.active = false
          return callback(new Error('Bad serial device or baud'), false)
        }
      } else if (inputType === 'UDP') {
        // UDP input
        this.activeDevice.inputType = 'UDP'
        this.activeDevice.serial = null
        this.activeDevice.baud = null
        this.activeDevice.mavversion = mavversion
        this.activeDevice.udpInputPort = udpInputPort
      } else {
        // unknown input type
        this.activeDevice = null
        return callback(new Error('Unknown input type'), false)
      }

      // this.activeDevice = {inputType, udpInputPort, serial: device, baud: baud};
      this.startLink((err) => {
        if (err) {
          console.log(err)
          this.activeDevice = null
        } else {
          // start timeout function for auto-reconnect
          this.startInterval()
          this.saveSerialSettings()
        }
        return callback(err, this.activeDevice !== null)
      })
    } else {
      // close link
      this.activeDevice = null
      this.closeLink(() => {
        this.saveSerialSettings()
        clearInterval(this.intervalObj)
        this.previousConnection = false
        this.m.close()
        this.m = null
        return callback(null, this.activeDevice !== null)
      })
    }
  }

  saveSerialSettings () {
    // Save the current settings to file
    try {
      this.settings.setValue('flightcontroller.activeDevice', this.activeDevice)
      this.settings.setValue('flightcontroller.outputs', this.UDPoutputs)
      this.settings.setValue('flightcontroller.enableHeartbeat', this.enableHeartbeat)
      this.settings.setValue('flightcontroller.enableTCP', this.enableTCP)
      this.settings.setValue('flightcontroller.enableUDPB', this.enableUDPB)
      this.settings.setValue('flightcontroller.UDPBPort', this.UDPBPort)
      this.settings.setValue('flightcontroller.enableDSRequest', this.enableDSRequest)
      this.settings.setValue('flightcontroller.doLogging', this.doLogging)
      this.settings.setValue('flightcontroller.active', this.active)
      console.log('Saved FC settings')
    } catch (e) {
      console.log(e)
    }
  }
}

module.exports = FCDetails
