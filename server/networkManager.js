const { exec, execSync, execFile } = require('child_process')

function getAdapters (callback) {
  // Get all network adapter name, type and states
  exec('sudo nmcli -t -f device,type,state dev', (error, stdout, stderr) => {
    const netStatusList = []
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      stdout.split('\n').forEach(function (item) {
        const device = item.split(':')
        if (device.length === 3 && device[1] !== 'loopback' && device[1] !== 'bridge' && device[1] !== 'wifi-p2p' && device[1] !== 'can0' && device[1] !== 'can1') {
          console.log('Adding Network device ' + device[0])
          // if wifi, check for avail channels
          const freqList = []
          freqList.push({ value: 0, freq: 0, text: 'auto', band: 0 })
          if (device[1] === 'wifi') {
            try {
              const output = execSync('iwlist ' + device[0] + ' channel')
              const allFreqs = output.toString().split('\n')
              for (let i = 0, len = allFreqs.length; i < len; i++) {
                if (allFreqs[i].includes('Channel ') && !allFreqs[i].includes('Current')) {
                  const ln = allFreqs[i].split(' ').filter(i => i)
                  if (ln.length > 4) {
                    freqList.push({ value: parseInt(ln[1]), freq: ln[3], text: '' + ln[1] + ' (' + ln[3] + ' GHz)', band: ((parseFloat(ln[3]) < 3) ? 'bg' : 'a') })
                  }
                }
              }
            } catch (e) {
              console.error('exec error: ' + e)
              return callback(e)
            }
          }
          netStatusList.push({ value: device[0], label: device[0] + ' (' + device[1] + ')', type: device[1], state: device[2], channels: freqList, isDisabled: !!((device[2] === 'unavailable' && device[1] === 'wifi')) })
        }
      })
    }
    return callback(null, netStatusList)
  })
}

function getWirelessStatus (callback) {
  // get the "flight mode" status of the wireless (wifi) adapters
  exec('sudo nmcli -t radio wifi', (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      console.log('Wifi is ' + stdout)
      if (stdout === 'enabled\n') {
        return callback(null, true)
      } else {
        return callback(null, false)
      }
    }
  })
}

function setWirelessStatus (status, callback) {
  exec('sudo nmcli radio wifi ' + ((status === true) ? 'on' : 'off') + ' && sudo nmcli -t radio wifi', (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      if (stdout === 'enabled\n') {
        return callback(null, true)
      } else {
        return callback(null, false)
      }
    }
  })
}

function activateConnection (conName, callback) {
  // activate the connection (by id)
  // assumed that conName is a valid UUID
  execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'connection.autoconnect', 'yes'], (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      execFile('sudo', ['nmcli', 'connection', 'up', conName], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Activated network: ' + conName)
          return callback(null, 'OK')
        }
      })
    }
  })
}

function deactivateConnection (conName, callback) {
  // deactivate the connection (by id)
  // assumed that conName is a valid UUID
  // need to disable auto-connect too
  execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'connection.autoconnect', 'no'], (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      execFile('sudo', ['nmcli', 'connection', 'down', conName], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Dectivated network: ' + conName)
          return callback(null, 'OK')
        }
      })
    }
  })
}

function getPrimaryWifiDevice(callback) {
  exec('iw dev | grep Interface | awk \'{print $2}\'', (error, stdout, stderr) => {
      if (error) {
          console.error(`exec error: ${error}`)
          return callback(error)
      }
      if (stderr) {
          console.error(`stderr: ${stderr}`)
          return callback(new Error(stderr))
      }
      const device = stdout.trim().split('\n')[0]
      callback(null, device)
  });
}

