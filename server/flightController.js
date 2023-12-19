const SerialPort = require('serialport')
const { autoDetect } = require('@serialport/bindings-cpp')
const fs = require('fs')
const events = require('events')
const path = require('path')
const appRoot = require('app-root-path')
const { spawn, spawnSync, exec } = require('child_process')
const si = require('systeminformation')

const mavManager = require('../mavlink/mavManager.js')

function isPi () {
  let cpuInfo = ''
  try {
    cpuInfo = fs.readFileSync('/proc/device-tree/compatible', { encoding: 'utf8' })
  } catch (e) {
    // if this fails, this is probably not a pi
    return false
  }

  const model = cpuInfo
    .split(',')
    .filter(line => line.length > 0)

  if (!model || model.length === 0) {
    return false
  }

  return model[0] === 'raspberrypi'
}

class FCDetails {
  constructor (settings, winston) {
    // if the device was successfully opend and got packets
    this.previousConnection = false

    this.winston = winston

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
    // JSON of active device (port and baud and mavversion). User selected
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

    // load settings
    this.settings = settings
    this.activeDevice = this.settings.value('flightcontroller.activeDevice', null)
    this.UDPoutputs = this.settings.value('flightcontroller.outputs', [])
    this.enableHeartbeat = this.settings.value('flightcontroller.enableHeartbeat', false)
    this.enableTCP = this.settings.value('flightcontroller.enableTCP', false)
    this.enableUDPB = this.settings.value('flightcontroller.enableUDPB', true)
    this.UDPBPort = this.settings.value('flightcontroller.UDPBPort', 14550)
    this.enableDSRequest = this.settings.value('flightcontroller.enableDSRequest', false)

    if (this.activeDevice !== null) {
      // restart link if saved serial device is found
      let found = false
      this.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, active, enableHeartbeat, enableTCP) => {
        for (let i = 0, len = devices.length; i < len; i++) {
          if (this.activeDevice.serial.value === devices[i].value) {
            found = true
            this.startLink((err, active) => {
              if (err) {
                console.log("Can't open found FC " + this.activeDevice.serial.value + ', resetting link')
                this.winston.info("Can't open found FC " + this.activeDevice.serial.value + ', resetting link')
                this.activeDevice = null
              }
              this.startInterval()
            })
            break
          }
        }
        if (!found) {
          console.log("Can't find saved FC, resetting")
          this.winston.info("Can't find saved FC, resetting")
          this.activeDevice = null
        }
      })
    }
  }

  validMavlinkRouter () {
    // check mavlink-router is installed
    const ls = spawnSync('which', ['mavlink-routerd'])
    console.log(ls.stdout.toString())
    if (ls.stdout.toString().trim() == '') {
      return false
    } else {
      return true
    }
  }

  isModemManagerInstalled () {
    // check ModemManager is installed
    const ls = spawnSync('which', ['ModemManager'])
    console.log(ls.stdout.toString())
    if (ls.stdout.toString().includes('ModemManager')) {
      return true
    } else {
      return false
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
    this.winston.info('Added UDP Output ' + newIP + ':' + newPort)

    // restart mavlink-router, if link active
    if (this.m) {
      this.closeLink((err) => {
        this.startLink((err) => {
          if (err) {
          }
        })
      })
    }

    // try to save. Will be invalid if running under test runner
    try {
      this.saveSerialSettings()
    } catch (e) {
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
        this.winston.info('Removed UDP Output ' + remIP + ':' + remPort)

        // restart mavlink-router, if link active
        if (this.m) {
          this.closeLink((err) => {
            this.startLink((err) => {
              if (err) {
              }
            })
          })
        }

        // try to save. Will be invalid if running under test runner
        try {
          this.saveSerialSettings()
        } catch (e) {
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
      this.winston.info('Rebooting FC')
      this.m.sendReboot()
    }
  }

  startBinLogging () {
    // command the flight controller to start streaming bin log
    if (this.m !== null) {
      console.log('Bin log start request')
      this.winston.info('Bin log start request')
      this.m.sendBinStreamRequest()
    }
  }

  stopBinLogging () {
    // command the flight controller to stop streaming bin log
    if (this.m !== null) {
      console.log('Bin log stop request')
      this.winston.info('Bin log stop request')
      this.m.sendBinStreamRequestStop()
    }
  }

  startLink (callback) {
    // start the serial link
    console.log('Opening Link ' + this.activeDevice.serial.value + ' @ ' + this.activeDevice.baud.value + ', MAV v' + this.activeDevice.mavversion.value)
    this.winston.info('Opening Link ' + this.activeDevice.serial.value + ' @ ' + this.activeDevice.baud.value + ', MAV v' + this.activeDevice.mavversion.value)
    // this.outputs.push({ IP: newIP, port: newPort })

    // build up the commandline for mavlink-router
    const cmd = ['-e', '127.0.0.1:14540', '--tcp-port']
    if (this.enableTCP === true) {
      cmd.push('5760')
    } else {
      cmd.push('0')
    }
    for (let i = 0, len = this.UDPoutputs.length; i < len; i++) {
      cmd.push('-e')
      cmd.push(this.UDPoutputs[i].IP + ':' + this.UDPoutputs[i].port)
    }
    cmd.push('--log')
    cmd.push('./flightlogs/binlogs')
    if (this.enableUDPB === true) {
      cmd.push('0.0.0.0:' + this.UDPBPort)
    }
    cmd.push(this.activeDevice.serial.value + ':' + this.activeDevice.baud.value)
    console.log(cmd)

    // check mavlink-router exists
    if (!this.validMavlinkRouter()) {
      console.log('Could not find mavlink-routerd')
      this.winston.info('Could not find mavlink-routerd')
      return callback('Could not find mavlink-routerd', false)
    }

    // start mavlink-router
    this.router = spawn('mavlink-routerd', cmd)
    this.router.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })

    this.router.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
      if (data.toString().includes('Logging target')) {
        // remove old log, if it exists and is >60kB
        try {
          if (this.binlog !== null) {
            const fileStat = fs.lstatSync(this.binlog)
            if (Math.round(fileStat.size / 1024) < 60) {
              fs.unlinkSync(this.binlog)
            }
          }
        } catch (err) {}
        const res = data.toString().split(' ')
        const curLog = (res[res.length - 1]).trim()
        this.binlog = path.join(appRoot.toString(), 'flightlogs', 'binlogs', curLog)
        console.log('Current log is: ' + this.binlog)
      }
    })

    this.router.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
      console.log('Closed Router')
      this.winston.info('Closed Router')
      this.eventEmitter.emit('stopLink')
    })

    console.log('Opened Router')
    this.winston.info('Opened Router')

    // only restart the mavlink processor if it's a new link,
    // not a reconnect attempt
    if (this.m === null) {
      this.m = new mavManager(this.activeDevice.mavversion.value, '127.0.0.1', 14540, this.enableDSRequest)
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

    return callback(null, true)
  }

  closeLink (callback) {
    // stop the serial link
    if (this.router && this.router.exitCode === null) {
      this.router.kill('SIGINT')
      console.log('Trying to close router')
      this.winston.info('Trying to close router')
      return callback(null)
    } else {
      console.log('Already Closed Router')
      this.winston.info('Already Closed Router')
      this.eventEmitter.emit('stopLink')
      return callback(null)
    }
  }

  async getSerialDevices (callback) {
    // get all serial devices
    this.serialDevices = []
    let retError = null

    const Binding = autoDetect()
    const ports = await Binding.list()

    for (let i = 0, len = ports.length; i < len; i++) {
      if (ports[i].pnpId !== undefined) {
        // usb-ArduPilot_Pixhawk1-1M_32002A000847323433353231-if00
        // console.log("Port: ", ports[i].pnpID);
        let namePorts = ''
        if (ports[i].pnpId.split('_').length > 2) {
          namePorts = ports[i].pnpId.split('_')[1] + ' (' + ports[i].path + ')'
        } else {
          namePorts = ports[i].manufacturer + ' (' + ports[i].path + ')'
        }
        // console.log("Port: ", ports[i].pnpID);
        this.serialDevices.push({ value: ports[i].path, label: namePorts, pnpId: ports[i].pnpId })
      } else if (ports[i].manufacturer !== undefined) {
        // on recent RasPiOS, the pnpID is undefined :(
        const nameports = ports[i].manufacturer + ' (' + ports[i].path + ')'
        this.serialDevices.push({ value: ports[i].path, label: nameports, pnpId: nameports })
      }
    }
    // if the serial console or modemmanager are active on the Pi, return error
    if (this.isModemManagerInstalled()) {
      retError = Error('The ModemManager package is installed. This must be uninstalled (via sudo apt remove modemmanager), due to conflicts with serial ports')
    }
    if (fs.existsSync('/boot/cmdline.txt') && isPi()) {
      const data = fs.readFileSync('/boot/cmdline.txt', { encoding: 'utf8', flag: 'r' })
      if (data.includes('console=serial0')) {
        retError = Error('Serial console is active on /dev/serial0. Use raspi-config to deactivate it')
      }
    }
    // for the Ras Pi's inbuilt UART
    if (fs.existsSync('/dev/serial0') && isPi()) {
      this.serialDevices.push({ value: '/dev/serial0', label: '/dev/serial0', pnpId: '/dev/serial0' })
    }
    if (fs.existsSync('/dev/ttyAMA0') && isPi()) {
      //Pi5 uses a different UART name. See https://forums.raspberrypi.com/viewtopic.php?t=359132
      this.serialDevices.push({ value: '/dev/ttyAMA0', label: '/dev/ttyAMA0', pnpId: '/dev/ttyAMA0' })
    }
    if (fs.existsSync('/dev/ttyAMA1') && isPi()) {
      this.serialDevices.push({ value: '/dev/ttyAMA1', label: '/dev/ttyAMA1', pnpId: '/dev/ttyAMA1' })
    }
    if (fs.existsSync('/dev/ttyAMA2') && isPi()) {
      this.serialDevices.push({ value: '/dev/ttyAMA2', label: '/dev/ttyAMA2', pnpId: '/dev/ttyAMA2' })
    }
    if (fs.existsSync('/dev/ttyAMA3') && isPi()) {
      this.serialDevices.push({ value: '/dev/ttyAMA3', label: '/dev/ttyAMA3', pnpId: '/dev/ttyAMA3' })
    }
    if (fs.existsSync('/dev/ttyAMA4') && isPi()) {
      this.serialDevices.push({ value: '/dev/ttyAMA4', label: '/dev/ttyAMA4', pnpId: '/dev/ttyAMA4' })
    }
    // rpi uart has different name under Ubuntu
    const data = await si.osInfo()
    if (data.distro.toString().includes('Ubuntu') && fs.existsSync('/dev/ttyS0') && isPi()) {
      // console.log("Running Ubuntu")
      this.serialDevices.push({ value: '/dev/ttyS0', label: '/dev/ttyS0', pnpId: '/dev/ttyS0' })
    }
    // jetson serial ports
    if (fs.existsSync('/dev/ttyTHS1')) {
      this.serialDevices.push({ value: '/dev/ttyTHS1', label: '/dev/ttyTHS1', pnpId: '/dev/ttyTHS1' })
    }

    // has the active device been disconnected?
    if (this.port) {
      console.log('Lost active device')
      this.winston.info('Lost active device')
      // this.active = false;
      this.m.close()
      this.m = null
    }
    // set the active device as selected
    if (this.activeDevice) {
      return callback(retError, this.serialDevices, this.baudRates, this.activeDevice.serial, this.activeDevice.baud, this.mavlinkVersions, this.activeDevice.mavversion, true, this.enableHeartbeat, this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest)
    } else if (this.serialDevices.length > 0) {
      return callback(retError, this.serialDevices, this.baudRates, this.serialDevices[0], this.baudRates[3], this.mavlinkVersions, this.mavlinkVersions[1], false, this.enableHeartbeat, this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest)
    } else {
      return callback(retError, this.serialDevices, this.baudRates, [], this.baudRates[3], this.mavlinkVersions, this.mavlinkVersions[1], false, this.enableHeartbeat, this.enableTCP, this.enableUDPB, this.UDPBPort, this.enableDSRequest)
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
        this.winston.info('Trying to reconnect FC...')
        this.closeLink((err) => {
          this.startLink((err) => {
            if (err) {
            } else {
              // DS request is in this.m.restart()
              this.m.restart()
            }
          })
        })
      }
    }, 1000)
  }

  startStopTelemetry (device, baud, mavversion, enableHeartbeat, enableTCP, enableUDPB, UDPBPort, enableDSRequest, callback) {
    // user wants to start or stop telemetry
    // callback is (err, isSuccessful)

  this.enableHeartbeat = enableHeartbeat
    this.enableTCP = enableTCP
    this.enableUDPB = enableUDPB
    this.UDPBPort = UDPBPort
    this.enableDSRequest = enableDSRequest

    if (this.m) {
      this.m.enableDSRequest = enableDSRequest
    }

    // check port, mavversion and baud are valid (if starting telem)
    if (!this.activeDevice) {
      this.activeDevice = { serial: null, baud: null }
      for (let i = 0, len = this.serialDevices.length; i < len; i++) {
        if (this.serialDevices[i].pnpId === device.pnpId) {
          this.activeDevice.serial = this.serialDevices[i]
          break
        }
      }
      for (let i = 0, len = this.baudRates.length; i < len; i++) {
        if (this.baudRates[i].value === baud.value) {
          this.activeDevice.baud = this.baudRates[i]
          break
        }
      }
      for (let i = 0, len = this.mavlinkVersions.length; i < len; i++) {
        if (this.mavlinkVersions[i].value === mavversion.value) {
          this.activeDevice.mavversion = this.mavlinkVersions[i]
          break
        }
      }

      if (this.activeDevice.serial === null || this.activeDevice.baud.value === null || this.activeDevice.serial.value === null || this.activeDevice.mavversion.value === null || this.enableTCP === null) {
        this.activeDevice = null
        return callback(new Error('Bad serial device or baud or mavlink version'), false)
      }

      // this.activeDevice = {serial: device, baud: baud};
      this.startLink((err) => {
        if (err) {
          console.log("Can't open found FC " + this.activeDevice.serial.value + ', resetting link')
          this.winston.info("Can't open found FC " + this.activeDevice.serial.value + ', resetting link')
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
      this.closeLink((err) => {
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
      console.log('Saved FC settings')
      this.winston.info('Saved FC settings')
    } catch (e) {

    }
  }
}

module.exports = FCDetails
