const fs = require('fs');
let content = fs.readFileSync('src/app/quests/page.js', 'utf8');
const errorBoundary = `import React from 'react';
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { if (this.state.hasError) return <div style={{padding:'50px',color:'red',fontSize:'20px'}}>{this.state.error.toString()}<pre>{this.state.error.stack}</pre></div>; return this.props.children; }
}
`;
content = errorBoundary + content.replace('export default function DailyOps() {', 'function DailyOpsInner() {').replace(/}$/, `}
export default function DailyOps() { return <ErrorBoundary><DailyOpsInner /></ErrorBoundary>; }
`);
fs.writeFileSync('src/app/quests/page.js', content);
