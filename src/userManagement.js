import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table'

import basePage from './basePage.js'

import './css/styles.css';

class userManagement extends basePage {
  constructor (props) {
    super(props)
    this.state = {
      ...this.state,
      showModal: false,
      modalType: '',
      username: '',
      password: '',
      users: []
    }
  }
    
  componentDidMount () {
    this.loadDone();
    this.fetchUsers();
  }

  fetchUsers = async () => {
    try {
    const response = await fetch('/users', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    this.setState(data);
    } catch (error) {
    console.error('Error fetching users:', error);
    }
  }

  handleShowModal = (type, username) => {
    this.setState({ showModal: true, modalType: type, username: username });
  }

  handleCloseModal = () => {
    this.setState({ showModal: false, modalType: '', username: '', password: '' });
  }

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  }

  handleSubmit = async () => {
    const { modalType, username, password } = this.state;
    if (modalType === 'changePassword') {
      try {
        const response = await fetch('/updateUserPassword', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
            },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        this.setState(data);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        console.log('Password updated successfully:', data);
      } catch (error) {
        console.error('Error updating password:', error);
      }
    } else if (modalType === 'addUser') {
      // Logic to add user
      try {
        const response = await fetch('/createUser', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
            },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        this.setState(data);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        console.log('New user added successfully:', data);
      } catch (error) {
        console.error('Error adding new user:', error);
      }
    } else if (modalType === 'deleteUser') {
      try {
        const response = await fetch('/deleteUser', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
            },
          body: JSON.stringify({ username })
        });
        const data = await response.json();
        this.setState(data);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        console.log('User deleted successfully:', data);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
    this.handleCloseModal();
    this.fetchUsers();
  }

  renderTitle () {
    return 'User Management'
  }

  renderContent () {
    const isFormValid = this.state.username && (this.state.modalType === 'deleteUser' || (this.state.password && this.state.password === this.state.confirmPassword));
    return (
    <div>
      <Table id='users' striped bordered hover size="sm">
      <thead>
        <tr>
        <th>Username</th>
        <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {this.state.users.map(user => (
        <tr key={user.username}>
          <td>{user.username}</td>
          <td>
          <Button size="sm"className="btn" onClick={() => this.handleShowModal('deleteUser', user.username)}>Delete User</Button>{' '}
          <Button size="sm" className="btn" onClick={() => this.handleShowModal('changePassword', user.username)}>Change Password</Button>
          </td>
        </tr>
        ))}
      </tbody>
      </Table>

      <Button size="sm" className="btn" onClick={() => this.handleShowModal('addUser')}>Add New User</Button>

      <Modal show={this.state.showModal} onHide={this.handleCloseModal}>
      <Modal.Header closeButton>
        <Modal.Title>{this.state.modalType === 'changePassword' ? 'Change Password' : this.state.modalType === 'addUser' ? 'Add User' : 'Delete User'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
        {this.state.modalType === 'addUser' ? (
        <Form.Group controlId="formUsername">
        <Form.Label>Username</Form.Label>
        <Form.Control type="text" name="username" value={this.state.username} onChange={this.handleInputChange} />
        </Form.Group>
        ) : (
        <Form.Group controlId="formUsername">
        <Form.Label>Username</Form.Label>
        <Form.Control plaintext readOnly defaultValue={this.state.username} />
        </Form.Group>
        )}
        {this.state.modalType !== 'deleteUser' && (
        <Form.Group controlId="formPassword">
        <Form.Label>Password</Form.Label>
        <Form.Control type="password" name="password" value={this.state.password} onChange={this.handleInputChange} />
        <Form.Group controlId="formConfirmPassword">
        <Form.Label>Confirm Password</Form.Label>
        <Form.Control type="password" name="confirmPassword" value={this.state.confirmPassword} onChange={this.handleInputChange} />
        </Form.Group>
        </Form.Group>
        )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={this.handleCloseModal}>Cancel</Button>
        <Button variant="primary" onClick={this.handleSubmit} disabled={!isFormValid}>
        {this.state.modalType === 'changePassword' ? 'Change Password' : this.state.modalType === 'addUser' ? 'Add User' : 'Delete User'}</Button>
      </Modal.Footer>
      </Modal>
    </div>
    )
  }
}
  
export default userManagement