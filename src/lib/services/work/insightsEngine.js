export const insightsEngine = {
  generateInsights(sessions = [], metrics = [], targets = []) {
    const insights = [];
    
    if (sessions.length === 0) return insights;
    
    // 1. Completion Rate Insight
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const completionRate = sessions.length ? (completedSessions.length / sessions.length) * 100 : 0;
    
    insights.push({
      id: 'completion-rate',
      type: 'performance',
      title: 'Session Completion Rate',
      description: `You have completed ${completedSessions.length} out of ${sessions.length} sessions (${completionRate.toFixed(1)}%).`,
      confidence: this.calculateConfidence(sessions.length),
      evidence_count: sessions.length,
      severity: completionRate < 50 ? 'high' : completionRate < 75 ? 'medium' : 'low',
      actionable: true,
      recommendation: completionRate < 75 ? 'Consider breaking down tasks into smaller chunks to improve completion.' : 'Great job maintaining a high completion rate!'
    });

    // 2. Planning Accuracy Insight
    const sessionsWithVariance = completedSessions.filter(s => s.planned_duration_minutes && s.actual_duration_minutes);
    if (sessionsWithVariance.length > 0) {
      const totalVariance = sessionsWithVariance.reduce((acc, s) => acc + (s.actual_duration_minutes - s.planned_duration_minutes), 0);
      const avgVariance = totalVariance / sessionsWithVariance.length;
      
      insights.push({
        id: 'planning-accuracy',
        type: 'planning',
        title: 'Time Estimation Accuracy',
        description: avgVariance > 0 
          ? `On average, tasks take ${avgVariance.toFixed(0)} minutes longer than planned.` 
          : `On average, you finish tasks ${Math.abs(avgVariance).toFixed(0)} minutes earlier than planned.`,
        confidence: this.calculateConfidence(sessionsWithVariance.length),
        evidence_count: sessionsWithVariance.length,
        severity: Math.abs(avgVariance) > 30 ? 'high' : 'low',
        actionable: true,
        recommendation: avgVariance > 0 
          ? 'Add a 20% buffer to your future time estimates.' 
          : 'Your planning is highly efficient.'
      });
    }
    
    return insights;
  },
  
  calculateConfidence(sampleSize) {
    if (sampleSize < 5) return 30;
    if (sampleSize < 10) return 60;
    if (sampleSize < 50) return 85;
    return 95;
  },
  
  getRecommendations(sessions = [], targets = [], categories = []) {
    const recommendations = [];
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    if (completedSessions.length < 5) {
      return [{
        id: 'rec-more-data',
        type: 'system',
        title: 'Log More Sessions',
        description: 'Need more completed sessions to generate accurate personalized recommendations.',
        priority: 'low',
        evidence: 'Insufficient data points.'
      }];
    }

    // Energy analysis
    const highEnergySessions = completedSessions.filter(s => s.energy_score >= 4 && s.actual_start_time);
    if (highEnergySessions.length > 0) {
      const hourCounts = {};
      highEnergySessions.forEach(s => {
        const hour = new Date(s.actual_start_time).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const peakHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b);
      
      recommendations.push({
        id: 'rec-peak-energy',
        type: 'schedule',
        title: 'Schedule Hard Tasks at Peak Hours',
        description: `You consistently report high energy around ${peakHour}:00. Schedule your most difficult work then.`,
        priority: 'high',
        evidence: `Based on ${highEnergySessions.length} sessions with high energy scores.`
      });
    }

    return recommendations;
  }
};