function getWifiScan(callback) {
  getPrimaryWifiDevice((error, device) => {
      if (error) {
          return callback(error)
      }

      exec(`iwlist ${device} scan`, (error, stdout, stderr) => {
          if (error) {
              console.error(`exec error: ${error}`)
              return callback(error)
          }
          if (stderr) {
              console.error(`stderr: ${stderr}`)
              return callback(new Error(stderr))
          }

          const ssidRegex = /ESSID:"([^"]+)"/g
          const signalRegex = /Signal level=(-?\d+)/g
          const wpaRegex = /WPA[1-2]?/g

          let ssidMatch, signalMatch, wpaMatch
          const results = []

          while ((ssidMatch = ssidRegex.exec(stdout)) !== null) {
              signalMatch = signalRegex.exec(stdout)
              wpaMatch = wpaRegex.exec(stdout)

              results.push({
                  ssid: ssidMatch[1],
                  signal: signalMatch ? signalMatch[1] : 'N/A',
                  security: wpaMatch ? wpaMatch[0] : 'open'
              });
          }
          return callback(null, results)
      });
  });
}

function addConnection (conNameStr, conType, conAdapter, conSettings, callback) {
  // add a new connection with name conNameStr and settings
  // conSettings
  // nmcli connection add type wifi ifname $IFNAME con-name $APNAME ssid $SSID
  // due to the multiple edits, we need to set autoconnect to "no"
  if (conType === 'wifi') {
    exec('sudo nmcli connection add type ' + conType + ' ifname ' + conAdapter +
             ' con-name ' + conNameStr + ' ssid \'' + conSettings.ssid.value + '\' 802-11-wireless.mode ' +
             conSettings.mode.value + (Object.keys(conSettings.band).length ? (' 802-11-wireless.band ' + conSettings.band.value) : '') +
             (Object.keys(conSettings.channel).length ? (' 802-11-wireless.channel ' + (conSettings.channel.value === '0' ? '\'\'' : conSettings.channel.value)) : '') +
             ' ipv4.method ' + conSettings.ipaddresstype.value + ' connection.autoconnect no ' + ' && ' +
             'sudo nmcli -g connection.uuid con show ' + conNameStr, (error, stdout, stderr) => {
      if (stderr) {
        console.error(`exec error: ${error}`)
        return callback(stderr)
      } else {
        // once the network is created, add in the settings
        const conUUID = stdout.split('\n')[stdout.split('\n').length - 2]
        console.log('Added network Wifi: ' + conNameStr + ' - ' + conAdapter + ' - ' + conUUID)
        this.editConnection(conUUID, conSettings, (err) => {
          // set autoconnect back to "yes"
          exec('sudo nmcli connection mod ' + conUUID + ' connection.autoconnect yes', (error, stdout, stderr) => {
            if (!err && !stderr) {
              console.log('addConnection() wifi OK')
              return callback(null, 'AddOK')
            } else {
              console.log('Error in editConnection() wifi addcon ', { message: err })
              console.log('Error in editConnection() wifi addcon ', { message: stderr })
              return callback(err)
            }
          })
        })
      }
    })
  } else {
    exec('sudo nmcli connection add type ' + conType + ' ifname ' + conAdapter +
             ' con-name ' + conNameStr + ' connection.autoconnect no ' + '&&' +
             'sudo nmcli -g connection.uuid con show ' + conNameStr, (error, stdout, stderr) => {
      if (stderr) {
        console.error(`exec error: ${error}`)
        return callback(stderr)
      } else {
        // once the network is created, add in the settings
        const conUUID = stdout.split('\n')[stdout.split('\n').length - 2]
        console.log('Added network Wired: ' + conNameStr + ' - ' + conAdapter + ' - ' + conUUID)
        this.editConnection(conUUID, conSettings, (err) => {
          // set autoconnect back to "yes"
          exec('sudo nmcli connection mod ' + conUUID + ' connection.autoconnect yes', (error, stdout, stderr) => {
            if (!err && !stderr) {
              console.log('addConnection() wired OK')
              return callback(null, 'AddOK')
            } else {
              console.log('Error in editConnection() wired addcon ', { message: err })
              console.log('Error in editConnection() wired addcon ', { message: stderr })
              return callback(err)
            }
          })
        })
      }
    })
  }
}

