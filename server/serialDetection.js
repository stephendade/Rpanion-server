const { autoDetect } = require('@serialport/bindings-cpp')
const fs = require('fs')
const si = require('systeminformation')

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

function isOrangePi () {
  let cpuInfo = ''
  try {
    cpuInfo = fs.readFileSync('/proc/device-tree/compatible', { encoding: 'utf8' })
  } catch (e) {
    // if this fails, this is probably not an Orange Pi
    return false
  }

  return cpuInfo.toLowerCase().includes('orangepi')
}

function isModemManagerInstalled () {
  // check ModemManager is installed
  const { spawnSync } = require('child_process')
  const ls = spawnSync('which', ['ModemManager'])
  console.log(ls.stdout.toString())
  if (ls.stdout.toString().includes('ModemManager')) {
    return true
  } else {
    return false
  }
}

/**
 * Detect all available serial devices on the system
 * @returns {Promise<Array>} Array of serial device objects with value, label, and pnpId
 */
async function detectSerialDevices () {
  const serialDevices = []
  
  const Binding = autoDetect()
  const ports = await Binding.list()

  for (let i = 0, len = ports.length; i < len; i++) {
    if (ports[i].pnpId !== undefined) {
      // usb-ArduPilot_Pixhawk1-1M_32002A000847323433353231-if00
      let namePorts = ''
      if (ports[i].pnpId.split('_').length > 2) {
        namePorts = ports[i].pnpId.split('_')[1] + ' (' + ports[i].path + ')'
      } else {
        namePorts = ports[i].manufacturer + ' (' + ports[i].path + ')'
      }
      serialDevices.push({ path: ports[i].path, label: namePorts, value: ports[i].pnpId })
    } else if (ports[i].manufacturer !== undefined) {
      // on recent RasPiOS, the pnpID is undefined :(
      const nameports = ports[i].manufacturer + ' (' + ports[i].path + ')'
      serialDevices.push({ path: ports[i].path, label: nameports, value: nameports })
    }
  }

  // Add Raspberry Pi built-in UARTs
  if (isPi()) {
    if (fs.existsSync('/dev/serial0')) {
      serialDevices.push({ value: '/dev/serial0', label: '/dev/serial0', path: '/dev/serial0' })
    }
    if (fs.existsSync('/dev/ttyAMA0')) {
      // Pi5 uses a different UART name. See https://forums.raspberrypi.com/viewtopic.php?t=359132
      serialDevices.push({ value: '/dev/ttyAMA0', label: '/dev/ttyAMA0', path: '/dev/ttyAMA0' })
    }
    if (fs.existsSync('/dev/ttyAMA1')) {
      serialDevices.push({ value: '/dev/ttyAMA1', label: '/dev/ttyAMA1', path: '/dev/ttyAMA1' })
    }
    if (fs.existsSync('/dev/ttyAMA2')) {
      serialDevices.push({ value: '/dev/ttyAMA2', label: '/dev/ttyAMA2', path: '/dev/ttyAMA2' })
    }
    if (fs.existsSync('/dev/ttyAMA3')) {
      serialDevices.push({ value: '/dev/ttyAMA3', label: '/dev/ttyAMA3', path: '/dev/ttyAMA3' })
    }
    if (fs.existsSync('/dev/ttyAMA4')) {
      serialDevices.push({ value: '/dev/ttyAMA4', label: '/dev/ttyAMA4', path: '/dev/ttyAMA4' })
    }
    
    // Raspberry Pi UART has different name under Ubuntu
    const data = await si.osInfo()
    if (data.distro.toString().includes('Ubuntu') && fs.existsSync('/dev/ttyS0')) {
      serialDevices.push({ value: '/dev/ttyS0', label: '/dev/ttyS0', path: '/dev/ttyS0' })
    }
  }

  // Add Jetson serial ports
  if (fs.existsSync('/dev/ttyTHS1')) {
    serialDevices.push({ value: '/dev/ttyTHS1', label: '/dev/ttyTHS1', path: '/dev/ttyTHS1' })
  }
  if (fs.existsSync('/dev/ttyTHS2')) {
    serialDevices.push({ value: '/dev/ttyTHS2', label: '/dev/ttyTHS2', path: '/dev/ttyTHS2' })
  }
  if (fs.existsSync('/dev/ttyTHS3')) {
    serialDevices.push({ value: '/dev/ttyTHS3', label: '/dev/ttyTHS3', path: '/dev/ttyTHS3' })
  }

  // Add Orange Pi Zero3 serial ports
  if (isOrangePi()) {
    if (fs.existsSync('/dev/ttyS5')) {
      serialDevices.push({ value: '/dev/ttyS5', label: '/dev/ttyS5', path: '/dev/ttyS5' })
    }
    if (fs.existsSync('/dev/ttyAS5')) {
      serialDevices.push({ value: '/dev/ttyAS5', label: '/dev/ttyAS5', path: '/dev/ttyAS5' })
    }
  }

  return serialDevices
}

/**
 * For a given serial device value, return the corresponding path
 * @param {string} value - The value of the serial device
 * @param {Array} devices - Array of serial device objects
 * @returns {string|null} The path of the serial device or null if not found
 */
function getSerialPathFromValue(value, devices) {
  for (let i = 0; i < devices.length; i++) {
    if (devices[i].value === value) {
      return devices[i].path;
    }
  }
  return null;
}

module.exports = {
  isPi,
  isOrangePi,
  isModemManagerInstalled,
  detectSerialDevices,
  getSerialPathFromValue
}
