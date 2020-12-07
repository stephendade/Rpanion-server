const { exec, execSync } = require('child_process')
var winston = require('./winstonconfig')(module)

function getClients (callback) {
  // If in AP mode, get list of clients
  // get all connections
  exec('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show', (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      winston.error('Error in getClients() ', { message: stderr })
      return callback(stderr.toString(), null, null)
    } else {
      var allConns = stdout.split('\n')
      // stdout.split("\n").forEach(function (item) {
      for (var i = 0, len = allConns.length; i < len; i++) {
        var item = allConns[i]
        var connection = item.split(':')
        var device = connection[3]
        if (connection[2] === '802-11-wireless' && (connection[3] !== '' && connection[3] !== '--')) {
          // get connection details
          try {
            var output = execSync('nmcli -s -t -f 802-11-wireless.mode,802-11-wireless.ssid connection show ' + connection[1])
            var modeline = output.toString().split('\n')[0].split(':')[1]
            if (modeline === 'ap') {
              // Stored in sudo cat /var/lib/NetworkManager/dnsmasq-wlan0.leases
              // 1606808691 34:7d:f6:65:b1:1b 10.0.2.117 l5411 01:34:7d:f6:65:b1:1b
              // we have an active AP
              var allclients = []
              var out = execSync('sudo cat /var/lib/NetworkManager/dnsmasq-' + device + '.leases')
              var allleases = out.toString().split('\n')
              for (var j = 0, lenn = allleases.length; j < lenn; j++) {
                if (allleases[j] !== '') {
                  var details = allleases[j].split(' ')
                  if (details.length !== 5) {
                    winston.error('Bad lease ', { message: details })
                    return callback('Bad lease', connection, [])
                  }
                  var ip = details[2]
                  var mac = details[1]
                  var hostname = details[3]
                  allclients.push({ ip: ip, mac: mac, hostname: hostname })
                }
              }
              return callback(null, device, allclients)
            }
          } catch (e) {
            winston.error('Error in getClients() inter2 ', { message: e })
            return callback(e.toString(), null, null)
          }
        }
      }
      // no AP, as we've not returned yet
      return callback(null, '', null)
    }
  })
}

module.exports = { getClients }
