const assert = require('assert')
const settings = require('settings-store')
const CloudTest = require('./cloudUpload')

describe('Cloud Upload Functions', function () {
  it('#cloudinit()', function () {
    settings.clear()
    const cloudVar = new CloudTest(settings)

    // check initial status
    assert.equal(cloudVar.options.doBinUpload, false)
    assert.equal(cloudVar.options.syncDeletions, false)

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudlocalupload()', function () {
    // Getting starting client with local copy
    settings.clear()
    const cloudVar = new CloudTest(settings)

    // check initial status
    assert.equal(cloudVar.options.doBinUpload, false)
    assert.equal(cloudVar.conStatusBinStr(), 'Disabled')

    cloudVar.setSettingsBin(true, 'tmpfolder', false)

    assert.equal(cloudVar.conStatusBinStr(), 'Waiting for first run')
    assert.equal(cloudVar.options.doBinUpload, true)

    clearInterval(cloudVar.intervalObj)
  })
})
