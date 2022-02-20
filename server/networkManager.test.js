const assert = require('assert')
const networkManager = require('./networkManager')

describe('Network Functions', function () {
  it('#networkmanagergetAdapters()', function (done) {
    // Getting a list of adapters
    networkManager.getAdapters(function (err, netDeviceList) {
      assert.equal(err, null)
      done()
    })
  })

  it('#networkmanagergetConnections()', function (done) {
    // Getting a list of adapters
    networkManager.getConnections(function (err, netConnectionList) {
      assert.equal(err, null)
      done()
    })
  })
})
