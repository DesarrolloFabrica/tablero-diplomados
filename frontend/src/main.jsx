import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, BubbleController, ScatterController,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import App from './App'
import { VentasFiltersProvider } from './context/VentasFiltersContext'
import './styles.css'

// ── Register ALL Chart.js components globally ──────────────────
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, BubbleController, ScatterController,
  Title, Tooltip, Legend, Filler,
  ChartDataLabels,
)

// Global Chart.js defaults
ChartJS.defaults.font = { family: "'IBM Plex Sans', sans-serif", size: 11 }
ChartJS.defaults.color = '#475569'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VentasFiltersProvider>
      <App />
    </VentasFiltersProvider>
  </React.StrictMode>,
)
