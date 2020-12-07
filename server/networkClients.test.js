var assert = require('assert')
var appRoot = require('app-root-path')
const networkClients = require('./networkClients')

describe('Network Client Functions', function () {
  it('#networkclientgetClients()', function (done) {
    // Getting a list of clients
    networkClients.getClients((err, apnamev, apclientsv) => {
      assert.equal(err, null)
      done()
    })
  })
})
