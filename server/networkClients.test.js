const assert = require('assert')
const networkClients = require('./networkClients')

describe('Network Client Functions', function () {
  it('#networkclientgetClients()', function (done) {
    // Getting a list of clients
    networkClients.getClients((err) => {
      assert.equal(err, null)
      done()
    })
  })
})
