import { workService } from './workService';

export const eventLoggerService = {
  async log(workspaceId, actorId, eventType, entityType, entityId, payload = {}) {
    const data = {
      workspace_id: workspaceId,
      actor_id: actorId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload
    };
    
    const result = await workService.createEventLog(data);
    await this.checkAndNotify(workspaceId, actorId, eventType, data);
    return result;
  },

  async logSessionEvent(workspaceId, actorId, session, eventType) {
    return this.log(workspaceId, actorId, eventType, 'session', session.id, {
      status: session.status,
      category_id: session.category_id,
      project_id: session.project_id
    });
  },

  async logMetricEvent(workspaceId, actorId, metricId, action, payload = {}) {
    return this.log(workspaceId, actorId, action, 'metric', metricId, payload);
  },

  async checkAndNotify(workspaceId, userId, eventType, context) {
    // Simplified notification rules engine
    const notifications = [];

    switch (eventType) {
      case 'session_completed':
        // Example: Check if it's the 10th session
        if (context.payload?.is_milestone) {
          notifications.push({
            workspace_id: workspaceId,
            user_id: userId,
            title: 'Milestone Reached!',
            message: 'You have completed an important milestone in your project.',
            type: 'milestone_completed',
            link: `/work/sessions/${context.entity_id}`
          });
        }
        break;
      case 'target_achieved':
        notifications.push({
          workspace_id: workspaceId,
          user_id: userId,
          title: 'Target Achieved',
          message: `Congratulations! You have hit your target.`,
          type: 'target_achieved'
        });
        break;
    }

    // Dispatch notifications
    for (const notification of notifications) {
      await workService.createNotification(notification);
    }
  }
};
