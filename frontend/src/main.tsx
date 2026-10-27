import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createCalculatorClient } from './api/client'
import { App } from './App'
import './index.css'

// One client for the lifetime of the page. A client created during render
// would be a new object every time and restart the in-flight request.
const client = createCalculatorClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
)