function editConnection (conName, conSettings, callback) {
  // edit an existing connection
  // assumed that conName is a valid UUID
  // there are 4 types of edits - AttachedInterface, IP, Wifi security, Wifi AP
  // small amount of callback hell here :(
  console.log(conSettings)
  editConnectionAttached(conName, conSettings, (errAttach) => {
    console.log('Attach')
    if (!errAttach) {
      editConnectionIP(conName, conSettings, (errIP) => {
        console.log('IP')
        if (!errIP) {
          editConnectionPSK(conName, conSettings, (errPSK) => {
            console.log('PSK')
            if (!errPSK) {
              editConnectionAPClient(conName, conSettings, (errAP) => {
                console.log('AP')
                if (!errAP) {
                  return callback(null, 'EditOK')
                } else {
                  return callback(errAP)
                }
              })
            } else {
              console.log('Error in editConnection() errPSK ', { message: errPSK })
              return callback(errPSK)
            }
          })
        } else {
          console.log('Error in editConnection() errIP ', { message: errIP })
          return callback(errIP)
        }
      })
    } else {
      console.log('Error in editConnection() errAttach ', { message: errAttach })
      return callback(errAttach)
    }
  })
}

function editConnectionAttached (conName, conSettings, callback) {
  // edit the attached interface for a connection
  if (conSettings.attachedIface.value === '&quot;&quot;' || conSettings.attachedIface.value === 'undefined') {
    conSettings.attachedIface.value = '""'
  }

  execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'connection.interface-name', conSettings.attachedIface.value], (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      console.log('Edited network Attachment: ' + conName + ' to ' + conSettings.attachedIface.value)
      return callback(null, 'EditAttachOK')
    }
  })
}

function editConnectionIP (conName, conSettings, callback) {
  // first sort out the IP Addressing (DHCP/static) for LAN and Wifi Client
  if (Object.keys(conSettings.ssid).length === 0 || conSettings.mode.value === 'infrastructure') {
    if (conSettings.ipaddresstype.value === 'auto') {
      execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'ipv4.method', 'auto', 'ipv4.addresses', ''], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Edited network IP Auto: ' + conName)
          return callback(null, 'EditOK')
        }
      })
    } else if (Object.keys(conSettings.ipaddress).length !== 0 && Object.keys(conSettings.subnet).length !== 0) {
      execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'ipv4.addresses', conSettings.ipaddress.value + '/' +
        netmask2CIDR(conSettings.subnet.value), 'ipv4.method', conSettings.ipaddresstype.value], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Edited network IP manual: ' + conName)
          return callback(null, 'EditOK')
        }
      })
    }
  } else {
    console.log('editConnectionIP() not required')
    return callback(null, 'EditNotRequired')
  }
}

function editConnectionPSK (conName, conSettings, callback) {
  // now sort out Wifi client/ap settings - password and security type
  if (Object.keys(conSettings.mode).length === 0) {
    return callback(null, 'EditNotRequired')
  }
  if (conSettings.mode.value === 'infrastructure' || conSettings.mode.value === 'ap') {
    // psk network
    if (conSettings.wpaType.value !== 'none' &&
            Object.keys(conSettings.ssid).length !== 0 &&
            Object.keys(conSettings.password).length !== 0) {
            execFile('sudo', ['nmcli', 'connection', 'mod', conName, '802-11-wireless-security.key-mgmt', conSettings.wpaType.value], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          execFile('sudo', ['nmcli', '-s', 'connection', 'mod', conName, '802-11-wireless-security.pairwise', 'ccmp', '802-11-wireless-security.psk', conSettings.password.value], (error, stdout, stderr) => {
            if (stderr) {
              console.error(`exec error: ${error}`)
              return callback(stderr)
            } else {
              console.log('Edited Wifi psk: ' + conName)
              return callback(null, 'OK')
            }
          })
        }
      })
    }
    else if (conSettings.wpaType.value === 'none' &&
                 Object.keys(conSettings.ssid).length !== 0) {
      execFile('sudo', ['nmcli', 'connection', 'mod', conName, 'remove', '802-11-wireless-security'], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Edited Wifi no-psk: ' + conName)
          return callback(null, 'OK')
        }
      })
    }
  } else {
    console.log('editConnectionPSK() not required')
    return callback(null, 'EditNotRequired')
  }
}

