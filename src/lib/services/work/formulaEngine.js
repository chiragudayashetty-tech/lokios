export const formulaEngine = {
  validate(expressionJson) {
    if (!expressionJson || typeof expressionJson !== 'object') {
      return { valid: false, errors: ['Expression must be a valid JSON object'] };
    }
    
    const errors = [];
    
    function traverse(node) {
      if (!node) {
        errors.push('Null node encountered');
        return;
      }
      
      switch (node.type) {
        case 'number':
          if (typeof node.value !== 'number') errors.push(`Invalid number value: ${node.value}`);
          break;
        case 'metric':
          if (!node.metricId) errors.push('Metric node missing metricId');
          break;
        case 'operator':
          if (!['+', '-', '*', '/'].includes(node.value)) errors.push(`Invalid operator: ${node.value}`);
          if (!node.children || node.children.length !== 2) errors.push(`Operator ${node.value} requires exactly 2 children`);
          else {
            traverse(node.children[0]);
            traverse(node.children[1]);
          }
          break;
        case 'aggregate':
          if (!['AVG', 'MIN', 'MAX', 'COUNT', 'SUM', '%'].includes(node.value)) errors.push(`Invalid aggregate: ${node.value}`);
          if (!node.children || node.children.length === 0) errors.push(`Aggregate ${node.value} requires at least 1 child`);
          else {
            node.children.forEach(child => traverse(child));
          }
          break;
        default:
          errors.push(`Unknown node type: ${node.type}`);
      }
    }
    
    traverse(expressionJson);
    
    return {
      valid: errors.length === 0,
      errors
    };
  },
  
  evaluate(expressionJson, metricValues) {
    if (!expressionJson) return null;
    
    function evaluateNode(node) {
      if (!node) return 0;
      
      switch (node.type) {
        case 'number':
          return node.value;
        case 'metric':
          return metricValues[node.metricId] || 0;
        case 'operator': {
          const left = evaluateNode(node.children[0]);
          const right = evaluateNode(node.children[1]);
          switch (node.value) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return right === 0 ? 0 : left / right;
            default: return 0;
          }
        }
        case 'aggregate': {
          const values = node.children.map(child => evaluateNode(child));
          switch (node.value) {
            case 'SUM': return values.reduce((a, b) => a + b, 0);
            case 'MIN': return Math.min(...values);
            case 'MAX': return Math.max(...values);
            case 'AVG': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            case 'COUNT': return values.filter(v => v !== null && v !== undefined).length;
            case '%': return values.length >= 2 ? (values[1] === 0 ? 0 : (values[0] / values[1]) * 100) : 0;
            default: return 0;
          }
        }
        default:
          return 0;
      }
    }
    
    try {
      return evaluateNode(expressionJson);
    } catch (e) {
      console.error('Formula evaluation error:', e);
      return null;
    }
  },
  
  buildExpression(tokens) {
    // A simplified token builder, realistically needs a parser. Returning a placeholder structure.
    // Assuming tokens is pre-formatted as nested objects for now.
    if (!tokens || tokens.length === 0) return null;
    return tokens[0]; // Stub implementation
  },
  
  expressionToString(expressionJson) {
    if (!expressionJson) return '';
    
    function convertNode(node) {
      if (!node) return '';
      switch (node.type) {
        case 'number': return node.value.toString();
        case 'metric': return `[Metric:${node.metricId}]`;
        case 'operator': return `(${convertNode(node.children[0])} ${node.value} ${convertNode(node.children[1])})`;
        case 'aggregate': return `${node.value}(${node.children.map(convertNode).join(', ')})`;
        default: return '';
      }
    }
    
    return convertNode(expressionJson);
  },
  
  getReferencedMetricIds(expressionJson) {
    const ids = new Set();
    
    function traverse(node) {
      if (!node) return;
      if (node.type === 'metric' && node.metricId) {
        ids.add(node.metricId);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    }
    
    traverse(expressionJson);
    return Array.from(ids);
  }
};
