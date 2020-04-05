var assert = require('assert')
const settings = require('settings-store')
const FCManagerClass = require('./flightController')

describe('Flight Controller Functions', function () {
  it('#fcinit()', function () {
    var FC = new FCManagerClass(settings)

    // check initial status
    assert.equal(FC.getSystemStatus().conStatus, 'Not connected')
    assert.equal(FC.previousConnection, false)
  })
})
