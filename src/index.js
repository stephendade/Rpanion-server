import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'

import 'bootstrap/dist/css/bootstrap.css'
import 'startbootstrap-simple-sidebar/dist/css/styles.css'

import AppRouter from './AppRouter'
import * as serviceWorker from './serviceWorker'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(<BrowserRouter>
              <AppRouter />
            </BrowserRouter>)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister()
