// src/components/ErrorBoundary.jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('UI crashed:', error, info?.componentStack) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#555', marginTop: 8 }}>Please refresh the page. If it keeps happening, contact support.</p>
        {import.meta.env.DEV && (
          <pre style={{ marginTop: 16, color: '#b91c1c', whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    )
  }
}