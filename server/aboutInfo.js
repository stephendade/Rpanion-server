const process = require('process')
const { exec, spawn } = require('child_process')
const si = require('systeminformation')
const winston = require('./winstonconfig')(module)

function getSoftwareInfo (callback) {
  // get the OS, Node.js and Rpanion-server versions
  si.osInfo(function (data) {
    return callback('' + data.distro + ' - ' + data.release, process.version, process.env.npm_package_version, data.hostname, null)
  })
}

function getDiskInfo (callback) {
  // get the used and total disk space (in Gb) of root "/"
  // callback is (totalsize, usedsize, percentUsed, err)
  si.fsSize(function (data) {
    for (const disk of data) {
      if (disk.mount === '/') {
        return callback((disk.size / (1024 * 1024 * 1024)).toFixed(2), (disk.used / (1024 * 1024 * 1024)).toFixed(2), disk.use, null)
      }
    }
  })
}

function rebootCC () {
  // reboot the companion computer
  console.log('Reboot now')
  winston.info('Reboot now')
  exec('sudo reboot', function (error, stdout, stderr) {
    if (error) {
      console.log(error)
      winston.info(error)
    }
    console.log(stdout)
    winston.info(stdout)
  })
}

function shutdownCC () {
  // shutdown the companion computer
  console.log('Shutting down')
  winston.info('Shutting down')
  exec('sudo shutdown now', function (error, stdout, stderr) {
    if (error) {
      console.log(error)
      winston.info(error)
    }
    console.log(stdout)
    winston.info(stdout)
  })
}

function updateRS (io) {
  // update Rpanion-server
  console.log('Upgrading')
  winston.info('Upgrading')
  const ug = spawn('bash', ['./deploy/upgrade.sh'], { shell: true })
  ug.stdout.on('data', function (data) {
    console.log('stdout: ' + data.toString())
    winston.info('stdout: ' + data.toString())
    io.sockets.emit('upgradeText', data.toString())
  })

  ug.stderr.on('data', function (data) {
    console.log('Upgrade fail: ' + data.toString())
    winston.info('Upgrade fail: ' + data.toString())
    io.sockets.emit('upgradeText', data.toString())
  })

  ug.on('exit', function (code) {
    console.log('Upgrade complete: ' + code.toString())
    winston.info('Upgrade complete: ' + code.toString())
    io.sockets.emit('upgradeText', '---Upgrade Complete (' + code.toString() + ')---')
  })
}

function getHardwareInfo (callback) {
  // get the CPU, RAM info
  si.cpu(function (CPUdata) {
    // console.log(CPUdata);
    si.mem(function (MEMdata) {
      const CPUString = CPUdata.manufacturer + ' ' + CPUdata.brand +
                      ' (' + CPUdata.speed + 'GHz x ' + CPUdata.cores + ')'
      const hatData = { product: '', vendor: '', version: '' }
      // get Pi HAT data, if it exists
      exec('cat /proc/device-tree/hat/product && printf "\n" && cat /proc/device-tree/hat/vendor && printf "\n" && cat /proc/device-tree/hat/product_ver', (error, stdout, stderr) => {
        if (!error && stdout.split('\n').length === 3) {
          const items = stdout.split('\n')
          hatData.product = items[0]
          hatData.vendor = items[1]
          hatData.version = items[2]
        } else {
          console.log(error)
        }
        return callback((MEMdata.total / (1024 * 1024 * 1024)).toFixed(2), CPUString, hatData, null)
      })
    })
  })
}

module.exports = { getSoftwareInfo, getHardwareInfo, getDiskInfo, shutdownCC, updateRS }