function editConnectionAPClient (conName, conSettings, callback) {
  // now sort out Wifi ap or client settings - ssid, band, starting ip
  if (Object.keys(conSettings.mode).length === 0) {
    return callback(null, 'EditNotRequired')
  }
  if (conSettings.mode.value === 'ap') {
    if (Object.keys(conSettings.ssid).length !== 0 &&
            Object.keys(conSettings.band).length !== 0 &&
            Object.keys(conSettings.channel).length !== 0 &&
            Object.keys(conSettings.ipaddress).length !== 0) {
      const cmds = ['nmcli', 'connection', 'mod', conName, '802-11-wireless.ssid', conSettings.ssid.value,
        '802-11-wireless.band', conSettings.band.value, 'ipv4.addresses', conSettings.ipaddress.value + '/24']
      if (conSettings.channel.value !== '0') {
        cmds.push('802-11-wireless.channel', conSettings.channel.value)
      }
      if (conSettings.wpaType.value !== 'none') {
        cmds.push('802-11-wireless-security.group', 'ccmp', '802-11-wireless-security.wps-method', '1')
      }
      execFile('sudo', cmds, (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Edited Wifi ap ssid/band: ' + conName)
          return callback(null, 'OK')
        }
      })
    } else {
      console.log('Badsettings in editConnectionAPClient')
      console.log(conSettings)
      return callback(null, 'BADARGS')
    }
  } else {
    // client connection - edit ssid if required
    if (Object.keys(conSettings.ssid).length !== 0) {
      execFile('sudo', ['nmcli', 'connection', 'mod', conName, '802-11-wireless.ssid', conSettings.ssid.value], (error, stdout, stderr) => {
        if (stderr) {
          console.error(`exec error: ${error}`)
          return callback(stderr)
        } else {
          console.log('Edited Wifi client ssid: ' + conName)
          return callback(null, 'OK')
        }
      })
    } else {
      console.log('Badsettings in editConnectionAPClient')
      console.log(conSettings)
      return callback(null, 'BADARGS')
    }
  }
}

function deleteConnection (conName, callback) {
  // delete the connection (by id)
  // assumed that conName is a valid UUID
  execFile('sudo', ['nmcli', 'connection', 'delete', conName], (error, stdout, stderr) => {
    if (stderr) {
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      console.log('Deleted network: ' + conName)
      return callback(null, 'OK')
    }
  })
}

function getConnections (callback) {
  let output = ''
  const conStatusList = []
  try {
    output = execSync('sudo nmcli -t -f NAME,UUID,TYPE,DEVICE connection show')
  } catch (e) {
    console.error('exec error: ' + e)
    return callback(e)
  }

  const allConns = output.toString().split('\n')
  for (let i = 0, len = allConns.length; i < len; i++) {
    const item = allConns[i]
    const connection = item.split(':')
    let curConn = {}
    let subout = ''
    if (connection.length == 4 || connection.length == 3) {
      try {
        subout = execSync('sudo nmcli -s -t -f connection.interface-name connection show ' + connection[1])
        subout = subout.toString().split(':')[1].trim()
      } catch (e) {
        console.error('exec error: ' + e)
        // return callback("");
      }
    }
    if (connection[3] === '' || connection[3] === '--') {
      curConn = { value: connection[1], label: '', labelPre: connection[0], type: connection[2], state: '', attachedIface: subout }
      conStatusList.push(curConn)
    } else if (connection.length === 4) {
      // active connection
      curConn = { value: connection[1], label: '', labelPre: connection[0], type: connection[2], state: connection[3], attachedIface: subout }
      conStatusList.push(curConn)
    }
    // if we're at the end, return callback
    if (i === allConns.length - 1) {
      console.log('getConnections() got: ' + allConns.length)
      return callback(null, conStatusList)
    }
  }
}

