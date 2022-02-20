const assert = require('assert')
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
