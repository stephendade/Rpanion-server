const { exec, execSync } = require('child_process')
const winston = require('./winstonconfig')(module)

function getClients (callback) {
  // If in AP mode, get list of clients
  // get all connections
  exec('nmcli -t -f NAME,UUID,TYPE,DEVICE connection show', (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      winston.error('Error in getClients() ', { message: stderr })
      return callback(stderr.toString(), null, null)
    } else {
      const allConns = stdout.split('\n')
      // stdout.split("\n").forEach(function (item) {
      for (let i = 0, len = allConns.length; i < len; i++) {
        const item = allConns[i]
        const connection = item.split(':')
        const device = connection[3]
        if (connection[2] === '802-11-wireless' && (connection[3] !== '' && connection[3] !== '--')) {
          // get connection details
          try {
            const output = execSync('nmcli -s -t -f 802-11-wireless.mode connection show ' + connection[1])
            const modeline = output.toString().split('\n')[0].split(':')[1]
            if (modeline === 'ap') {
              // Stored in sudo cat /var/lib/NetworkManager/dnsmasq-wlan0.leases
              // 1606808691 34:7d:f6:65:b1:1b 10.0.2.117 l5411 01:34:7d:f6:65:b1:1b
              // we have an active AP
              const allclients = []
              const out = execSync('sudo cat /var/lib/NetworkManager/dnsmasq-' + device + '.leases')
              const allleases = out.toString().split('\n')
              for (let j = 0, lenn = allleases.length; j < lenn; j++) {
                if (allleases[j] !== '') {
                  const details = allleases[j].split(' ')
                  if (details.length !== 5) {
                    winston.error('Bad lease ', { message: details })
                    return callback('Bad lease', connection, [])
                  }
                  const ip = details[2]
                  const mac = details[1]
                  const hostname = details[3]
                  allclients.push({ ip: ip, mac: mac, hostname: hostname })
                }
              }
              const ssidOut = execSync('nmcli -s -t -f 802-11-wireless.ssid connection show ' + connection[1])
              const ssidStr = ssidOut.toString().split('\n')[0].split(':')[1]
              return callback(null, ssidStr, allclients)
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
