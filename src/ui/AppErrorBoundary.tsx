import { Component, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main style={{ padding: 24 }} role="alert">
      <h1>화면을 열지 못했습니다</h1><p>이미 저장한 기록은 그대로 있습니다. 저장 전 입력은 다시 열 때 복원되지 않을 수 있습니다.</p>
      <button onClick={() => window.location.reload()}>앱 다시 열기</button>
    </main>
    return this.props.children
  }
}
