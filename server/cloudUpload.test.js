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

    cloudVar.setSettingsBin(true, true, true, 'tmpfolder', false, false)

    assert.equal(cloudVar.conStatusStr(), 'Waiting for first run')
    assert.equal(cloudVar.options.uploadEnabled, true)
    assert.equal(cloudVar.options.uploadLogs, true)
    assert.equal(cloudVar.options.uploadMedia, true)

    clearInterval(cloudVar.intervalObj)
  })
})
