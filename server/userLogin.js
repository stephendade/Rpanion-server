const path = require('path')
const fs = require('fs').promises;
const bcrypt = require('bcrypt');

class userLogin {
  constructor () {
    this.usersFile = path.join(__dirname, '..', 'config', 'user.json')
  }

  /**
   * Checks the login details of a user.
   *
   * @param {string} username - The username of the user.
   * @param {string} password - The password of the user.
   * @returns {Promise<boolean>} - A promise that resolves to true if the login details are correct, otherwise false.
   * @throws {Error} - Throws an error if there is an issue reading the users file.
   */
  async checkLoginDetails(username, password) {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8')
      const users = JSON.parse(data)

      const user = users.find(user => user.username === username)
      if (user) {
        const match = await bcrypt.compare(password, user.passwordhash)
        return match
      }
      return false
    } catch (error) {
      console.error('Error reading users file:', error)
      return false
    }
  }

  /**
   * Returns a list of all users.
   *
   * @returns {Array} - An array of users.
   * @throws {Error} - Throws an error if there is an issue reading the users file.
   */
  async getAllUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8')
      const users = JSON.parse(data)
      return users
    } catch (error) {
      console.error('Error getting users:', error)
      return []
    }
  }

  /**
   * Adds a new user.
   *
   * @param {string} username - The username of the user.
   * @param {string} password - The password of the user.
   * @returns {Promise<boolean>} - A promise that resolves to true if the user was added successfully, otherwise false.
   * @throws {Error} - Throws an error if there is an issue reading the users file.
   */
  async addUser(username, password) {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8')
      const users = JSON.parse(data)

      const user = users.find(user => user.username === username)
      if (user) {
        return false
      }

      const passwordhash = await bcrypt.hash(password, 10)
      users.push({ username, passwordhash })

      await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2))
      return true
    } catch (error) {
      console.error('Error adding user:', error)
      return false
    }
  }

  /**
   * Deletes a user.
   *
   * @param {string} username - The username of the user.
   * @returns {Promise<boolean>} - A promise that resolves to true if the user was deleted successfully, otherwise false.
   * @throws {Error} - Throws an error if there is an issue reading the users file.
   */
  async deleteUser(username) {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8')
      const users = JSON.parse(data)

      //if there's only 1 user remaining, don't allow deletion
      if (users.length === 1) {
        return false
      }

      const index = users.findIndex(user => user.username === username)
      if (index === -1) {
        return false
      }

      users.splice(index, 1)

      await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2))
      return true
    } catch (error) {
      console.error('Error deleting user:', error)
      return false
    }
  }

  /**
   * Changes the password of a user.
   *
   * @param {string} username - The username of the user.
   * @param {string} password - The new password of the user.
   * @returns {Promise<boolean>} - A promise that resolves to true if the password was changed successfully, otherwise false.
   * @throws {Error} - Throws an error if there is an issue reading the users file.
   */
  async changePassword(username, password) {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8')
      const users = JSON.parse(data)

      const user = users.find(user => user.username === username)
      if (!user) {
        return false
      }

      if(password === '') {
        return false
      }

      user.passwordhash = await bcrypt.hash(password, 10)

      await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2))
      return true
    } catch (error) {
      console.error('Error changing password:', error)
      return false
    }
  }

}

module.exports = userLogin