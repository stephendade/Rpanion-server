const assert = require('assert')
const VPNManager = require('./vpn')
//const winston = require('./winstonconfig')(module)

describe('VPN Functions', function () {
  it('#getVPNStatusZerotier()', function (done) {
    // Get zerotier status
    VPNManager.getVPNStatusZerotier(null, (stderr, statusJSON) => {
      assert.equal(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })

  it('#addZerotier()', function (done) {
    // Add dummy network
    VPNManager.addZerotier('xxxxx', (stderr, statusJSON) => {
      assert.notEqual(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })

  it('#removeZerotier()', function (done) {
    // Remove dummy network
    VPNManager.removeZerotier('xxxxx', (stderr, statusJSON) => {
      assert.notEqual(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })

  it('#getVPNStatusWireguard()', function (done) {
    // Get wireguard status
    VPNManager.getVPNStatusWireguard(null, (stderr, statusJSON) => {
      assert.equal(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })

  it('#activateWireguardProfile()', function (done) {
    // Add dummy network
    VPNManager.activateWireguardProfile('xxxxx', (stderr, statusJSON) => {
      assert.notEqual(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })

  it('#deactivateWireguardProfile()', function (done) {
    // Remove dummy network
    VPNManager.deactivateWireguardProfile('xxxxx', (stderr, statusJSON) => {
      assert.notEqual(stderr, null)
      assert.equal(statusJSON.installed, true)
      assert.equal(statusJSON.status, true)
      assert.notEqual(statusJSON.text, null)
      done()
    })
  })
})
