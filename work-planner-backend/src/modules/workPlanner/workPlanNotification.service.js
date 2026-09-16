/**
 * @fileoverview Work Plan notification service to send completion emails to managers.
 * @module modules/workPlanner/workPlanNotification.service
 */
const { getModels } = require('../../data/mongoRegistry');
const emailHelper = require('../messages/helpers/email.helper');
const { logger } = require('../../utils/logger');

/**
 * Finds all active users with manager/admin access to the work_planner portal.
 */
async function getWorkPlannerManagers() {
  try {
    const { User } = getModels();
    const allActiveUsers = await User.find({ is_active: { $ne: false } }).lean();

    const managers = allActiveUsers.filter((u) => {
      if (!u.email) return false;

      // Check portal roles
      if (Array.isArray(u.portals) && u.portals.length > 0) {
        const wpPortal = u.portals.find(
          (p) =>
            p &&
            ['work_planner'].includes(
              String(p.portal_code || '').toLowerCase()
            )
        );
        if (wpPortal && Array.isArray(wpPortal.access_roles)) {
          const hasManagerAccess = wpPortal.access_roles.some((r) =>
            ['manager'].includes(String(r).toLowerCase())
          );
          if (hasManagerAccess) return true;
        }
      }

      return false;
    });

    return managers;
  } catch (err) {
    logger.error(`[WorkPlanNotification] Failed to fetch managers: ${err.message}`);
    return [];
  }
}

function renderVisitsTable(visitsList) {
  if (!Array.isArray(visitsList) || visitsList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic;">No visits recorded for this plan.</p>';
  }
  const rows = visitsList
    .map((v, i) => {
      const party = v.party_name || v.contact_person || 'N/A';
      const purpose = v.purpose || 'N/A';
      const status = v.status || 'pending';
      const outcome = v.outcome || v.notes || 'N/A';
      const badgeClass =
        status === 'completed' ? 'badge-completed' : status === 'pending' ? 'badge-pending' : 'badge-other';
      return `
        <tr>
          <td style="font-weight: 600;">${i + 1}. ${party}</td>
          <td>${purpose}</td>
          <td><span class="badge-status ${badgeClass}">${status}</span></td>
          <td>${outcome}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Party / Contact</th>
          <th>Purpose</th>
          <th>Status</th>
          <th>Outcome / Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderTasksTable(taskList) {
  if (!Array.isArray(taskList) || taskList.length === 0) {
    return '<p style="font-size: 13px; color: #64748b; font-style: italic;">No tasks recorded for this plan.</p>';
  }
  const rows = taskList
    .map((t, i) => {
      const title = t.title || 'N/A';
      const desc = t.description || 'N/A';
      const status = t.status || 'pending';
      const remarks = t.completion_remarks || 'N/A';
      const badgeClass =
        status === 'completed' ? 'badge-completed' : status === 'pending' ? 'badge-pending' : 'badge-other';
      return `
        <tr>
          <td style="font-weight: 600;">${i + 1}. ${title}</td>
          <td>${desc}</td>
          <td><span class="badge-status ${badgeClass}">${status}</span></td>
          <td>${remarks}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Task Title</th>
          <th>Description</th>
          <th>Status</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Dispatches work plan completion notification emails to all Work Plan portal managers.
 * The email is sent FROM the completing executive's email address.
 *
 * @param {string} planId
 * @param {object} executiveUser - The user object of the executive completing the plan
 */
async function sendWorkPlanCompletedEmail(planId, executiveUser) {
  try {
    if (!executiveUser || !executiveUser.email) {
      logger.warn(`[WorkPlanNotification] Missing executive user email for planId ${planId}`);
      return;
    }

    const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();

    const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null }).lean();
    if (!plan) {
      logger.warn(`[WorkPlanNotification] Plan not found for id ${planId}`);
      return;
    }

    // Fetch related visits, work items, and expenses
    const [visits, workItems, expenses] = await Promise.all([
      WorkPlanVisit.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanWork.find({ work_plan: planId, deletedAt: null }).sort({ sequence: 1 }).lean(),
      WorkPlanExpense.find({ work_plan: planId, deletedAt: null }).select('amount').lean(),
    ]);

    const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const managers = await getWorkPlannerManagers();
    if (!managers || managers.length === 0) {
      logger.warn(`[WorkPlanNotification] No work planner managers found to receive notification for plan ${planId}`);
      return;
    }

    const planDateStr = plan.plan_date
      ? new Date(plan.plan_date).toISOString().split('T')[0]
      : 'N/A';

    const executiveName = executiveUser.name || executiveUser.email.split('@')[0];
    const executiveEmail = executiveUser.email;
    const fromAddress = `${executiveName} <${executiveEmail}>`;

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const workPlanUrl = `${baseUrl}/work-plans`;

    const visitsTableHtml = renderVisitsTable(visits);
    const tasksTableHtml = renderTasksTable(workItems);

    const templateData = {
      subject: `Work Plan Completed — ${executiveName} (${planDateStr})`,
      executiveName,
      executiveEmail,
      planDate: planDateStr,
      planType: plan.plan_type || 'N/A',
      location: plan.location || 'N/A',
      remarks: plan.remarks || 'None',
      visitsCount: String(visits.length),
      workCount: String(workItems.length),
      expensesTotal: expensesTotal.toLocaleString('en-IN'),
      visitsTableHtml,
      tasksTableHtml,
      workPlanUrl,
    };

    const managerEmails = managers.map((m) => m.email).filter(Boolean);
    if (managerEmails.length === 0) {
      logger.warn(`[WorkPlanNotification] No manager email addresses found for plan ${planId}`);
      return;
    }

    const primaryRecipient = managerEmails[0];
    const ccList = managerEmails.slice(1);
    const primaryManager = managers.find((m) => m.email === primaryRecipient);
    const recipientName = primaryManager ? (primaryManager.name || primaryRecipient.split('@')[0]) : 'Manager';

    try {
      await emailHelper.sendTemplateEmail(
        primaryRecipient,
        'work_plan_completed',
        {
          ...templateData,
          recipientName,
        },
        [],
        ccList,
        fromAddress
      );
      logger.info(
        `[WorkPlanNotification] Sent single work plan completion email to ${primaryRecipient} (CC: ${ccList.join(', ') || 'none'}) from ${fromAddress}`
      );
    } catch (sendErr) {
      logger.error(
        `[WorkPlanNotification] Failed sending email to ${primaryRecipient}: ${sendErr.message}`
      );
    }
  } catch (err) {
    logger.error(`[WorkPlanNotification] Error sending completion emails for plan ${planId}: ${err.message}`);
  }
}

module.exports = {
  getWorkPlannerManagers,
  sendWorkPlanCompletedEmail,
};
