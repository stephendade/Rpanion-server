var assert = require('assert')
var appRoot = require('app-root-path')
const settings = require('settings-store')
const cloud = require('./cloudUpload')
const winston = require('./winstonconfig')(module)

describe('Cloud Upload Functions', function () {
  it('#cloudinit()', function () {
    const cloudVar = new cloud(settings, winston)

    // check initial status
    assert.equal(cloudVar.options.doBinUpload, false)

    clearInterval(cloudVar.intervalObj)
  })

  it('#cloudlocalupload()', function () {
    // Getting starting client with local copy
    const cloudVar = new cloud(settings, winston)

    // check initial status
    assert.equal(cloudVar.conStatusBinStr(), 'Disabled')

    cloudVar.setSettingsBin(true, 'tmpfolder', false)

    assert.equal(cloudVar.conStatusBinStr(), 'Waiting for first run')

    clearInterval(cloudVar.intervalObj)
  })
})
