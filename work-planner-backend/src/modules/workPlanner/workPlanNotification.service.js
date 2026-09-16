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
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No visits recorded for this plan.</p>';
  }
  const rows = visitsList
    .map((v, i) => {
      const party =
        (v.party && typeof v.party === 'object' ? v.party.party_name : null) ||
        v.party_name ||
        v.contact_person ||
        'N/A';
      const contact =
        v.contact_person ||
        (v.party && typeof v.party === 'object' ? v.party.contact_person : '') ||
        '';
      const purpose = v.purpose || 'General';
      const status = (v.status || 'pending').toLowerCase();
      const outcome = v.outcome || v.notes || '—';
      const time = v.planned_start_time
        ? `${v.planned_start_time}${v.planned_end_time ? ' - ' + v.planned_end_time : ''}`
        : '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'pending' || status === 'checked_in') {
        statusBadgeStyle = 'background-color: #fef9c3; color: #854d0e; border: 1px solid #fef08a;';
      } else if (['cancelled', 'skipped'].includes(status)) {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            <div style="font-weight: 600;">${i + 1}. ${party}</div>
            ${contact ? `<div style="font-size: 11px; color: #64748b;">Contact: ${contact}</div>` : ''}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${purpose}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap;">
            ${time}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
            ${outcome}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Client / Party</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Purpose</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Time</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Outcome / Notes</th>
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
    return '<p style="font-size: 13px; color: #64748b; font-style: italic; margin: 8px 0;">No tasks recorded for this plan.</p>';
  }
  const rows = taskList
    .map((t, i) => {
      const title = t.title || 'Task #' + (i + 1);
      const desc = t.description || '—';
      const status = (t.status || 'pending').toLowerCase();
      const remarks = t.completion_remarks || t.outcome || '—';

      let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
      if (status === 'completed') {
        statusBadgeStyle = 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
      } else if (status === 'pending') {
        statusBadgeStyle = 'background-color: #fef9c3; color: #854d0e; border: 1px solid #fef08a;';
      } else if (status === 'cancelled') {
        statusBadgeStyle = 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;';
      }

      const formattedStatus = status.replace(/_/g, ' ').toUpperCase();

      return `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600; width: 28%;">
            ${i + 1}. ${title}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 35%;">
            ${desc}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 15%;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${statusBadgeStyle}">
              ${formattedStatus}
            </span>
          </td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; width: 22%;">
            ${remarks}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #0f172a; color: #ffffff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Task Title</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Description</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Status</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #1e293b;">Remarks</th>
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

/**
 * Dispatches a custom Day End completion email created via the rich mail composer panel.
 *
 * @param {string} planId
 * @param {object} executiveUser - User object of executive submitting Day End
 * @param {object} dayEndData - { to_email, cc_emails, subject, body_html, attachment_ids }
 */
async function sendCustomDayEndEmail(planId, executiveUser, dayEndData = {}) {
  try {
    if (!executiveUser || !executiveUser.email) {
      logger.warn(`[WorkPlanNotification] Missing executive user email for custom Day End on plan ${planId}`);
      return;
    }

    const recipient = dayEndData.to_email?.trim();
    if (!recipient) {
      logger.warn(`[WorkPlanNotification] No recipient specified for custom Day End on plan ${planId}`);
      return;
    }

    const executiveName = executiveUser.name || executiveUser.email.split('@')[0];
    const fromAddress = `${executiveName} <${executiveUser.email}>`;
    const subject = dayEndData.subject?.trim() || `Day End Report — ${executiveName}`;
    const htmlBody = dayEndData.body_html || '<p>Day End Report submitted.</p>';
    const ccList = Array.isArray(dayEndData.cc_emails)
      ? dayEndData.cc_emails.map((e) => String(e).trim()).filter(Boolean)
      : [];

    // Resolve attachments if provided
    let emailAttachments = [];
    if (Array.isArray(dayEndData.attachment_ids) && dayEndData.attachment_ids.length > 0) {
      const { Attachment } = getModels();
      const { getViewPresignedUrl } = require('../../services/fileManagement');
      const attachmentDocs = await Attachment.find({ _id: { $in: dayEndData.attachment_ids } }).lean();

      emailAttachments = await Promise.all(
        attachmentDocs.map(async (att) => {
          let fileUrl = att.url;
          if (att.filename && (!fileUrl || !fileUrl.startsWith('http'))) {
            try {
              fileUrl = await getViewPresignedUrl(att.filename);
            } catch (err) {
              logger.warn(`[WorkPlanNotification] Failed to refresh URL for attachment ${att._id}: ${err.message}`);
            }
          }
          return {
            filename: att.original_name || att.filename || 'attachment',
            path: fileUrl,
            contentType: att.mime_type || 'application/octet-stream',
          };
        })
      );
    }

    await emailHelper.sendEmail(
      recipient,
      subject,
      '', // text body fallback
      htmlBody,
      emailAttachments,
      ccList,
      fromAddress
    );

    logger.info(
      `[WorkPlanNotification] Sent Day End custom email to ${recipient} (CC: ${ccList.join(', ') || 'none'}, Attachments: ${emailAttachments.length}) from ${fromAddress}`
    );
  } catch (err) {
    logger.error(`[WorkPlanNotification] Error sending custom Day End email for plan ${planId}: ${err.message}`);
  }
}

module.exports = {
  getWorkPlannerManagers,
  sendWorkPlanCompletedEmail,
  sendCustomDayEndEmail,
  renderVisitsTable,
  renderTasksTable,
};
