'use client'

import { useEffect } from 'react'

export function ResizeObserverFix() {
  useEffect(() => {
    // Suppress "ResizeObserver loop completed with undelivered notifications." error
    // This is a known, benign error in React applications using ResizeObserver (like Recharts)
    // It indicates that a resize event triggered another resize event in the same frame.
    
    const suppressResizeObserverError = (e: ErrorEvent) => {
      if (
        e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
        e.message === 'ResizeObserver loop limit exceeded'
      ) {
        const resizeObserverErrDiv = document.getElementById(
          'webpack-dev-server-client-overlay-div'
        )
        const resizeObserverErr = document.getElementById(
          'webpack-dev-server-client-overlay'
        )
        if (resizeObserverErr) {
          resizeObserverErr.setAttribute('style', 'display: none')
        }
        if (resizeObserverErrDiv) {
          resizeObserverErrDiv.setAttribute('style', 'display: none')
        }
        
        // Next.js specific overlay hiding
        const nextjsOverlay = document.querySelector('nextjs-portal')
        if (nextjsOverlay) {
          const shadowRoot = nextjsOverlay.shadowRoot
          if (shadowRoot) {
            const overlay = shadowRoot.querySelector('nextjs-toast') || shadowRoot.querySelector('[data-nextjs-dialog-overlay]')
            if (overlay) {
              // We can't easily remove it, but we can stop propagation
            }
          }
        }
        
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener('error', suppressResizeObserverError)

    // Also patch console.error to avoid the red text in console
    const originalConsoleError = console.error
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' && 
        (args[0].includes('ResizeObserver loop completed with undelivered notifications.') ||
         args[0].includes('ResizeObserver loop limit exceeded'))
      ) {
        return
      }
      originalConsoleError(...args)
    }

    return () => {
      window.removeEventListener('error', suppressResizeObserverError)
      console.error = originalConsoleError
    }
  }, [])

  return null
}
