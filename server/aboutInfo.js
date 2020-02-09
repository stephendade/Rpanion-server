const process = require('process')
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
      return callback((MEMdata.total / (1024 * 1024 * 1024)).toFixed(2), CPUString, null)
    })
  })
}

module.exports = { getSoftwareInfo, getHardwareInfo }
