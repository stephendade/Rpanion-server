/*
 VPN management. Currently supports Zerotier and Wireguard
*/
const path = require('path')
const { exec, execFile } = require('child_process')
const winston = require('./winstonconfig')(module)

function getVPNStatusZerotier (errpass, callback) {
  // get status of VPN
  exec('sudo zerotier-cli info && sudo zerotier-cli listnetworks -j', (error, stdout, stderr) => {
    if (stderr.toString().trim() !== '') {
      console.error(`exec error: ${error}`)
      winston.info('Error in getVPNStatusZerotier() ', { message: stderr })
      return callback(null, { installed: false, status: false, text: JSON.parse('[]') })
    } else {
      // zerotier's in JSON format anyway, so just pipe through
      if (stdout.search('connection failed') > -1) {
        return callback(errpass, { installed: true, status: false, text: JSON.parse('[]') })
      } else {
        const infoout = stdout.slice(0, stdout.indexOf('[\n]'))
        const networkout = stdout.slice(stdout.indexOf('\n') + 1)
        const isOnline = infoout.search('ONLINE') > -1 || infoout.search('TUNNELED') > -1
        return callback(errpass, { installed: true, status: isOnline, text: JSON.parse(networkout) })
      }
    }
  })
}

function addZerotier (network, callback) {
  console.log('Adding: ' + network)
  execFile('sudo', ['zerotier-cli', 'join', network], (error, stdout, stderr) => {
    if (stderr.toString().trim() !== '') {
      console.error(`exec error: ${error}`)
      winston.info('Error in addZerotier() ', { message: stderr })
    } else {
      // console.log(stdout)
      if (stdout.search('200 join OK') > -1) {
        return getVPNStatusZerotier(null, callback)
      } else {
        return getVPNStatusZerotier(stdout.toString().trim(), callback)
      }
    }
  })
}

function removeZerotier (network, callback) {
  console.log('Removing: ' + network)
  execFile('sudo', ['zerotier-cli', 'leave', network], (error, stdout, stderr) => {
    if (stderr.toString().trim() !== '') {
      console.error(`exec error: ${error}`)
      winston.info('Error in removeZerotier() ', { message: stderr })
    } else {
      // console.log(stdout)
      if (stdout.search('200 leave OK') > -1) {
        return getVPNStatusZerotier(null, callback)
      } else {
        return getVPNStatusZerotier(stdout.toString().trim(), callback)
      }
    }
  })
}

function addWireguardProfile (filename, tmpfilepath, callback) {
  // add uploaded profile

  const extensionName = path.extname(filename) // fetch the file extension
  const allowedExtension = ['.conf', '.config']

  if (!allowedExtension.includes(extensionName)) {
    console.log('Bad extension')
    return callback()
  }

  // remove the file
  exec('sudo cp ' + tmpfilepath + ' /etc/wireguard/' + filename + ' && sudo rm ' + tmpfilepath, (error, stdout, stderr) => {
    if (stderr.toString().trim() !== '') {
      console.error(`exec error: ${error}`)
      winston.info('Error in vpnwireguardprofileadd() ', { message: stderr })
    }
    return callback()
  })
}

function activateWireguardProfile (filename, callback) {
  // activate a wireguard profile
  const profile = path.parse(filename).name
  execFile('sudo', ['wg-quick', 'up', profile], (errorw, stdoutw) => {
    execFile('sudo', ['systemctl', 'enable', 'wg-quick@' + profile], (error, stdout) => {
      if (error !== null || errorw !== null) {
        console.error(`exec error: ${error} ${errorw}`)
        winston.info('Error in activateWireguardProfile() ', { message: error })
        let errstr = (error !== null ? error.toString().trim() : '') + (errorw !== null ? errorw.toString().trim() : '')
        getVPNStatusWireguard(errstr, (stderrnot, statusJSON) => {
          return callback(stderrnot, statusJSON)
        })
      } else if (stdout.toString().includes('does not exist') === true) {
        console.error(`exec error2: ${stdout} ${stdoutw}`)
        winston.info('Error2 in activateWireguardProfile() ', { message: stdout })
        getVPNStatusWireguard(stdout.toString().trim() + stdoutw.toString().trim(), (stderrnot, statusJSON) => {
          return callback(stderrnot, statusJSON)
        })
      } else {
        getVPNStatusWireguard(null, (stderrnot, statusJSON) => {
          return callback(null, statusJSON)
        })
      }
    })
  })
}

