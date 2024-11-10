/*
Manage adhoc Wifi connections
Note we are using iwconfig here, rather than nmcli,
as nmcli does not support ad-hoc networks
*/

const { exec, execSync } = require('child_process')

class adhocManager {
  constructor (settings, winston) {
    this.winston = winston
    this.settings = settings

    this.devicesettings = this.settings.value('adhoc.devicesettings', null)
    this.device = this.settings.value('adhoc.device', null)

    // if Ahoc mode is supposed to be active, then activate it. As OS won't save settings between reboots
    if (this.device !== null) {
      // this.setAdapter(true, this.device, this.devicesettings, null)
      this.setAdapter(true, this.device, this.devicesettings, (err) => {
        if (!err) {
          console.log('Adhoc Init ' + this.device.toString())
          this.winston.info('Adhoc Init ' + this.device.toString())
        } else {
          console.log('Error in adhoc init ', { message: err })
          this.winston.error('Error in adhoc init  ', { message: err })
        }
      })
    }
  }

  getAdapters (callback) {
    // Get all wifi adapters available to system
    exec('nmcli -t -f device,type,state dev', (error, stdout, stderr) => {
      const netStatusList = []
      let netDeviceSelected = {}
      const curSettings = {
        ipaddress: '',
        wpaType: 'none',
        password: '',
        ssid: '',
        band: 'bg',
        channel: 0,
        isActive: false,
        gateway: ''
      }
      let activeDevice = false

      if (stderr) {
        console.error(`exec error: ${error}`)
        this.winston.error('Error in getAdapters() ', { message: stderr })
        return callback(stderr)
      } else {
        stdout.split('\n').forEach(function (item) {
          const device = item.split(':')
          if (device.length === 3 && device[1] === 'wifi' && device[2] !== 'unavailable') {
            console.log('Adding Network device ' + device[0])
            // this.winston.info('getAdapters() adding ' + device)
            // if wifi, check for avail channels
            const freqList = []
            try {
              const output = execSync('iwlist ' + device[0] + ' channel')
              const allFreqs = output.toString().split('\n')
              for (let i = 0, len = allFreqs.length; i < len; i++) {
                if (allFreqs[i].includes('Channel ') && !allFreqs[i].includes('Current')) {
                  const ln = allFreqs[i].split(' ').filter(i => i)
                  // can only do 2.4GHz channels in adhoc mode
                  if (ln.length > 4 && parseFloat(ln[3]) < 3) {
                    freqList.push({ value: parseInt(ln[1]), freq: ln[3], text: '' + ln[1] + ' (' + ln[3] + ' GHz)', band: ((parseFloat(ln[3]) < 3) ? 'bg' : 'a') })
                  }
                }
              }
              // get adapter status
              const outputcfg = execSync('iwconfig ' + device[0])
              const ipcfg = execSync('ip -4 -j addr show ' + device[0])
              const gateway = execSync('ip route show | grep ' + device[0] + ' | grep default | awk \'{ print $3 }\'')
              const pwdLine = execSync('sudo iwlist ' + device[0] + ' key')
              if (outputcfg.toString().includes('Mode:Ad-Hoc')) {
                // adapter is acive in adhoc mopde, grab settings
                activeDevice = device[0]
                const outputlines = outputcfg.toString().split(/[ :\n]+/)
                // console.log(outputlines)
                for (let j = 0, lenn = outputlines.length; j < lenn; j++) {
                  if (outputlines[j] === 'ESSID') {
                    curSettings.ssid = outputlines[j + 1].replace(/"/g, '')
                  }
                  if (outputlines[j] === 'Frequency' && parseFloat(outputlines[j + 1]) > 3) {
                    curSettings.band = 'a'
                    curSettings.channel = freqList.find(x => x.freq === outputlines[j + 1]).value
                  }
                  if (outputlines[j] === 'Frequency' && parseFloat(outputlines[j + 1]) < 3) {
                    curSettings.band = 'bg'
                    curSettings.channel = freqList.find(x => x.freq === outputlines[j + 1]).value
                  }
                }
                // get ip address
                const ipjsonformat = JSON.parse(ipcfg)
                for (let k = 0, lennn = ipjsonformat.length; k < lennn; k++) {
                  if ('ifname' in ipjsonformat[k] && ipjsonformat[k].ifname === device[0]) {
                    curSettings.ipaddress = ipjsonformat[k].addr_info[0].local
                  }
                }
                // get password
                const password = pwdLine.toString().split('\n')[2]
                const allpw = password.split(' ')
                if (allpw[1] === 'off') {
                  curSettings.wpaType = 'none'
                  curSettings.password = ''
                } else {
                  curSettings.wpaType = 'wep'
                  // nee to convert from hex
                  curSettings.password = Buffer.from(allpw[1].replace(/-/gi, ''), 'hex').toString()
                }
                curSettings.gateway = gateway.toString()
              }
            } catch (e) {
              console.error('exec error: ' + e)
              //this.winston.error('Error in getAdapters() ', { message: e })
              return callback(e)
            }

            netStatusList.push({ value: device[0], label: device[0] + ' (' + device[1] + ')', type: device[1], state: device[2], channels: freqList })
          }
        })
      }
      // console.log(netStatusList)
      if (netStatusList.length === 0) {
        netDeviceSelected = null
        curSettings.isActive = false
      } else if (activeDevice) {
        netDeviceSelected = netStatusList[0]
        curSettings.isActive = true
      } else {
        netDeviceSelected = netStatusList[0]
        curSettings.isActive = false
      }

      return callback(null, netStatusList, netDeviceSelected, curSettings)
    })
  }

  setAdapter (toState, device, settings, callback) {
    // active or deactivate an ad-hoc connection
    this.settings.setValue('adhoc.devicesettings', settings)
    this.settings.setValue('adhoc.device', toState ? device : null)
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
      ' && sudo ip link set ' + device + ' up' +
      (settings.gateway === '' ? '' : '&& sudo route add default gw ' + settings.gateway + ' ' + device), (error, stdout, stderr) => {
        if (stderr) {
          console.log(`exec error: ${error}`)
          this.winston.error('Error in setAdapter() ', { message: stderr })
          return callback(stderr)
        }
        this.winston.error('Status in setAdapter() ', { message: stdout })
        // refresh
        console.log('Activate Adhoc Success')
        this.getAdapters((err, netStatusList, netDeviceSelected, settings) => {
          if (!err) {
            callback(null, netStatusList, netDeviceSelected, settings)
          } else {
            this.winston.error('Error in /api/setAdapter ', { message: err })
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
          this.winston.error('Error in setAdapter() ', { message: stderr })
          return callback(stderr)
        }
        // refresh
        this.getAdapters((err, netStatusList, netDeviceSelected, settings) => {
          if (!err) {
            callback(null, netStatusList, netDeviceSelected, settings)
          } else {
            this.winston.error('Error in /api/setAdapter ', { message: err })
            callback(err, netStatusList, netDeviceSelected, settings)
          }
        })
      })
    }
  }
}

module.exports = adhocManager
