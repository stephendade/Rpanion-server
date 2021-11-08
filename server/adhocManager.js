/*
Manage adhoc Wifi connections
Note we are using iwconfig here, rather than nmcli,
as nmcli does not support ad-hoc networks
*/

const { exec, execSync } = require('child_process')
var winston = require('./winstonconfig')(module)

function getAdapters (callback) {
  // Get all wifi adapters available to system
  exec('nmcli -t -f device,type,state dev', (error, stdout, stderr) => {
    var netStatusList = []
    var netDeviceSelected = {}
    var settings = {
      ipaddress: '',
      wpaType: 'none',
      password: '',
      ssid: '',
      band: 'bg',
      channel: 0,
      isActive: false
    }
    var activeDevice = false

    if (stderr) {
      console.error(`exec error: ${error}`)
      winston.error('Error in getAdapters() ', { message: stderr })
      return callback(stderr)
    } else {
      stdout.split('\n').forEach(function (item) {
        var device = item.split(':')
        if (device.length === 3 && device[1] === 'wifi' && device[2] !== 'unavailable') {
          console.log('Adding Network device ' + device[0])
          winston.info('getAdapters() adding ' + device)
          // if wifi, check for avail channels
          var freqList = []
          try {
            var output = execSync('iwlist ' + device[0] + ' channel')
            var allFreqs = output.toString().split('\n')
            for (var i = 0, len = allFreqs.length; i < len; i++) {
              if (allFreqs[i].includes('Channel ') && !allFreqs[i].includes('Current')) {
                var ln = allFreqs[i].split(' ').filter(i => i)
                // can only do 2.4GHz channels in adhoc mode
                if (ln.length > 4 && parseFloat(ln[3]) < 3) {
                  freqList.push({ value: parseInt(ln[1]), freq: ln[3], text: '' + ln[1] + ' (' + ln[3] + ' GHz)', band: ((parseFloat(ln[3]) < 3) ? 'bg' : 'a') })
                }
              }
            }
            // get adapter status
            var outputcfg = execSync('iwconfig ' + device[0])
            var ipcfg = execSync('ip -4 -j addr show ' + device[0])
            var pwdLine = execSync('sudo iwlist ' + device[0] + ' key')
            if (outputcfg.toString().includes('Mode:Ad-Hoc')) {
              // adapter is acive in adhoc mopde, grab settings
              activeDevice = device[0]
              var outputlines = outputcfg.toString().split(/[ :\n]+/)
              // console.log(outputlines)
              for (var j = 0, lenn = outputlines.length; j < lenn; j++) {
                if (outputlines[j] === 'ESSID') {
                  settings.ssid = outputlines[j + 1].replace(/"/g, '')
                }
                if (outputlines[j] === 'Frequency' && parseFloat(outputlines[j + 1]) > 3) {
                  settings.band.value = 'a'
                  settings.channel = freqList.find(x => x.freq === outputlines[j + 1]).value
                }
                if (outputlines[j] === 'Frequency' && parseFloat(outputlines[j + 1]) < 3) {
                  settings.band.value = 'bg'
                  settings.channel = freqList.find(x => x.freq === outputlines[j + 1]).value
                }
              }
              // get ip address
              var ipjsonformat = JSON.parse(ipcfg)
              for (var k = 0, lennn = ipjsonformat.length; k < lennn; k++) {
                if ('ifname' in ipjsonformat[k] && ipjsonformat[k].ifname === device[0]) {
                  settings.ipaddress = ipjsonformat[k].addr_info[0].local
                }
              }
              // get password
              var password = pwdLine.toString().split('\n')[2]
              var allpw = password.split(' ')
              if (allpw[1] === 'off') {
                settings.wpaType = 'none'
                settings.password = ''
              } else {
                settings.wpaType = 'wep'
                // nee to convert from hex
                settings.password = Buffer.from(allpw[1].replace(/-/gi, ''), 'hex').toString()
              }
            }
          } catch (e) {
            console.error('exec error: ' + e)
            winston.error('Error in getAdapters() ', { message: e })
            return callback(e)
          }

          netStatusList.push({ value: device[0], label: device[0] + ' (' + device[1] + ')', type: device[1], state: device[2], channels: freqList })
        }
      })
    }
    // console.log(netStatusList)
    if (netStatusList.length === 0) {
      netDeviceSelected = null
      settings.isActive = false
    } else if (activeDevice) {
      netDeviceSelected = netStatusList[0]
      settings.isActive = true
    } else {
      netDeviceSelected = netStatusList[0]
      settings.isActive = false
    }

    return callback(null, netStatusList, netDeviceSelected, settings)
  })
}

function setAdapter (toState, device, settings, callback) {
  // active or deactivate an ad-hoc connection
  if (toState) {
    // activate
    console.log('Activate Adhoc')
    exec('nmcli dev set ' + device + ' managed no && sleep 1 && sudo ip link set ' +
    device + ' down && sudo iwconfig ' +
    device + ' mode ad-hoc ' + ' && sudo iwconfig ' +
    device + ' channel ' + settings.channel + ' && sudo iwconfig ' +
    device + ' essid \'' + settings.ssid + '\'  ' +
    (settings.wpaType === 'none' ? '' : '&& sudo iwconfig ' + device + ' key s:' + settings.password) +
    ' && sudo ip addr flush ' + device +
    ' && sudo ip addr add ' + settings.ipaddress + '/16 dev ' + device +
    ' && sudo ip link set ' + device + ' up', (error, stdout, stderr) => {
      if (stderr) {
        console.log(`exec error: ${error}`)
        winston.error('Error in setAdapter() ', { message: stderr })
        return callback(stderr)
      }
      winston.error('Status in setAdapter() ', { message: stdout })
      // refresh
      console.log('Activate Adhoc Success')
      getAdapters((err, netStatusList, netDeviceSelected, settings) => {
        if (!err) {
          callback(null, netStatusList, netDeviceSelected, settings)
        } else {
          winston.error('Error in /api/setAdapter ', { message: err })
          // reset back to managed
          execSync('sudo ip link set ' + device + ' down && sleep 1 && nmcli dev set ' + device + ' managed yes')
          callback(err, netStatusList, netDeviceSelected, settings)
        }
      })
    })
  } else {
    // deactivate
    console.log('Deactivate Adhoc')
    exec('sudo ip link set ' + device + ' down && sleep 1 && nmcli dev set ' + device + ' managed yes', (error, stdout, stderr) => {
      if (stderr) {
        console.error(`exec error: ${error}`)
        winston.error('Error in setAdapter() ', { message: stderr })
        return callback(stderr)
      }
      // refresh
      getAdapters((err, netStatusList, netDeviceSelected, settings) => {
        if (!err) {
          callback(null, netStatusList, netDeviceSelected, settings)
        } else {
          winston.error('Error in /api/setAdapter ', { message: err })
          callback(err, netStatusList, netDeviceSelected, settings)
        }
      })
    })
  }
}

module.exports = { getAdapters, setAdapter }
