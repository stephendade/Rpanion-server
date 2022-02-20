const assert = require('assert')
const settings = require('settings-store')
const Cloud = require('./cloudUpload')
const winston = require('./winstonconfig')(module)

describe('Cloud Upload Functions', function () {
  it('#cloudinit()', function () {
    const cloudVar = new Cloud(settings, winston)

    // check initial status
    assert.equal(cloudVar.options.doBinUpload, false)

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudlocalupload()', function () {
    // Getting starting client with local copy
    const cloudVar = new Cloud(settings, winston)

    // check initial status
    assert.equal(cloudVar.conStatusBinStr(), 'Disabled')

    cloudVar.setSettingsBin(true, 'tmpfolder', false)

    assert.equal(cloudVar.conStatusBinStr(), 'Waiting for first run')

    clearInterval(cloudVar.intervalObj)
  })
})
