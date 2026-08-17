const assert = require('assert')
const settings = require('settings-store')
const CloudTest = require('./cloudUpload')

describe('Cloud Upload Functions', function () {
  it('#cloudinit()', function () {
    settings.clear()
    const cloudVar = new CloudTest(settings)

    // check initial status
    assert.equal(cloudVar.options.uploadEnabled, false)
    assert.equal(cloudVar.options.syncDeletions, false)

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudlocalupload()', function () {
    // Getting starting client with local copy
    settings.clear()
    const cloudVar = new CloudTest(settings)

    // check initial status
    assert.equal(cloudVar.options.uploadEnabled, false)
    assert.equal(cloudVar.conStatusStr(), 'Disabled')

    cloudVar.setSettingsBin(true, true, true, 'tmpfolder', false, false, false)

    assert.equal(cloudVar.conStatusStr(), 'Waiting for first run')
    assert.equal(cloudVar.options.uploadEnabled, true)
    assert.equal(cloudVar.options.uploadLogs, true)
    assert.equal(cloudVar.options.uploadMedia, true)

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudpausedwhenarmed()', function () {
    settings.clear()
    const fcManager = { m: { statusArmed: 1, conStatusInt: () => 1 } }
    const cloudVar = new CloudTest(settings, fcManager)

    cloudVar.setSettingsBin(true, true, true, 'tmpfolder', false, false, true)
    assert.equal(cloudVar.conStatusStr(), 'Paused - vehicle armed')

    fcManager.m.statusArmed = 0
    assert.equal(cloudVar.conStatusStr(), 'Waiting for first run')

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudpausedwhenunknown()', function () {
    // "Only upload while disarmed" must treat an unknown vehicle state (no
    // live telemetry) as unsafe, not assume disarmed.
    settings.clear()
    const cloudVar = new CloudTest(settings) // no fcManager - state is unknown

    cloudVar.setSettingsBin(true, true, true, 'tmpfolder', false, false, true)
    assert.equal(cloudVar.getVehicleArmedState(), 'unknown')
    assert.equal(cloudVar.conStatusStr(), 'Paused - vehicle state unknown')

    clearInterval(cloudVar.intervalObj)
  })
})
