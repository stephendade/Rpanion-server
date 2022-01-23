const process = require('process')
const { exec } = require('child_process')
const si = require('systeminformation')
var winston = require('./winstonconfig')(module)

function getSoftwareInfo (callback) {
  // get the OS, Node.js and Rpanion-server versions
  si.osInfo(function (data) {
    return callback('' + data.distro + ' - ' + data.release, process.version, process.env.npm_package_version, null)
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
    console.log(stdout)
    winston.info(stdout)
  })
}

function shutdownCC () {
  // shutdown the companion computer
  console.log('Shutting down')
  winston.info('Shutting down')
  exec('sudo shutdown now', function (error, stdout, stderr) {
    console.log(stdout)
    winston.info(stdout)
  })
}

function updateRS () {
  // update Rpanion-server
  console.log('Upgrading')
  winston.info('Upgrading')
  exec('sudo /etc/init.d/rpanion-updater', function (error, stdout, stderr) {
    console.log(stdout)
    winston.info(stdout)
  })
}

function getHardwareInfo (callback) {
  // get the CPU, RAM info
  si.cpu(function (CPUdata) {
    // console.log(CPUdata);
    si.mem(function (MEMdata) {
      var CPUString = CPUdata.manufacturer + ' ' + CPUdata.brand +
                      ' (' + CPUdata.speed + 'GHz x ' + CPUdata.cores + ')'
      var hatData = { product: '', vendor: '', version: '' }
      // get Pi HAT data, if it exists
      exec('cat /proc/device-tree/hat/product && printf "\n" && cat /proc/device-tree/hat/vendor && printf "\n" && cat /proc/device-tree/hat/product_ver', (error, stdout, stderr) => {
        if (!error && stdout.split('\n').length === 3) {
          var items = stdout.split('\n')
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

module.exports = { getSoftwareInfo, getHardwareInfo, getDiskInfo, shutdownCC }