function deactivateWireguardProfile (filename, callback) {
  // deactivate a wireguard profile

  const profile = path.parse(filename).name
    execFile('sudo', ['systemctl', 'disable', 'wg-quick@' + profile], (error, stdout) => {
      execFile('sudo', ['wg-quick', 'down', profile], (errorw, stdoutw) => {
        if (error !== null || errorw !== null) {
        console.error(`exec error: ${error} ${errorw}`)
        winston.info('Error in deactivateWireguardProfile() ', { message: error })
        let errstr = (error !== null ? error.toString().trim() : '') + (errorw !== null ? errorw.toString().trim() : '')
        getVPNStatusWireguard(errstr, (stderrnot, statusJSON) => {
          return callback(stderrnot, statusJSON)
        })
      } else if (stdout.toString().includes('does not exist') === true) {
        console.error(`exec error: ${stdout} ${stdoutw}`)
        winston.info('Error2 in deactivateWireguardProfile() ', { message: stdout })
        getVPNStatusWireguard(stdout.toString().trim() + stdoutw.toString().trim(), (stderrnot, statusJSON) => {
          return callback(stderrnot, statusJSON)
        })
      } else {
        getVPNStatusWireguard(null, (stderrnot, statusJSON) => {
          return callback(null, statusJSON)
        })
      }
    })
  })
}

function deleteWireguardProfile (filename, callback) {
  // remove a wireguard profile

  // make the filename safe by removing any folder changes
  const wgprofile = path.basename(filename)

  const extensionName = path.extname(wgprofile) // fetch the file extension
  const allowedExtension = ['.conf', '.config']

  if (!allowedExtension.includes(extensionName)) {
    console.log('Bad extension')
    getVPNStatusWireguard(null, (stderrnot, statusJSON) => {
      return callback(new Error('Bad extension'), statusJSON)
    })
  }

  execFile('sudo', ['rm', '/etc/wireguard/' + wgprofile], (error, stdout, stderr) => {
    if (stderr.toString().trim() !== '') {
      console.error(`exec error: ${error}`)
      winston.info('Error in vpnwireguardelete() ', { message: stderr })
    }
    getVPNStatusWireguard(null, (stderrnot, statusJSON) => {
      return callback(null, statusJSON)
    })
  })
}

function getVPNStatusWireguard (errpass, callback) {
  // get status of VPN
  execFile('which', ['wg-quick'], (errorwg, stdoutwg, stderrwg) => {
    // check if installed
    if (errorwg !== null) {
      console.error(`exec error: ${stderrwg}`)
      winston.info('Error in getVPNStatusWireguard() ', { message: stderrwg })
      return callback(stderrwg, { installed: false, status: false, text: JSON.parse('[]') })
    }
    if (stdoutwg.toString().trim() === '') {
      return callback(null, { installed: false, status: false, text: JSON.parse('[]') })
    } else {
      execFile('sudo', ['./python/wireguardconfig.py'], (error, stdout, stderr) => {
        if (error !== null) {
          console.error(`exec error: ${error}`)
          winston.info('Error in getVPNStatusWireguard() ', { message: stderr })
          return callback(stderr, { installed: false, status: false, text: JSON.parse('[]') })
        } else {
          // output in JSON format anyway, so just pipe through
          console.log(stdout)
          return callback(errpass, { installed: true, status: true, text: JSON.parse(stdout) })
        }
      })
    }
  })
}

module.exports = {
  getVPNStatusZerotier,
  getVPNStatusWireguard,
  addZerotier,
  removeZerotier,
  addWireguardProfile,
  deleteWireguardProfile,
  activateWireguardProfile,
  deactivateWireguardProfile
}
