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

  it('#fcGetSerialDevices()', function (done) {
    var FC = new FCManagerClass(settings)

    FC.getSerialDevices((err, devices, bauds, seldevice, selbaud, mavers, selmav, mavdialects, seldialect, active) => {
      assert.equal(err, null)
      assert.equal(devices.length, 0)
      assert.equal(bauds.length, 8)
      assert.equal(seldevice.length, 0)
      assert.equal(selbaud.value, 9600)
      assert.equal(mavers.length, 2)
      assert.equal(selmav.value, 1)
      assert.equal(mavdialects.length, 2)
      assert.equal(seldialect.value, 'ardupilot')
      assert.equal(active, false)
      done()
    })
  })

  it('#fcUDPadderemove()', function () {
    var FC = new FCManagerClass(settings)

    // check initial status
    assert.equal(FC.getUDPOutputs().length, 0)

    // add udp
    FC.addUDPOutput('127.0.0.1', 15000)
    assert.equal(FC.getUDPOutputs().length, 1)

    // duplicate add
    FC.addUDPOutput('127.0.0.1', 15000)
    assert.equal(FC.getUDPOutputs().length, 1)

    // another add
    FC.addUDPOutput('127.0.0.1', 15001)
    assert.equal(FC.getUDPOutputs().length, 2)

    // remove
    FC.removeUDPOutput('127.0.0.1', 15001)
    assert.equal(FC.getUDPOutputs().length, 1)

    // remove non-valid
    FC.removeUDPOutput('127.0.0.1', 15003)
    assert.equal(FC.getUDPOutputs().length, 1)
  })
})
