import { makeAutoObservable, runInAction } from 'mobx'

class ManageStore {
  username = ''
  password = ''
  token = ''
  message = ''
  messageType = 'success'
  isLoading = false
  isLoggedIn = false
  isPasswordVisible = false
  loginMode = 'credentials'
  loginStatus = ''

  users = []
  config = null
  selectedToken = null
  error = ''

  userDraft = {
    username: '',
    password: '',
  }

  serverStatusByKey = {
    aux: { name: 'aux', port: 9533, isAlive: null, lastChecked: null },
    grpc: { name: 'grpc', port: 9532, isAlive: null, lastChecked: null },
    http: { name: 'http', port: 9531, isAlive: null, lastChecked: null },
  }

  dbs = []
  dbCurrentId = 0
  dbSelectedId = null
  dbStatusMessageById = {}
  dbError = ''

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    this.init()
  }

  init() {
    if (typeof window === 'undefined' || !window.localStorage) return
    const tokenSaved = window.localStorage.getItem('authToken')
    if (!tokenSaved) return
    this.token = tokenSaved
  }

  async onDataChangeRequest(type, params = {}) {
    if (type === 'set-username') {
      this.username = params.username || ''
      return { code: 0 }
    }
    if (type === 'set-password') {
      this.password = params.password || ''
      return { code: 0 }
    }
    if (type === 'set-token') {
      this.token = params.token || ''
      return { code: 0 }
    }
    if (type === 'set-login-mode') {
      this.loginMode = params.loginMode === 'token' ? 'token' : 'credentials'
      this.message = ''
      return { code: 0 }
    }
    if (type === 'toggle-password-visible') {
      this.isPasswordVisible = !this.isPasswordVisible
      return { code: 0 }
    }
    if (type === 'submit-credentials') {
      await this.loginWithCredentials()
      return { code: 0 }
    }
    if (type === 'submit-token') {
      this.loginWithToken()
      return { code: 0 }
    }
    return { code: 0 }
  }

  async loginWithCredentials() {
    this.isLoading = true
    this.message = ''
    try {
      const response = await fetch('/manage/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.username, password: this.password }),
      })
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.token = result?.data?.token || ''
          this.isLoggedIn = true
          this.loginStatus = 'Authenticated'
          this.messageType = 'success'
          this.message = 'Login successful.'
          if (typeof window !== 'undefined' && window.localStorage && this.token) {
            window.localStorage.setItem('authToken', this.token)
          }
        } else {
          this.messageType = 'error'
          this.message = result.message || 'Login failed.'
        }
      })
    } catch (_error) {
      runInAction(() => {
        this.messageType = 'error'
        this.message = 'Login request failed.'
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  loginWithToken() {
    if (!this.token) {
      this.messageType = 'error'
      this.message = 'Token is required.'
      return
    }
    this.isLoggedIn = true
    this.loginStatus = 'Authenticated'
    this.messageType = 'success'
    this.message = 'Token login successful.'
  }

  logout() {
    this.isLoggedIn = false
    this.token = ''
    this.password = ''
    this.loginStatus = ''
    this.users = []
    this.config = null
    this.selectedToken = null
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('authToken')
    }
  }

  async bootstrap() {
    await Promise.all([
      this.fetchUsers(),
      this.fetchConfig(),
      this.fetchDbs(),
      this.checkAllServers(),
    ])
  }

  flush() {
    this.users = []
    this.config = null
    this.selectedToken = null
    this.error = ''
    this.dbError = ''
    this.dbStatusMessageById = {}
  }

  async fetchUsers() {
    this.isLoading = true
    this.error = ''
    try {
      const response = await fetch('/manage/api/users')
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.users = result.data.users || []
        } else {
          this.error = result.message || 'Failed to fetch users.'
        }
      })
    } catch (error) {
      runInAction(() => {
        this.error = 'Error fetching users: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async fetchConfig() {
    try {
      const response = await fetch('/manage/api/config')
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.config = result.data.config || {}
        }
      })
    } catch (_error) {
      runInAction(() => {
        this.error = 'Error fetching config.'
      })
    }
  }

  async updateConfig(id, value) {
    try {
      const response = await fetch('/manage/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [id]: value }),
      })
      const result = await response.json()
      runInAction(() => {
        if (result.code !== 0) {
          this.error = result.message || 'Config update failed.'
        }
      })
      if (result.code === 0) {
        await this.fetchConfig()
      }
      return result
    } catch (error) {
      const result = { code: -1, message: error.message }
      runInAction(() => {
        this.error = 'Error updating config: ' + error.message
      })
      return result
    }
  }

  setUserDraftField(key, value) {
    this.userDraft[key] = value
  }

  async createUser() {
    if (!this.userDraft.username || !this.userDraft.password) {
      this.error = 'Username and password are required.'
      return
    }
    this.isLoading = true
    this.error = ''
    try {
      const response = await fetch('/manage/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.userDraft),
      })
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.userDraft = { username: '', password: '' }
        } else {
          this.error = result.message || 'Failed to create user.'
        }
      })
      if (result.code === 0) {
        await this.fetchUsers()
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Error creating user: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async deleteUser(uid) {
    this.isLoading = true
    this.error = ''
    try {
      const response = await fetch(`/manage/api/users/${uid}`, { method: 'DELETE' })
      const result = await response.json()
      runInAction(() => {
        if (result.code !== 0) {
          this.error = result.message || 'Failed to delete user.'
        }
      })
      if (result.code === 0) {
        await this.fetchUsers()
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Error deleting user: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async issueToken(uid) {
    this.isLoading = true
    this.error = ''
    try {
      const response = await fetch('/manage/api/tokens/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      })
      const result = await response.json()
      runInAction(() => {
        if (result.code !== 0) {
          this.error = result.message || 'Failed to issue token.'
        }
      })
      if (result.code === 0) {
        await this.fetchUsers()
      }
    } catch (error) {
      runInAction(() => {
        this.error = 'Error issuing token: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async viewToken(jti) {
    this.isLoading = true
    this.error = ''
    try {
      const response = await fetch(`/manage/api/tokens/${jti}`)
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.selectedToken = result.data
        } else {
          this.error = result.message || 'Failed to fetch token.'
        }
      })
    } catch (error) {
      runInAction(() => {
        this.error = 'Error fetching token: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async checkServer(serverKey) {
    const server = this.serverStatusByKey[serverKey]
    if (!server) return
    try {
      const response = await fetch(`/manage/api/server_status/${server.name}`)
      const result = await response.json()
      runInAction(() => {
        server.isAlive = result.code === 0 ? result.data.is_alive : false
        server.port = result.code === 0 ? result.data.port : server.port
        server.lastChecked = new Date().toISOString()
      })
    } catch (_error) {
      runInAction(() => {
        server.isAlive = false
        server.lastChecked = new Date().toISOString()
      })
    }
  }

  async checkAllServers() {
    await Promise.all(Object.keys(this.serverStatusByKey).map((serverKey) => this.checkServer(serverKey)))
  }

  async fetchDbs() {
    this.isLoading = true
    this.dbError = ''
    try {
      const response = await fetch('/manage/api/databases')
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.dbs = result.data.databases || []
          this.dbCurrentId = result.data.current_database_id
        } else {
          this.dbError = result.message || 'Failed to fetch dbs.'
        }
      })
    } catch (error) {
      runInAction(() => {
        this.dbError = 'Error fetching dbs: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  get dbSelected() {
    return this.dbs.find((db) => db.id === this.dbSelectedId) || null
  }

  selectDb(dbId) {
    this.dbSelectedId = dbId
  }

  setDbStatusMessage(dbId, statusMessage) {
    if (!statusMessage) {
      delete this.dbStatusMessageById[dbId]
      return
    }
    this.dbStatusMessageById[dbId] = statusMessage
  }

  dismissDbStatusMessage(dbId) {
    delete this.dbStatusMessageById[dbId]
  }

  async testDb(dbId) {
    runInAction(() => {
      this.setDbStatusMessage(dbId, { status: 'loading', messageText: 'testing connection...' })
    })
    try {
      const response = await fetch(`/manage/api/databases/${dbId}/test`, { method: 'POST' })
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.setDbStatusMessage(dbId, {
            status: 'success',
            messageText: result.message || 'connection ok',
          })
        } else {
          this.setDbStatusMessage(dbId, {
            status: 'error',
            messageText: result.message || 'connection failed',
          })
        }
      })
      return result
    } catch (error) {
      runInAction(() => {
        this.setDbStatusMessage(dbId, {
          status: 'error',
          messageText: 'connection test failed: ' + error.message,
        })
      })
      return { code: -1, message: error.message }
    }
  }

  async removeDb(dbId) {
    this.isLoading = true
    this.dbError = ''
    try {
      const response = await fetch(`/manage/api/databases/${dbId}`, { method: 'DELETE' })
      const result = await response.json()
      runInAction(() => {
        if (result.code === 0) {
          this.dbSelectedId = null
        } else {
          this.dbError = result.message || 'Failed to remove db.'
        }
      })
      if (result.code === 0) {
        await this.fetchDbs()
      }
    } catch (error) {
      runInAction(() => {
        this.dbError = 'Error removing db: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async switchDb(dbId) {
    this.isLoading = true
    this.dbError = ''
    try {
      const response = await fetch(`/manage/api/databases/switch/${dbId}`, { method: 'POST' })
      const result = await response.json()
      runInAction(() => {
        if (result.code !== 0) {
          this.dbError = result.message || 'Failed to switch db.'
        }
      })
      if (result.code === 0) {
        this.flush()
        await this.bootstrap()
      }
    } catch (error) {
      runInAction(() => {
        this.dbError = 'Error switching db: ' + error.message
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

}

export const manageStore = new ManageStore()

