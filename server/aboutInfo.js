const process = require('process')
const { exec } = require('child_process')
const si = require('systeminformation')

function getSoftwareInfo (callback) {
  // get the OS, Node.js and Rpanion-server versions
  si.osInfo(function (data) {
    return callback('' + data.distro + ' - ' + data.release, process.version, process.env.npm_package_version, null)
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
      exec('cat /proc/device-tree/hat/product && printf "\n" && cat /proc/device-tree/hat/vendor && printf "\n" && cat /proc/device-tree/hat/product_ver && printf "\n"', (error, stdout, stderr) => {
        if (!stderr && stdout.split('\n').length === 3) {
          stdout.split('\n').forEach(function (item) {
            hatData.product = item[0]
            hatData.vendor = item[1]
            hatData.version = item[2]
          })
        } else {
        }
      })
      return callback((MEMdata.total / (1024 * 1024 * 1024)).toFixed(2), CPUString, hatData, null)
    })
  })
}

module.exports = { getSoftwareInfo, getHardwareInfo }
