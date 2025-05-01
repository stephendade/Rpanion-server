const assert = require('assert')
const path = require('path')
const userLogin = require('./userLogin.js')
const fs = require('fs')

describe('User Login Functions', function () {
  let originalUserFile

  before(function () {
    // Backup the original user.json file
    originalUserFile = fs.readFileSync(path.join(__dirname, '..', 'user.json'), 'utf8')
  })

  after(function () {
    // Restore the original user.json file
    fs.writeFileSync(path.join(__dirname, '..', 'user.json'), originalUserFile, 'utf8')
  })

  it('#logininit()', function () {
    const userMgmt = new userLogin()

    // check initial status
    assert.equal(userMgmt.usersFile, path.join(__dirname, '..', 'user.json'))
  })

  it('#checkLoginDetails()', async function () {
    const userMgmt = new userLogin()
        
    // check initial status
    const result = await userMgmt.checkLoginDetails('admin', 'admin')
    assert.equal(result, true)
  })

  it('#getAllUsers()', async function () {
    const userMgmt = new userLogin()
                
    // check initial status
    const result = await userMgmt.getAllUsers()
    assert.equal(result.length, 1)
  })

  it('#addUser()', async function () {
    const userMgmt = new userLogin()
                
    // check initial status
    const result = await userMgmt.addUser('test', 'test')
    assert.equal(result, true)
  })

  it('#deleteUser()', async function () {
    const userMgmt = new userLogin()
                        
    // check initial status
    const result = await userMgmt.deleteUser('test')
    assert.equal(result, true)
  })

  it('#changePassword()', async function () {
    const userMgmt = new userLogin()
                                        
    // check initial status
    const result = await userMgmt.changePassword('admin', 'admin')
    assert.equal(result, true)
  })

  it('#changePassword() - invalid user', async function () {
    const userMgmt = new userLogin()
                                                        
    // check initial status
    const result = await userMgmt.changePassword('test', 'test')
    assert.equal(result, false)
  })

  it('#changePassword() - invalid password', async function () {
    const userMgmt = new userLogin()
                                                                        
    // check initial status
    const result = await userMgmt.changePassword('admin', '')
    assert.equal(result, false)
  })

  it('#changePassword() - invalid user and password', async function () {
    const userMgmt = new userLogin()
                                                                                        
    // check initial status
    const result = await userMgmt.changePassword('test', 'test')
    assert.equal(result, false)
  })
})