function getConnectionDetails (conName, callback) {
  execFile('sudo', ['nmcli', '-s', '-t', '-f', 'ipv4.addresses,802-11-wireless.band,ipv4.method,IP4.ADDRESS,802-11-wireless.ssid,802-11-wireless.mode,802-11-wireless-security.key-mgmt,802-11-wireless-security.psk,connection.interface-name,802-11-wireless.channel', 'connection', 'show', conName], (error, stdout, stderr) => {
    if (stderr) {
      // no connection with that name
      console.error(`exec error: ${error}`)
      return callback(stderr)
    } else {
      const ret = { DHCP: 'auto', IP: '', subnet: '', mode: '', wpaType: 'none', password: '' }
      stdout.split('\n').forEach(function (item) {
        if (item.split(':')[0] === '802-11-wireless.ssid') {
          ret.ssid = item.split(':')[1]
        } else if (item.split(':')[0] === '802-11-wireless.band') {
          if (item.split(':')[1] === '') {
            ret.band = 'bg'
          } else {
            ret.band = item.split(':')[1]
          }
        } else if (item.split(':')[0] === 'ipv4.method') {
          ret.DHCP = item.split(':')[1]
        }
        // DHCP IP, if using DHCP
        else if (item.split(':')[0] === 'IP4.ADDRESS[1]' && item.split(':').length > 1 && item.split(':')[1] !== '') {
          ret.IP = item.split(':')[1].split('/')[0]
          ret.subnet = CIDR2netmask(item.split(':')[1].split('/')[1])
        }
        // static IP
        else if (item.split(':')[0] === 'ipv4.addresses' && item.split(':').length > 1 && item.split(':')[1] !== '') {
          ret.IP = item.split(':')[1].split('/')[0]
          ret.subnet = CIDR2netmask(item.split(':')[1].split('/')[1])
        } else if (item.split(':')[0] === '802-11-wireless.mode') {
          ret.mode = item.split(':')[1]
        } else if (item.split(':')[0] === '802-11-wireless-security.key-mgmt') {
          ret.wpaType = item.split(':')[1]
        } else if (item.split(':')[0] === '802-11-wireless-security.psk') {
          ret.password = item.split(':')[1]
        } else if (item.split(':')[0] === 'connection.interface-name') {
          ret.attachedIface = item.split(':')[1]
        } else if (item.split(':')[0] === '802-11-wireless.channel') {
          ret.channel = item.split(':')[1]
        }
      })
      return callback(null, ret)
    }
  })
}

function CIDR2netmask (bitCountstr) {
  const mask = []
  let bitCount = parseInt(bitCountstr)
  // console.log(bitCountstr);
  for (let i = 0; i < 4; i++) {
    const n = Math.min(bitCount, 8)
    // console.log(bitCount);
    mask.push(256 - Math.pow(2, 8 - n))
    bitCount -= n
  }
  return mask.join('.')
}

function netmask2CIDR (mask) {
  let cidr = ''
  for (const m of mask.split('.')) {
    if (parseInt(m) > 255) { throw 'ERROR: Invalid Netmask' } // Check each group is 0-255
    if (parseInt(m) > 0 && parseInt(m) < 128) { throw 'ERROR: Invalid Netmask' }

    cidr += (m >>> 0).toString(2)
  }
  // Condition to check for validity of the netmask
  if (cidr.substring(cidr.search('0'), 32).search('1') !== -1) {
    console.log('Error in netmask2CIDR() ', { message: mask })
    throw 'ERROR: Invalid Netmask ' + mask
  }
  return cidr.split('1').length - 1
}

module.exports = {
  getAdapters,
  getConnections,
  getConnectionDetails,
  activateConnection,
  deleteConnection,
  editConnection,
  addConnection,
  deactivateConnection,
  getWirelessStatus,
  setWirelessStatus,
  getWifiScan
}
