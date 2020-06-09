var assert = require('assert')
var appRoot = require('app-root-path')
const settings = require('settings-store')
const videoStream = require('./videostream')

describe('Video Functions', function () {
  it('#videomanagerinit()', function () {
    var vManager = new videoStream(settings)

    // check initial status
    assert.equal(vManager.active, false)
  })

  it('#videomanagerpopulateaddresses()', function () {
    // Getting a list of valid IP addresses
    var vManager = new videoStream(settings)

    vManager.populateAddresses()

    // check initial status
    assert.notEqual(vManager.ifaces.length, 0)
    assert.notEqual(vManager.deviceAddresses.length, 0)
  })

  it('#videomanagerscan()', function (done) {
    // Scanning for video devices capable of streaming
    // in a CI environment, no devices will be returned
    var vManager = new videoStream(settings)

    vManager.populateAddresses()
    vManager.getVideoDevices(function (err, devices, active, seldevice, selRes, selRot, selbitrate) {
      assert.equal(err, null)
      assert.equal(active, false)
      assert.equal(seldevice, null)
      assert.equal(selRes, null)
      assert.equal(selRot, null)
      assert.equal(selbitrate, null)
      done()
    })
  })
})
